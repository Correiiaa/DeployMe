import NavBar from './components/NavBar'
import ApplicationTable from './components/ApplicationTable'
import InterviewDossier from './components/InterviewDossier'
import type { ApplicationRow } from './components/ApplicationTable'
import { useEffect, useRef, useState } from 'react'

const AUTO_SAVE_DEBOUNCE_MS = 1000

type GoogleAuthStatus = {
  isAuthenticated: boolean
  user: {
    name: string
    email: string
  } | null
}

function toIsoDate(dateValue: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue
  }

  const parsedDate = new Date(dateValue)
  if (Number.isNaN(parsedDate.getTime())) {
    console.warn('Invalid dateApplied value received; defaulting to current date', dateValue)
    return new Date().toISOString().slice(0, 10)
  }

  return parsedDate.toISOString().slice(0, 10)
}

function normalizeApplications(nextApplications: ApplicationRow[]): ApplicationRow[] {
  return nextApplications.map((application) => ({
    ...application,
    dateApplied: toIsoDate(application.dateApplied)
  }))
}

function App(): React.JSX.Element {
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRow | null>(null)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus>({
    isAuthenticated: false,
    user: null
  })
  const hasLoadedInitialDataRef = useRef(false)
  const autoSaveTimerRef = useRef<number | null>(null)

  function scheduleSave(nextApplications: ApplicationRow[]): void {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      window.api
        .saveVagas(nextApplications)
        .catch((error) => console.error('Failed to persist application data', error))
    }, AUTO_SAVE_DEBOUNCE_MS)
  }

  function handleDataChange(nextApplications: ApplicationRow[]): void {
    const normalizedApplications = normalizeApplications(nextApplications)
    setApplications(normalizedApplications)

    if (!hasLoadedInitialDataRef.current) {
      return
    }

    scheduleSave(normalizedApplications)
  }

  useEffect(() => {
    async function initializeAppState(): Promise<void> {
      try {
        const [status, loadedApplications] = await Promise.all([
          window.api.getGoogleAuthStatus(),
          window.api.getVagas()
        ])

        setAuthStatus(status)
        if (Array.isArray(loadedApplications)) {
          setApplications(normalizeApplications(loadedApplications as ApplicationRow[]))
        }
      } catch (error) {
        console.error('Failed to initialize app state', error)
        setApplications([])
      } finally {
        hasLoadedInitialDataRef.current = true
      }
    }

    initializeAppState()
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  async function handleGoogleLogin(): Promise<void> {
    try {
      const status = await window.api.loginWithGoogle()
      setAuthStatus(status)

      const loadedApplications = await window.api.getVagas()
      if (Array.isArray(loadedApplications)) {
        setApplications(normalizeApplications(loadedApplications as ApplicationRow[]))
      }
    } catch (error) {
      console.error('Google login failed', error)
    }
  }

  return (
    <div className="h-screen w-screen bg-slate-100 text-white">
      <NavBar
        isAuthenticated={authStatus.isAuthenticated}
        userName={authStatus.user?.name}
        userEmail={authStatus.user?.email}
        onLogin={handleGoogleLogin}
      />
      <div className="relative max-w-7xl w-full mx-auto px-6 py-8">
        <ApplicationTable
          data={applications}
          onDataChange={handleDataChange}
          onSelectApplication={setSelectedApplication}
        />
        <InterviewDossier
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      </div>
    </div>
  )
}

export default App
