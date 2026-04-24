import NavBar from './components/NavBar'
import ApplicationTable from './components/ApplicationTable'
import InterviewDossier from './components/InterviewDossier'
import type { ApplicationRow } from './components/ApplicationTable'
import { useState } from 'react'

function App(): React.JSX.Element {
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRow | null>(null)

  return (
    <div className="h-screen w-screen bg-slate-100 text-white">
      <NavBar />
      <div className="relative max-w-7xl w-full mx-auto px-6 py-8">
        <ApplicationTable onSelectApplication={setSelectedApplication} />
        <InterviewDossier
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      </div>
    </div>
  )
}

export default App
