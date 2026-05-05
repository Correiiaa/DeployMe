const pendingSubmissions = new Map()
const pendingSubmissionLogs = new Map()
const jobMetadataCache = new Map()
const tabMetadataCache = new Map()
const MANUAL_EXTRACTIONS_STORAGE_KEY = 'deploymeManualExtractions'
const DRIVE_DATA_FILE_NAME = 'deployme_data.json'
const DRIVE_FILE_ID_STORAGE_KEY = 'deploymeDriveFileId'
const GOOGLE_PROFILE_STORAGE_KEY = 'deploymeGoogleProfile'
const MAX_STORED_EXTRACTIONS = 200
const TARGET_PATHS = [
  '/voyager/api/jobs/applications',
  '/voyager/api/voyagerJobsDashOnsiteApplyApplication',
  '/voyager/api/jobs/',
  'easyApply'
]

console.log('[LinkedIn Easy Apply Inspector] background service worker started')

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(result ?? {})
    })
  })
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve()
    })
  })
}

function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!token) {
        reject(new Error('No OAuth token returned'))
        return
      }

      resolve(token)
    })
  })
}

function removeCachedAuthToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
}

function createAuthRequiredError() {
  return new Error('auth_required')
}

function isAuthError(error) {
  const message = String(error?.message ?? error).toLowerCase()
  return (
    message === 'auth_required' ||
    message.includes('oauth') ||
    message.includes('token') ||
    message.includes('not signed') ||
    message.includes('not granted') ||
    message.includes('user interaction') ||
    message.includes('did not approve')
  )
}

function mapErrorToReason(error, fallbackReason) {
  return isAuthError(error) ? 'auth_required' : fallbackReason
}

async function authorizedGoogleRequest(url, options = {}, interactive = false) {
  let token
  try {
    token = await getAuthToken(interactive)
  } catch (error) {
    if (!interactive) throw createAuthRequiredError()
    throw error
  }

  const execute = (tokenValue) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${tokenValue}`
      }
    })

  let response = await execute(token)
  if (response.status !== 401) {
    return response
  }

  await removeCachedAuthToken(token)
  try {
    token = await getAuthToken(interactive)
  } catch (error) {
    if (!interactive) throw createAuthRequiredError()
    throw error
  }

  response = await execute(token)
  return response
}

async function getGoogleProfile(interactive) {
  const response = await authorizedGoogleRequest(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { method: 'GET' },
    interactive
  )

  if (!response.ok) {
    throw new Error(`google_profile_fetch_failed:${response.status}`)
  }

  const payload = await response.json()
  const profile = {
    name: normalizeString(payload?.name ?? payload?.email ?? ''),
    email: normalizeString(payload?.email ?? '')
  }

  if (!profile.email) {
    throw new Error('google_profile_missing_email')
  }

  await storageSet({ [GOOGLE_PROFILE_STORAGE_KEY]: profile })
  return profile
}

function escapeDriveQueryValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findDriveFileIdByName(interactive) {
  const safeName = escapeDriveQueryValue(DRIVE_DATA_FILE_NAME)
  const query = encodeURIComponent(`name='${safeName}' and trashed=false and 'root' in parents`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1&spaces=drive`
  const response = await authorizedGoogleRequest(url, { method: 'GET' }, interactive)

  if (!response.ok) {
    throw new Error(`drive_list_failed:${response.status}`)
  }

  const payload = await response.json()
  return normalizeString(payload?.files?.[0]?.id ?? '')
}

async function writeDriveFile(fileId, data, interactive) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`
  const response = await authorizedGoogleRequest(
    url,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: data
    },
    interactive
  )

  if (!response.ok) {
    throw new Error(`drive_write_failed:${response.status}`)
  }
}

async function createDriveDataFile(interactive) {
  const response = await authorizedGoogleRequest(
    'https://www.googleapis.com/drive/v3/files?fields=id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        name: DRIVE_DATA_FILE_NAME,
        mimeType: 'application/json',
        parents: ['root']
      })
    },
    interactive
  )

  if (!response.ok) {
    throw new Error(`drive_create_failed:${response.status}`)
  }

  const payload = await response.json()
  const fileId = normalizeString(payload?.id ?? '')
  if (!fileId) {
    throw new Error('drive_create_missing_id')
  }

  await writeDriveFile(fileId, '[]', interactive)
  await storageSet({ [DRIVE_FILE_ID_STORAGE_KEY]: fileId })
  return fileId
}

async function ensureDriveDataFileId(interactive) {
  const store = await storageGet([DRIVE_FILE_ID_STORAGE_KEY])
  const cachedId = normalizeString(store?.[DRIVE_FILE_ID_STORAGE_KEY] ?? '')
  if (cachedId) return cachedId

  const existingFileId = await findDriveFileIdByName(interactive)
  if (existingFileId) {
    await storageSet({ [DRIVE_FILE_ID_STORAGE_KEY]: existingFileId })
    return existingFileId
  }

  return createDriveDataFile(interactive)
}

async function readDriveApplications(fileId, interactive) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
  const response = await authorizedGoogleRequest(url, { method: 'GET' }, interactive)

  if (response.status === 404) {
    await storageSet({ [DRIVE_FILE_ID_STORAGE_KEY]: '' })
    throw new Error('drive_file_missing')
  }

  if (!response.ok) {
    throw new Error(`drive_read_failed:${response.status}`)
  }

  const content = await response.text()
  if (!content.trim()) return []

  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toIsoDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Date().toISOString().slice(0, 10)
}

function formatDefaultNotes(metadata) {
  const parts = []
  if (metadata.location) parts.push(`Localizacao: ${metadata.location}`)
  if (metadata.workStyle) parts.push(`Regime: ${metadata.workStyle}`)
  if (metadata.employmentType) parts.push(`Contrato: ${metadata.employmentType}`)
  if (metadata.sourceUrl) parts.push(`Fonte: ${metadata.sourceUrl}`)
  return parts.join(' | ')
}

function toApplicationRow(metadata, existingItem) {
  return {
    id: normalizeString(existingItem?.id ?? '') || crypto.randomUUID(),
    name: metadata.company || normalizeString(existingItem?.name ?? ''),
    role: metadata.title || normalizeString(existingItem?.role ?? ''),
    status: normalizeString(existingItem?.status ?? '') || 'Applied',
    dateApplied: toIsoDate(existingItem?.dateApplied),
    salary: normalizeString(existingItem?.salary ?? ''),
    notes: normalizeString(existingItem?.notes ?? '') || formatDefaultNotes(metadata),
    cvPath: existingItem?.cvPath,
    jobId: metadata.jobId || normalizeString(existingItem?.jobId ?? ''),
    location: metadata.location || normalizeString(existingItem?.location ?? ''),
    workStyle: metadata.workStyle || normalizeString(existingItem?.workStyle ?? ''),
    employmentType:
      metadata.employmentType || normalizeString(existingItem?.employmentType ?? ''),
    companyLogo: metadata.companyLogo || normalizeString(existingItem?.companyLogo ?? ''),
    description: metadata.description || normalizeString(existingItem?.description ?? ''),
    sourceUrl: metadata.sourceUrl || normalizeString(existingItem?.sourceUrl ?? ''),
    capturedAt: metadata.capturedAt ?? Date.now(),
    source: 'linkedin-extension'
  }
}

function upsertApplication(rows, metadata) {
  const key = metadata.jobId || metadata.sourceUrl
  const nextRows = Array.isArray(rows) ? [...rows] : []
  const index = key
    ? nextRows.findIndex((item) => (item?.jobId || item?.sourceUrl) === key)
    : -1
  const previous = index >= 0 ? nextRows[index] : null
  const nextItem = toApplicationRow(metadata, previous)

  if (index >= 0) {
    nextRows[index] = {
      ...previous,
      ...nextItem
    }
  } else {
    nextRows.unshift(nextItem)
  }

  return nextRows.slice(0, MAX_STORED_EXTRACTIONS)
}

function isLinkedInPostRequest(details) {
  if (details.method !== 'POST') return false

  try {
    const url = new URL(details.url)
    return url.hostname.endsWith('linkedin.com')
  } catch {
    return false
  }
}

function isLikelyEasyApplyRequest(details) {
  try {
    const url = new URL(details.url)
    const path = `${url.pathname}${url.search}`.toLowerCase()
    return TARGET_PATHS.some((targetPath) => path.includes(targetPath.toLowerCase()))
  } catch {
    return false
  }
}

function summarizeRequestBody(details) {
  const requestBody = details.requestBody
  if (!requestBody) return null

  const summary = {
    formKeys: requestBody.formData ? Object.keys(requestBody.formData) : [],
    rawBytes:
      requestBody.raw?.reduce((total, chunk) => total + (chunk.bytes?.byteLength ?? 0), 0) ?? 0
  }

  if (requestBody.formData) {
    const flatEntries = Object.entries(requestBody.formData).flatMap(([key, values]) =>
      values.map((value) => `${key}=${value}`)
    )
    summary.formPreview = flatEntries.slice(0, 8).join('&')
  }

  if (requestBody.raw?.length) {
    const decoded = requestBody.raw
      .map((chunk) => decodeBytes(chunk.bytes))
      .join('\n')
      .trim()

    if (decoded) {
      summary.rawPreview = decoded.slice(0, 250)
    }
  }

  return summary
}

function decodeBytes(bytes) {
  if (!bytes) return ''

  try {
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

function deepFindJobId(value) {
  if (!value) return null

  if (typeof value === 'string') {
    const patterns = [
      /"?(?:jobId|jobID|jobPostingId|jobPostingUrn|postingId)"?\s*:\s*"?([^"&,}\]]+)/i,
      /(?:jobId|jobID|jobPostingId|jobPostingUrn|postingId)=([^&]+)/i,
      /urn:li:jobPosting:(\d+)/i,
      /(?:jobId|jobPostingId|postingId)[^0-9]*(\d{5,})/i,
      /easyApplyFormElement:\((\d+),(\d+),[^)]+\)/i
    ]

    for (const pattern of patterns) {
      const match = value.match(pattern)
      if (match?.[1]) return match[1]
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = deepFindJobId(item)
      if (result) return result
    }
  }

  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (/job|posting|position/i.test(key) && typeof nestedValue === 'string') {
        const cleaned = deepFindJobId(nestedValue)
        if (cleaned) return cleaned
      }

      const result = deepFindJobId(nestedValue)
      if (result) return result
    }
  }

  return null
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function findFirstMatchingString(value, keyPattern, visited = new Set()) {
  if (!value || typeof value !== 'object') return null
  if (visited.has(value)) return null
  visited.add(value)

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keyPattern.test(key)) {
      if (typeof nestedValue === 'string') return normalizeString(nestedValue)
      if (typeof nestedValue === 'number') return String(nestedValue)
      if (nestedValue && typeof nestedValue === 'object') {
        const nestedString = findFirstMatchingString(
          nestedValue,
          /^(name|title|value|localizedName|formattedText)$/i,
          visited
        )
        if (nestedString) return nestedString
      }
    }

    if (nestedValue && typeof nestedValue === 'object') {
      const nestedString = findFirstMatchingString(nestedValue, keyPattern, visited)
      if (nestedString) return nestedString
    }
  }

  return null
}

function extractJobMetadata(payload) {
  if (!payload || typeof payload !== 'object') return null

  const title =
    findFirstMatchingString(payload, /(^|[_.-])(title|jobtitle|position)([_.-]|$)/i) ??
    findFirstMatchingString(payload, /headline|role/i)
  const company =
    findFirstMatchingString(payload, /companyname|companydetails|company|employer|organization/i) ??
    findFirstMatchingString(payload, /universalname/i)
  const location =
    findFirstMatchingString(
      payload,
      /formattedlocation|locationdescription|location|city|region/i
    ) ?? findFirstMatchingString(payload, /workplace/i)

  if (!title && !company && !location) return null

  return {
    title,
    company,
    location
  }
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null

  const jobId = typeof metadata.jobId === 'string' ? metadata.jobId.trim() : ''

  return {
    jobId,
    title: normalizeString(metadata.title),
    company: normalizeString(metadata.company),
    location: normalizeString(metadata.location),
    workStyle: normalizeString(metadata.workStyle),
    employmentType: normalizeString(metadata.employmentType),
    companyLogo: normalizeString(metadata.companyLogo),
    description: normalizeString(metadata.description),
    sourceUrl: normalizeString(metadata.sourceUrl),
    capturedAt: typeof metadata.capturedAt === 'number' ? metadata.capturedAt : Date.now()
  }
}

async function persistManualExtractionLocally(metadata) {
  const store = await storageGet([MANUAL_EXTRACTIONS_STORAGE_KEY])
  const currentItems = Array.isArray(store?.[MANUAL_EXTRACTIONS_STORAGE_KEY])
    ? store[MANUAL_EXTRACTIONS_STORAGE_KEY]
    : []

  const dedupeKey = metadata.jobId || metadata.sourceUrl
  const dedupedItems = dedupeKey
    ? currentItems.filter((item) => (item?.jobId || item?.sourceUrl) !== dedupeKey)
    : currentItems

  const nextItems = [{ ...metadata, extractedAt: Date.now() }, ...dedupedItems].slice(
    0,
    MAX_STORED_EXTRACTIONS
  )

  await storageSet({ [MANUAL_EXTRACTIONS_STORAGE_KEY]: nextItems })
}

async function persistManualExtractionToDrive(metadata) {
  let fileId = await ensureDriveDataFileId(false)
  let rows
  try {
    rows = await readDriveApplications(fileId, false)
  } catch (error) {
    if (String(error?.message ?? '') !== 'drive_file_missing') {
      throw error
    }

    fileId = await ensureDriveDataFileId(false)
    rows = []
  }

  const nextRows = upsertApplication(rows, metadata)
  await writeDriveFile(fileId, JSON.stringify(nextRows, null, 2), false)
}

async function persistManualExtraction(metadata) {
  await persistManualExtractionLocally(metadata)
  await persistManualExtractionToDrive(metadata)
}

function getMetadataForSubmission(submission) {
  if (submission.jobId && jobMetadataCache.has(submission.jobId)) {
    return jobMetadataCache.get(submission.jobId)
  }

  if (submission.tabId != null && tabMetadataCache.has(submission.tabId)) {
    return tabMetadataCache.get(submission.tabId)
  }

  return null
}

function formatSubmissionLogPayload(jobId, metadata, details) {
  return {
    jobId,
    title: metadata?.title ?? null,
    company: metadata?.company ?? null,
    location: metadata?.location ?? null,
    workStyle: metadata?.workStyle ?? null,
    employmentType: metadata?.employmentType ?? null,
    companyLogo: metadata?.companyLogo ?? null,
    description: metadata?.description ?? null,
    sourceUrl: metadata?.sourceUrl ?? null,
    url: details.url,
    statusCode: details.statusCode,
    requestId: details.requestId
  }
}

function logSubmissionWithMetadata(details, submission) {
  const metadata = jobMetadataCache.get(submission.jobId) ?? null
  console.log(
    '[LinkedIn Easy Apply] candidatura enviada com sucesso',
    formatSubmissionLogPayload(submission.jobId, metadata, details)
  )
}

function queueSubmissionLog(details, submission) {
  const metadata = getMetadataForSubmission(submission)
  if (metadata) {
    logSubmissionWithMetadata(details, submission)
    return
  }

  pendingSubmissionLogs.set(details.requestId, {
    details: {
      url: details.url,
      statusCode: details.statusCode,
      requestId: details.requestId
    },
    submission: {
      jobId: submission.jobId,
      tabId: submission.tabId
    }
  })

  console.log('[LinkedIn Easy Apply] candidatura enviada; aguardando metadados da vaga', {
    jobId: submission.jobId,
    tabId: submission.tabId,
    url: details.url,
    statusCode: details.statusCode,
    requestId: details.requestId
  })
}

function flushQueuedSubmissionLogs({ jobId, tabId }) {
  const metadata =
    (jobId && jobMetadataCache.get(jobId)) ?? (tabId != null && tabMetadataCache.get(tabId)) ?? null

  if (!metadata) return

  for (const [requestId, queuedItem] of pendingSubmissionLogs.entries()) {
    const matchesJob = jobId && queuedItem.submission.jobId === jobId
    const matchesTab = tabId != null && queuedItem.submission.tabId === tabId
    if (!matchesJob && !matchesTab) continue

    pendingSubmissionLogs.delete(requestId)
    console.log(
      '[LinkedIn Easy Apply] candidatura enviada com sucesso',
      formatSubmissionLogPayload(
        queuedItem.submission.jobId || jobId || '',
        metadata,
        queuedItem.details
      )
    )
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return

  if (message.type === 'DEPLOYME_GOOGLE_LOGIN') {
    getGoogleProfile(true)
      .then((profile) => {
        sendResponse({ ok: true, isAuthenticated: true, user: profile })
      })
      .catch((error) => {
        console.error('[DeployMe] Google login failed in extension:', error)
        sendResponse({ ok: false, reason: mapErrorToReason(error, 'login_failed') })
      })
    return true
  }

  if (message.type === 'DEPLOYME_GOOGLE_AUTH_STATUS') {
    getGoogleProfile(false)
      .then((profile) => {
        sendResponse({ ok: true, isAuthenticated: true, user: profile })
      })
      .catch(async () => {
        const store = await storageGet([GOOGLE_PROFILE_STORAGE_KEY]).catch(() => ({}))
        const profile = store?.[GOOGLE_PROFILE_STORAGE_KEY] ?? null
        sendResponse({ ok: true, isAuthenticated: false, user: profile })
      })
    return true
  }

  if (message.type === 'LINKEDIN_JOB_METADATA') {
    const metadata = normalizeMetadata(message.payload)
    if (!metadata) return

    const senderTabId = sender?.tab?.id ?? null

    const previousMetadata = jobMetadataCache.get(metadata.jobId)
    const mergedMetadata = {
      ...previousMetadata,
      ...metadata
    }

    if (metadata.jobId) {
      jobMetadataCache.set(metadata.jobId, mergedMetadata)
    }

    if (senderTabId != null) {
      tabMetadataCache.set(senderTabId, mergedMetadata)
    }

    console.log('[LinkedIn Easy Apply] metadados da vaga capturados', mergedMetadata)
    flushQueuedSubmissionLogs({ jobId: metadata.jobId, tabId: senderTabId })
    return
  }

  if (message.type !== 'DEPLOYME_MANUAL_EXTRACT') return

  const metadata = normalizeMetadata(message.payload)
  if (!metadata) {
    sendResponse({ ok: false, reason: 'invalid_metadata' })
    return
  }

  const senderTabId = sender?.tab?.id ?? null
  if (metadata.jobId) {
    const previousMetadata = jobMetadataCache.get(metadata.jobId)
    jobMetadataCache.set(metadata.jobId, {
      ...previousMetadata,
      ...metadata
    })
  }

  if (senderTabId != null) {
    tabMetadataCache.set(senderTabId, metadata)
  }

  persistManualExtraction(metadata)
    .then(() => {
      console.log('[DeployMe] vaga extraida manualmente e sincronizada com Google Drive', metadata)
      sendResponse({ ok: true, jobId: metadata.jobId })
    })
    .catch((error) => {
      console.error('[DeployMe] falha ao sincronizar vaga extraida', error)
      sendResponse({
        ok: false,
        reason: mapErrorToReason(error, 'drive_sync_failed')
      })
    })

  return true
})

function extractJobId(details) {
  const requestBody = details.requestBody
  if (!requestBody) return null

  const url = new URL(details.url)
  const urlSignal = `${url.pathname}${url.search}`.toLowerCase()

  if (requestBody.formData) {
    const flatEntries = Object.entries(requestBody.formData).flatMap(([key, values]) =>
      values.map((value) => `${key}=${value}`)
    )
    const formDataBlob = flatEntries.join('&')
    const jobFromForm = deepFindJobId(formDataBlob)
    if (jobFromForm) return jobFromForm
  }

  if (requestBody.raw?.length) {
    for (const rawChunk of requestBody.raw) {
      const decoded = decodeBytes(rawChunk.bytes)
      const jobFromRaw = deepFindJobId(decoded)
      if (jobFromRaw) return jobFromRaw

      const directJobMatch = decoded.match(/easyApplyFormElement:\((\d+),(\d+),[^)]+\)/i)
      if (directJobMatch?.[1]) return directJobMatch[1]

      try {
        const parsed = JSON.parse(decoded)
        const jobFromJson = deepFindJobId(parsed)
        if (jobFromJson) return jobFromJson
      } catch {
        const urlParams = new URLSearchParams(decoded)
        for (const [key, value] of urlParams.entries()) {
          if (/job|posting|position/i.test(key)) {
            const jobFromParam = deepFindJobId(`${key}=${value}`)
            if (jobFromParam) return jobFromParam
          }
        }
      }
    }
  }

  return null
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isLinkedInPostRequest(details)) return

    const requestSummary = summarizeRequestBody(details)
    const likelyEasyApply = isLikelyEasyApplyRequest(details)

    console.log('[LinkedIn Easy Apply] POST observado', {
      url: details.url,
      requestId: details.requestId,
      likelyEasyApply,
      requestSummary
    })

    const jobId = extractJobId(details)
    pendingSubmissions.set(details.requestId, {
      jobId,
      tabId: details.tabId,
      url: details.url,
      likelyEasyApply,
      startedAt: Date.now()
    })
  },
  { urls: ['*://*.linkedin.com/*'] },
  ['requestBody']
)

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const submission = pendingSubmissions.get(details.requestId)
    if (!submission) return

    pendingSubmissions.delete(details.requestId)

    if (details.statusCode >= 200 && details.statusCode < 300 && submission.likelyEasyApply) {
      const metadata = getMetadataForSubmission(submission)
      if (metadata) {
        console.log(
          '[LinkedIn Easy Apply] candidatura enviada com sucesso',
          formatSubmissionLogPayload(submission.jobId || '', metadata, details)
        )
      } else {
        queueSubmissionLog(details, submission)
      }
    }
  },
  { urls: ['*://*.linkedin.com/*'] }
)

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    pendingSubmissions.delete(details.requestId)
  },
  { urls: ['*://*.linkedin.com/*'] }
)
