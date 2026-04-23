import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function ApplicationTable() {
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-row">
        {/* Buttons */}
        <div className="grid grid-cols-2 gap-4 w-1/2">
          <div className="rounded-2xl bg-slate-200 h-10 flex items-center justify-center">
            <div className="text-lg font-normal text-black">Active Application</div>
            <div className="text-lg font-normal text-gray-500 ml-2">( 3 )</div>
          </div>
          <div className="rounded-2xl bg-black h-10 flex items-center justify-center">
            <FontAwesomeIcon icon={faPlus} className="pr-2" />
            <div className="text-lg font-normal text-white">Add New Job</div>
          </div>
        </div>

        {/* Search bar */}
        <div className="w-1/3 ml-auto">
          <input
            type="text"
            placeholder="Search applications..."
            className="w-full px-4 py-2 rounded-2xl bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-gray-800 rounded-2xl overflow-hidden">
        
      </div>
    </div>
  )
}
