import NavBar from './components/NavBar'
import ApplicationTable from './components/ApplicationTable'
import InterviewDossier from './components/InterviewDossier'
import type { ApplicationRow } from './components/ApplicationTable'
import { DEFAULT_APPLICATIONS } from './constants/defaultApplications'
import { useEffect, useRef, useState } from 'react'

type GoogleAuthStatus = {
  isAuthenticated: boolean
  user: {
    name: string
    email: string
  } | null
}

function App(): React.JSX.Element {
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRow | null>(null)
  const [applications, setApplications] = useState<ApplicationRow[]>(DEFAULT_APPLICATIONS)
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus>({
    isAuthenticated: false,
    user: null
  })
  const hasLoadedInitialDataRef = useRef(false)

  useEffect(() => {
    async function initializeAppState(): Promise<void> {
      try {
        const [status, loadedApplications] = await Promise.all([
          window.api.getGoogleAuthStatus(),
          window.api.loadApplications()
        ])

        setAuthStatus(status)
        if (Array.isArray(loadedApplications)) {
          setApplications(loadedApplications as ApplicationRow[])
        }
      } catch (error) {
        console.error('Failed to initialize app state', error)
      } finally {
        hasLoadedInitialDataRef.current = true
      }
    }

    initializeAppState()
  }, [])

  useEffect(() => {
    if (!hasLoadedInitialDataRef.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      window.api
        .saveApplications(applications)
        .catch((error) => console.error('Failed to persist application data', error))
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [applications])

  async function handleGoogleLogin(): Promise<void> {
    try {
      const status = await window.api.loginWithGoogle()
      setAuthStatus(status)

      const loadedApplications = await window.api.loadApplications()
      if (Array.isArray(loadedApplications)) {
        setApplications(loadedApplications as ApplicationRow[])
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
          onDataChange={setApplications}
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
