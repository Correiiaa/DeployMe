import {
  faCircleInfo,
  faClock,
  faFilePdf,
  faPlus,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

const followUpThresholdDays = 14

export type ApplicationRow = {
  id: string
  name: string
  role: string
  status: string
  dateApplied: string
  notes: string
  cvPath?: string
}

function getDaysSince(dateValue: string): number {
  const startDate = new Date(dateValue)
  const currentDate = new Date()

  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const currentUtc = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  )

  return Math.floor((currentUtc - startUtc) / (1000 * 60 * 60 * 24))
}

type ApplicationTableProps = {
  data: ApplicationRow[]
  onDataChange: (applications: ApplicationRow[]) => void
  onSelectApplication: (application: ApplicationRow) => void
}

export default function ApplicationTable({
  data,
  onDataChange,
  onSelectApplication
}: ApplicationTableProps): React.JSX.Element {
  async function openCv(filePath?: string): Promise<void> {
    if (!filePath) return

    try {
      await window.api.openCv(filePath)
    } catch (error) {
      console.error('Failed to open CV', error)
    }
  }

  const table = useReactTable({
    data,
    columns: [
      {
        header: 'Company Name',
        accessorKey: 'name'
      },
      {
        header: 'Role / Position',
        accessorKey: 'role'
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue, row }) => {
          const status = getValue() as string
          const options = ['Proposed', 'Rejected', 'Applied', 'Interview']
          return (
            <select
              value={status}
              onChange={(e) => {
                const newStatus = e.target.value
                onDataChange(
                  data.map((r, i) => (i === row.index ? { ...r, status: newStatus } : r))
                )
              }}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-2 rounded-md text-sm bg-transparent border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200 hover:cursor-pointer"
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )
        }
      },
      {
        header: 'Date Applied',
        accessorKey: 'dateApplied'
      },
      {
        header: 'Follow-up',
        cell: ({ row }) => {
          const daysSinceApplication = getDaysSince(row.original.dateApplied)
          const isOverdue = daysSinceApplication > followUpThresholdDays

          return (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                isOverdue
                  ? 'border border-red-200 bg-red-50 text-red-700'
                  : 'border border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {isOverdue ? <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5" /> : null}
              <span>Sem resposta há {daysSinceApplication} dias</span>
            </div>
          )
        }
      },
      {
        header: 'Notes',
        accessorKey: 'notes'
      },
      {
        header: 'CV',
        cell: ({ row }) => {
          const cvPath = row.original.cvPath

          return (
            <button
              type="button"
              disabled={!cvPath}
              onClick={(e) => {
                e.stopPropagation()
                openCv(cvPath)
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faFilePdf} />
            </button>
          )
        }
      },
      {
        header: 'Detalhes',
        cell: ({ row }) => {
          return (
            <button
              type="button"
              onClick={() => onSelectApplication(row.original)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faCircleInfo} />
            </button>
          )
        }
      }
    ],
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <div className="w-full flex flex-col gap-4 mt-5">
      <div className="flex flex-row">
        {/* Buttons */}
        <div className="grid grid-cols-2 gap-4 w-1/2">
          <div className="rounded-lg bg-white h-9 flex items-center justify-center hover:cursor-pointer border border-gray-100">
            <div className="text-sm font-medium text-gray-800">Active Application</div>
            <div className="text-sm text-gray-400 ml-2">( 3 )</div>
          </div>
          <div className="rounded-lg bg-black hover:bg-stone-900 h-9 flex items-center justify-center hover:cursor-pointer px-3">
            <FontAwesomeIcon icon={faPlus} className="pr-2 text-white" />
            <div className="text-sm font-medium text-white">Add New Job</div>
          </div>
        </div>

        {/* Search bar */}
        <div className="w-1/3 ml-auto">
          <input
            type="text"
            placeholder="Search applications..."
            className="w-full h-9 px-4 py-2 rounded-xl bg-slate-300 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-white rounded-2xl overflow-hidden mt-5 shadow-sm border border-gray-100">
        <table className="w-full min-w-full divide-y divide-gray-100">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => {
              const daysSinceApplication = getDaysSince(row.original.dateApplied)
              const isOverdue = daysSinceApplication > followUpThresholdDays

              return (
                <tr
                  key={row.id}
                  className={`odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors ${
                    isOverdue ? 'ring-1 ring-inset ring-red-200' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 text-sm text-gray-700 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-6 py-4 align-middle text-center">
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center"
                    >
                      <FontAwesomeIcon
                        icon={faTrash}
                        className="text-gray-400 hover:text-gray-600 hover:cursor-pointer w-4"
                      />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
