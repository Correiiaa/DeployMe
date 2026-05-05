const SCAN_DEBOUNCE_MS = 400
const DEPLOYME_BUTTON_ID = 'deployme-extract-button'
let scanTimer = null
let lastSignature = ''

function extractJobIdFromUrl() {
  const url = new URL(window.location.href)
  const candidates = [
    window.location.pathname.match(/\/jobs\/(?:view|collections)\/(\d+)/i),
    window.location.pathname.match(/\/(\d{6,})\/?$/),
    url.searchParams.get('currentJobId')?.match(/\d+/),
    url.searchParams.get('jobId')?.match(/\d+/)
  ]

  for (const candidate of candidates) {
    if (candidate?.[1]) return candidate[1]
    if (candidate?.[0]) return candidate[0]
  }

  const fallbackMatch = window.location.href.match(/(?:jobId|currentJobId)=(\d{6,})/i)
  return fallbackMatch?.[1] ?? ''
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function extractVisibleButtonText(button) {
  if (!button) return ''

  const strongText = normalizeText(button.querySelector('strong')?.textContent ?? '')
  if (strongText) return strongText

  return normalizeText(button.textContent ?? '')
}

function extractCompanyName() {
  const companyLink = document.querySelector(
    '.job-details-jobs-unified-top-card__company-name a[data-test-app-aware-link]'
  )
  if (companyLink) {
    const text = normalizeText(companyLink.textContent ?? '')
    if (text && text !== 'Ver página da empresa') return text
  }

  const fallbackCompanyLink = document.querySelector('a[href*="/company/"]')
  if (fallbackCompanyLink) {
    const text = normalizeText(fallbackCompanyLink.textContent ?? '')
    if (text && text !== 'Ver página da empresa') return text
  }

  return ''
}

function extractJobTitle() {
  const jobTitleLink = document.querySelector(
    '.job-details-jobs-unified-top-card__job-title h1 a'
  )
  if (jobTitleLink) {
    const text = normalizeText(jobTitleLink.textContent ?? '')
    if (text) return text
  }

  const jobLink = document.querySelector('a[href*="/jobs/view/"]')
  if (jobLink) {
    const text = normalizeText(jobLink.textContent ?? '')
    if (text) return text
  }

  // Fallback: first h1
  return normalizeText(document.querySelector('h1')?.textContent ?? '')
}

function extractLocationFromTopCard() {
  const firstLocationSpan = document.querySelector(
    '.job-details-jobs-unified-top-card__primary-description-container span[dir="ltr"] > span.tvm__text.tvm__text--low-emphasis:first-child, .job-details-jobs-unified-top-card span[dir="ltr"] > span.tvm__text.tvm__text--low-emphasis:first-child'
  )

  const firstLocationText = normalizeText(firstLocationSpan?.textContent ?? '')
  if (firstLocationText) return firstLocationText

  // Fallback: scan the low-emphasis spans and skip separators/metadata.
  const locationSpans = Array.from(document.querySelectorAll('span.tvm__text.tvm__text--low-emphasis'))

  for (const span of locationSpans) {
    const text = normalizeText(span.textContent ?? '')
    if (!text) continue

    // Skip irrelevant texts
    if (/\d+\s+candidaturas/i.test(text)) continue
    if (/avaliando candidaturas|hiring|aplicação|submissão/i.test(text)) continue
    if (/Ver página da empresa|aplicar|enviar|candidatura/i.test(text)) continue
    if (text === '·') continue

    return text
  }

  return ''
}

function extractCompanyLogoUrl() {
  const logoImage = document.querySelector('img[alt*="Logo da empresa"]')
  return logoImage?.getAttribute('src') ?? ''
}

function extractWorkStyle() {
  const firstButton = document.querySelector('.job-details-fit-level-preferences button:first-child')
  
  if (firstButton) {
    const hiddenText = normalizeText(firstButton.querySelector('.visually-hidden')?.textContent ?? '')
    const hiddenMatch = hiddenText.match(
      /tipo de local de trabalho é\s+(Remoto|Híbrido|Hibrido|Presencial|Remote|Hybrid|On-site)/i
    )
    if (hiddenMatch?.[1]) return hiddenMatch[1]

    const buttonText = extractVisibleButtonText(firstButton)
    if (buttonText && /^(remoto|hibrido|híbrido|presencial|onsite|remote)$/i.test(buttonText)) {
      return buttonText
    }
  }

  const buttons = Array.from(document.querySelectorAll('button.artdeco-button--secondary'))

  for (const button of buttons) {
    const buttonText = extractVisibleButtonText(button)
    if (!buttonText) continue

    if (/^(remoto|hibrido|híbrido|presencial|onsite|remote)$/i.test(buttonText)) {
      return buttonText
    }

    const hiddenText = normalizeText(button.querySelector('.visually-hidden')?.textContent ?? '')
    const hiddenMatch = hiddenText.match(
      /tipo de local de trabalho é\s+(Remoto|Híbrido|Hibrido|Presencial|Remote|Hybrid|On-site)/i
    )
    if (hiddenMatch?.[1]) return hiddenMatch[1]
  }

  return ''
}

function extractEmploymentType() {
  const buttons = Array.from(document.querySelectorAll('button.artdeco-button--secondary'))

  for (const button of buttons) {
    const buttonText = extractVisibleButtonText(button)
    if (!buttonText) continue

    if (
      /tempo integral|full[-\s]?time|part[-\s]?time|meio período|meio periodo/i.test(buttonText)
    ) {
      return buttonText
    }
  }

  return ''
}

function extractJobDescription() {
  const descriptionNode = document.querySelector('#job-details')
  if (!descriptionNode) return ''

  const text = normalizeText(descriptionNode.innerText ?? descriptionNode.textContent ?? '')
  return text
}

function stringifyLocation(jobLocation) {
  if (!jobLocation) return ''

  if (typeof jobLocation === 'string') return normalizeText(jobLocation)

  if (Array.isArray(jobLocation)) {
    for (const item of jobLocation) {
      const value = stringifyLocation(item)
      if (value) return value
    }
    return ''
  }

  if (typeof jobLocation === 'object') {
    const address = jobLocation.address
    const pieces = [
      normalizeText(jobLocation.locationName),
      normalizeText(address?.addressLocality),
      normalizeText(address?.addressRegion),
      normalizeText(address?.addressCountry)
    ].filter(Boolean)

    return pieces.join(', ')
  }

  return ''
}

function parseJsonLdJobPosting() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))

  for (const script of scripts) {
    const rawText = script.textContent?.trim()
    if (!rawText) continue

    try {
      const parsed = JSON.parse(rawText)
      const candidates = Array.isArray(parsed) ? parsed : [parsed]

      for (const candidate of candidates) {
        const typeValue = candidate?.['@type']
        const types = Array.isArray(typeValue) ? typeValue : [typeValue]
        if (!types.some((typeItem) => String(typeItem).toLowerCase().includes('jobposting'))) {
          continue
        }

        const companyName = normalizeText(candidate?.hiringOrganization?.name)
        const title = normalizeText(candidate?.title ?? candidate?.name)
        const location = stringifyLocation(candidate?.jobLocation)

        return {
          title,
          company: companyName,
          location
        }
      }
    } catch {
      continue
    }
  }

  return null
}

function fallbackScrapeJobMetadata() {
  const title = extractJobTitle()
  const company = extractCompanyName()
  const topCardLocation = extractLocationFromTopCard()
  const metaDescription = normalizeText(
    document.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? ''
  )

  let location = topCardLocation

  if (!location) {
    const locationCandidates = Array.from(document.querySelectorAll('span, div')).slice(0, 250)
    for (const candidate of locationCandidates) {
      const text = normalizeText(candidate.textContent ?? '')
      if (!text || text === title || text === company) continue
      if (/location|remote|hybrid|onsite|portugal|lisboa|porto|braga/i.test(text)) {
        location = text
        break
      }
    }
  }

  if (!location && metaDescription) {
    const locationMatch = metaDescription.match(
      /\b(Remote|Hybrid|On-site|[A-Z][a-z]+,\s*[A-Z]{2}|[A-Z][a-z]+,\s*[A-Z][a-z]+)\b/
    )
    location = locationMatch?.[0] ?? ''
  }

  if (!title && !company && !location) return null

  return {
    title,
    company,
    location
  }
}

function collectJobMetadata() {
  const jobId = extractJobIdFromUrl()
  if (!jobId) return null

  const fromJsonLd = parseJsonLdJobPosting()
  const fromFallback = fallbackScrapeJobMetadata()
  const metadata = fromJsonLd ?? fromFallback

  const title = extractJobTitle() || metadata?.title || ''
  const company = extractCompanyName() || metadata?.company || ''
  const location = extractLocationFromTopCard() || metadata?.location || ''
  const workStyle = extractWorkStyle()
  const employmentType = extractEmploymentType()
  const companyLogo = extractCompanyLogoUrl()
  const description = extractJobDescription()

  if (!title && !company && !location && !workStyle && !employmentType && !description) {
    return null
  }

  return {
    jobId,
    title,
    company,
    location,
    workStyle,
    employmentType,
    companyLogo,
    description,
    sourceUrl: window.location.href,
    capturedAt: Date.now()
  }
}

function sendJobMetadata() {
  const metadata = collectJobMetadata()
  if (!metadata) return

  const signature = [
    metadata.jobId,
    metadata.title,
    metadata.company,
    metadata.location,
    metadata.workStyle,
    metadata.employmentType,
    metadata.companyLogo,
    metadata.description
  ].join('|')
  if (signature === lastSignature) return

  lastSignature = signature
  chrome.runtime.sendMessage({
    type: 'LINKEDIN_JOB_METADATA',
    payload: metadata
  })
}

function isVisible(element) {
  if (!element) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

function findLinkedInSaveButton() {
  const selectorCandidates = [
    'button.jobs-save-button',
    'button[aria-label*="Guardar"]',
    'button[aria-label*="Salvar"]',
    'button[aria-label*="Save"]'
  ]

  for (const selector of selectorCandidates) {
    const candidates = Array.from(document.querySelectorAll(selector))
    for (const candidate of candidates) {
      if (!isVisible(candidate)) continue
      if (candidate.id === DEPLOYME_BUTTON_ID || candidate.dataset.deploymeButton === 'true') {
        continue
      }

      const text = extractVisibleButtonText(candidate).toLowerCase()
      const ariaLabel = normalizeText(candidate.getAttribute('aria-label') ?? '').toLowerCase()
      if (text.includes('save') || text.includes('salvar') || text.includes('guardar')) {
        return candidate
      }

      if (
        ariaLabel.includes('save') ||
        ariaLabel.includes('salvar') ||
        ariaLabel.includes('guardar')
      ) {
        return candidate
      }
    }
  }

  return null
}

function setButtonText(button, value) {
  const textNode = button.querySelector('.artdeco-button__text')
  if (textNode) {
    textNode.textContent = value
    return
  }

  button.textContent = value
}

function createDeployMeButton() {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = DEPLOYME_BUTTON_ID
  button.dataset.deploymeButton = 'true'
  button.setAttribute('aria-label', 'Extrair vaga para DeployMe')
  button.className = 'artdeco-button artdeco-button--secondary artdeco-button--2'
  button.style.marginLeft = '8px'
  button.innerHTML = '<span class="artdeco-button__text">DeployMe 🚀</span>'

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    const metadata = collectJobMetadata()
    if (!metadata) {
      setButtonText(button, 'Sem dados')
      window.setTimeout(() => setButtonText(button, 'DeployMe'), 1200)
      return
    }

    setButtonText(button, 'A extrair...')
    chrome.runtime.sendMessage(
      {
        type: 'DEPLOYME_MANUAL_EXTRACT',
        payload: metadata
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[DeployMe] falha ao extrair vaga', chrome.runtime.lastError.message)
          setButtonText(button, 'Erro')
          window.setTimeout(() => setButtonText(button, 'DeployMe'), 1500)
          return
        }

        if (!response?.ok) {
          if (response?.reason === 'auth_required') {
            setButtonText(button, 'Login Google')
            window.setTimeout(() => setButtonText(button, 'DeployMe'), 1800)
            return
          }

          setButtonText(button, 'Erro Sync')
          window.setTimeout(() => setButtonText(button, 'DeployMe'), 1800)
          return
        }

        setButtonText(button, 'Extraído')
        window.setTimeout(() => setButtonText(button, 'DeployMe'), 1200)
      }
    )
  })

  return button
}

function ensureDeployMeButton() {
  if (document.getElementById(DEPLOYME_BUTTON_ID)) return

  const saveButton = findLinkedInSaveButton()
  if (!saveButton) return

  const deployMeButton = createDeployMeButton()
  saveButton.insertAdjacentElement('afterend', deployMeButton)
}

function runScan() {
  sendJobMetadata()
  ensureDeployMeButton()
}

function scheduleScan() {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(runScan, SCAN_DEBOUNCE_MS)
}

runScan()

const observer = new MutationObserver(() => {
  scheduleScan()
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true
})

window.addEventListener('popstate', scheduleScan)
window.addEventListener('hashchange', scheduleScan)

const originalPushState = history.pushState
history.pushState = function pushState(...args) {
  const result = originalPushState.apply(this, args)
  scheduleScan()
  return result
}

const originalReplaceState = history.replaceState
history.replaceState = function replaceState(...args) {
  const result = originalReplaceState.apply(this, args)
  scheduleScan()
  return result
}

console.log('[LinkedIn Easy Apply Inspector] content script loaded')
