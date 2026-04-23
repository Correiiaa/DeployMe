import NavBar from './components/NavBar'
import ApplicationTable from './components/ApplicationTable'

function App(): React.JSX.Element {
  return (
    <div className="h-screen w-screen bg-gray-900 text-white">
      <NavBar />
      <div className="max-w-5xl w-full mx-auto px-6 py-8">
        <ApplicationTable />
      </div>
    </div>
  )
}

export default App
