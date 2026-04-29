import {
  faCircleInfo,
  faClock,
  faFilePdf,
  faPlus,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'

const followUpThresholdDays = 14
const AUTO_SAVE_DELAY_MS = 70

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

const statusOptions = ['Proposed', 'Rejected', 'Applied', 'Interview']
type EditableField = 'name' | 'role' | 'status' | 'dateApplied' | 'notes'
type RowDraft = Partial<Pick<ApplicationRow, EditableField>>

export default function ApplicationTable({
  data,
  onDataChange,
  onSelectApplication
}: ApplicationTableProps): React.JSX.Element {
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({})

  function getTodayIsoDate(): string {
    return new Date().toISOString().slice(0, 10)
  }

  function buildRowsWithDrafts(
    baseRows: ApplicationRow[],
    drafts: Record<string, RowDraft>
  ): ApplicationRow[] {
    return baseRows.map((row) => {
      const draft = drafts[row.id]
      return draft ? { ...row, ...draft } : row
    })
  }

  const displayedRows = buildRowsWithDrafts(data, rowDrafts)

  useEffect(() => {
    if (Object.keys(rowDrafts).length === 0) return

    const timeoutId = window.setTimeout(() => {
      onDataChange(buildRowsWithDrafts(data, rowDrafts))
      setRowDrafts({})
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [rowDrafts, data, onDataChange])

  function handleAddJob(): void {
    const newJob: ApplicationRow = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      status: 'Applied',
      dateApplied: getTodayIsoDate(),
      notes: '',
      cvPath: undefined
    }

    onDataChange([...displayedRows, newJob])
    setRowDrafts({})
  }

  function handleDeleteJob(id: string): void {
    onDataChange(displayedRows.filter((application) => application.id !== id))
    setRowDrafts((currentDrafts) => {
      if (!currentDrafts[id]) return currentDrafts
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[id]
      return nextDrafts
    })
  }

  async function openCv(filePath?: string): Promise<void> {
    if (!filePath) return
    try {
      await window.api.openCv(filePath)
    } catch (error) {
      console.error('Failed to open CV', error)
    }
  }

  function flushNow(): void {
    if (Object.keys(rowDrafts).length === 0) return
    onDataChange(displayedRows)
    setRowDrafts({})
  }

  function updateField(rowId: string, field: EditableField, value: string): void {
    const baseRow = data.find((row) => row.id === rowId)
    if (!baseRow) return

    setRowDrafts((currentDrafts) => {
      const currentRowDraft = currentDrafts[rowId] ?? {}
      const nextRowDraft = { ...currentRowDraft }

      if (value === baseRow[field]) {
        delete nextRowDraft[field]
      } else {
        nextRowDraft[field] = value
      }

      if (Object.keys(nextRowDraft).length === 0) {
        const nextDrafts = { ...currentDrafts }
        delete nextDrafts[rowId]
        return nextDrafts
      }

      return { ...currentDrafts, [rowId]: nextRowDraft }
    })
  }

  function followUpBody(row: ApplicationRow): React.JSX.Element {
    const days = getDaysSince(row.dateApplied)
    const isOverdue = days > followUpThresholdDays

    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
          isOverdue
            ? 'border border-red-200 bg-red-50 text-red-700'
            : 'border border-gray-200 bg-gray-50 text-gray-600'
        }`}
      >
        {isOverdue && <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5" />}
        <span>Sem resposta há {days} dias</span>
      </div>
    )
  }

  function cvBody(row: ApplicationRow): React.JSX.Element {
    return (
      <button
        type="button"
        disabled={!row.cvPath}
        onClick={() => openCv(row.cvPath)}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FontAwesomeIcon icon={faFilePdf} />
      </button>
    )
  }

  function detailsBody(row: ApplicationRow): React.JSX.Element {
    return (
      <button
        type="button"
        onClick={() => onSelectApplication(row)}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
      >
        <FontAwesomeIcon icon={faCircleInfo} />
      </button>
    )
  }

  function deleteBody(row: ApplicationRow): React.JSX.Element {
    return (
      <button
        type="button"
        onClick={() => handleDeleteJob(row.id)}
        className="inline-flex items-center justify-center"
      >
        <FontAwesomeIcon
          icon={faTrash}
          className="text-gray-400 hover:text-gray-600 hover:cursor-pointer w-4"
        />
      </button>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col gap-4 mt-5">
      {/* Top bar */}
      <div className="flex flex-row">
        <div className="grid grid-cols-2 gap-4 w-1/2">
          <div className="rounded-lg bg-white h-9 flex items-center justify-center hover:cursor-pointer border border-gray-100">
            <div className="text-sm font-medium text-gray-800">Active Application</div>
            <div className="text-sm text-gray-400 ml-2">( {displayedRows.length} )</div>
          </div>
          <button
            type="button"
            onClick={handleAddJob}
            className="rounded-lg bg-black hover:bg-stone-900 h-9 flex items-center justify-center hover:cursor-pointer px-3"
          >
            <FontAwesomeIcon icon={faPlus} className="pr-2 text-white" />
            <div className="text-sm font-medium text-white">Add New Job</div>
          </button>
        </div>

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
        <DataTable
          value={displayedRows}
          dataKey="id"
          className="w-full text-black"
          pt={{
            thead: { className: 'bg-white' },
            headerRow: { className: 'border-b border-gray-100' },
            bodyRow: {
              className:
                'odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100'
            }
          }}
        >
          <Column
            field="name"
            header="Company Name"
            body={(row) => (
              <InputText
                value={row.name}
                onChange={(e) => updateField(row.id, 'name', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            )}
          />
          <Column
            field="role"
            header="Role / Position"
            body={(row) => (
              <InputText
                value={row.role}
                onChange={(e) => updateField(row.id, 'role', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            )}
          />
          <Column
            field="status"
            header="Status"
            body={(row) => (
              <Dropdown
                value={row.status}
                options={statusOptions}
                onChange={(e) => updateField(row.id, 'status', e.value as string)}
                className="w-full text-sm"
              />
            )}
          />
          <Column
            field="dateApplied"
            header="Date Applied"
            body={(row) => (
              <input
                type="date"
                value={row.dateApplied}
                onChange={(e) => updateField(row.id, 'dateApplied', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                className="px-3 py-2 rounded-md text-sm border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            )}
          />
          <Column header="Follow-up" body={followUpBody} />
          <Column
            field="notes"
            header="Notes"
            body={(row) => (
              <InputText
                value={row.notes}
                onChange={(e) => updateField(row.id, 'notes', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                className="w-full px-3 py-2 rounded-md text-sm border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            )}
          />
          <Column header="CV" body={cvBody} />
          <Column header="Detalhes" body={detailsBody} />
          <Column body={deleteBody} />
        </DataTable>
      </div>
    </div>
  )
}
