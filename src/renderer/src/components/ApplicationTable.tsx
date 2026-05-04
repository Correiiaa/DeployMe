import {
  faBriefcase,
  faBuilding,
  faCalendarDays,
  faCircleInfo,
  faClock,
  faFilePdf,
  faFileLines,
  faMagnifyingGlass,
  faPlus,
  faTrashCan,
  faListCheck
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'

const followUpThresholdDays = 14
const AUTO_SAVE_DELAY_MS = 700
const MS_PER_DAY = 1000 * 60 * 60 * 24

export type ApplicationRow = {
  id: string
  name: string
  role: string
  status: string
  dateApplied: string
  salary?: string
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

function getApplicationRangeDays(rows: ApplicationRow[]): number {
  if (rows.length < 2) return 0

  const dayValues = rows
    .map((row) => new Date(row.dateApplied).getTime())
    .filter((value) => !Number.isNaN(value))

  if (dayValues.length < 2) return 0

  const oldest = Math.min(...dayValues)
  const newest = Math.max(...dayValues)

  return Math.max(0, Math.round((newest - oldest) / MS_PER_DAY))
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

type ApplicationTableProps = {
  data: ApplicationRow[]
  onDataChange: (applications: ApplicationRow[]) => void
  onSelectApplication: (application: ApplicationRow) => void
}

const statusOptions = ['Proposed', 'Rejected', 'Applied', 'Interview']
type EditableField = 'name' | 'role' | 'status' | 'dateApplied' | 'notes' | 'salary'
type RowDraft = Partial<Pick<ApplicationRow, EditableField>>
const headerCellClass =
  'bg-slate-50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500'
const bodyCellClass = 'border-b border-slate-100 px-4 py-3 align-middle text-sm text-slate-700'
const inputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200'
const iconClassName = 'h-4 w-4 shrink-0 text-slate-400'
const actionButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
const statusToneClasses: Record<string, string> = {
  Proposed: 'border-slate-200 bg-slate-100 text-slate-700',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  Applied: 'border-sky-200 bg-sky-50 text-sky-700',
  Interview: 'border-amber-200 bg-amber-50 text-amber-800'
}

function renderHeader(title: string, icon: React.ReactNode): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-2">
      {icon}
      <span>{title}</span>
    </div>
  )
}

function renderStatusPill(status: string): React.JSX.Element {
  const toneClassName = statusToneClasses[status] ?? 'border-slate-200 bg-slate-100 text-slate-700'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClassName}`}
    >
      {status}
    </span>
  )
}

export default function ApplicationTable({
  data,
  onDataChange,
  onSelectApplication
}: ApplicationTableProps): React.JSX.Element {
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({})
  const [searchQuery, setSearchQuery] = useState('')

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

  const mergedRows = buildRowsWithDrafts(data, rowDrafts)
  const normalizedQuery = normalizeText(searchQuery)
  const displayedRows = normalizedQuery
    ? mergedRows.filter((row) => {
        const haystack = [row.name, row.role, row.status, row.dateApplied, row.notes, row.cvPath]
          .filter(Boolean)
          .join(' ')

        return normalizeText(haystack).includes(normalizedQuery)
      })
    : mergedRows

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

    onDataChange([...mergedRows, newJob])
    setRowDrafts({})
    setSearchQuery('')
  }

  function handleDeleteJob(id: string): void {
    onDataChange(mergedRows.filter((application) => application.id !== id))
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
    onDataChange(mergedRows)
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
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
          isOverdue
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}
      >
        <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5" />
        <span>No reply for {days} days</span>
      </div>
    )
  }
  function cvBody(row: ApplicationRow): React.JSX.Element {
    return (
      <button
        type="button"
        disabled={!row.cvPath}
        onClick={() => openCv(row.cvPath)}
        className={`${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <FontAwesomeIcon icon={faFilePdf} />
      </button>
    )
  }

  function detailsBody(row: ApplicationRow): React.JSX.Element {
    return (
      <button type="button" onClick={() => onSelectApplication(row)} className={actionButtonClass}>
        <FontAwesomeIcon icon={faCircleInfo} />
      </button>
    )
  }

  function deleteBody(row: ApplicationRow): React.JSX.Element {
    return (
      <button
        type="button"
        onClick={() => handleDeleteJob(row.id)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
      >
        <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />
      </button>
    )
  }

  const summaryCountLabel = `${displayedRows.length} ${displayedRows.length === 1 ? 'application' : 'applications'}`
  const summaryRangeLabel =
    displayedRows.length > 0 ? `Range ${getApplicationRangeDays(displayedRows)} days` : 'No rows'

  return (
    <div className="mt-5 flex w-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white/95 p-4 text-slate-900 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <FontAwesomeIcon icon={faListCheck} className="h-4 w-4 text-slate-500" />
            <span>Applications History</span>
          </div>
          <span className="hidden text-xs uppercase tracking-[0.24em] text-slate-400 md:inline">
            Deploy Me
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleAddJob}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            <span>Add Job</span>
          </button>

          <div className="relative min-w-0 sm:w-88">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search applications..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
        <DataTable
          value={displayedRows}
          dataKey="id"
          className="text-slate-900"
          tableClassName="min-w-full border-separate border-spacing-0"
          rowClassName={() => 'bg-white transition-colors hover:bg-slate-50/80'}
        >
          <Column
            field="name"
            header={renderHeader(
              'Company',
              <FontAwesomeIcon icon={faBuilding} className={iconClassName} />
            )}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={(row) => (
              <InputText
                value={row.name}
                onChange={(e) => updateField(row.id, 'name', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                placeholder="Company name"
                className={inputClassName}
              />
            )}
          />
          <Column
            field="role"
            header={renderHeader(
              'Position',
              <FontAwesomeIcon icon={faBriefcase} className={iconClassName} />
            )}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={(row) => (
              <InputText
                value={row.role}
                onChange={(e) => updateField(row.id, 'role', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                placeholder="Role or position"
                className={inputClassName}
              />
            )}
          />
          <Column
            field="status"
            header={renderHeader(
              'Status',
              <FontAwesomeIcon icon={faListCheck} className={iconClassName} />
            )}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={(row) => (
              <Dropdown
                value={row.status}
                options={statusOptions}
                onChange={(e) => updateField(row.id, 'status', e.value as string)}
                className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm"
                panelClassName="rounded-xl border border-slate-200 bg-white shadow-lg"
                valueTemplate={(option) => renderStatusPill((option as string) ?? row.status)}
                itemTemplate={(option) => renderStatusPill(option as string)}
                pt={{
                  root: { className: '!bg-white' },
                  input: { className: '!bg-white !text-slate-700' },
                  trigger: { className: '!bg-white !text-slate-500' }
                }}
              />
            )}
          />
          <Column
            field="dateApplied"
            header={renderHeader(
              'Application Date',
              <FontAwesomeIcon icon={faCalendarDays} className={iconClassName} />
            )}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={(row) => (
              <div className="relative">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="date"
                  value={row.dateApplied}
                  onChange={(e) => updateField(row.id, 'dateApplied', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      flushNow()
                    }
                  }}
                  className={`${inputClassName} pl-10`}
                />
              </div>
            )}
          />

          <Column
            header={renderHeader(
              'Salary',
              <FontAwesomeIcon icon={faBriefcase} className={iconClassName} />
            )}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={(row) => (
              <InputText
                value={row.salary}
                onChange={(e) => updateField(row.id, 'salary', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                placeholder="Expected salary"
                className={inputClassName}
              />
            )}
          />

          <Column
            header={renderHeader(
              'Follow-up',
              <FontAwesomeIcon icon={faClock} className={iconClassName} />
            )}
            body={followUpBody}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
          />
          <Column
            field="notes"
            header={renderHeader(
              'Notes',
              <FontAwesomeIcon icon={faFileLines} className={iconClassName} />
            )}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={(row) => (
              <InputText
                value={row.notes}
                onChange={(e) => updateField(row.id, 'notes', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    flushNow()
                  }
                }}
                placeholder="Short note"
                className={inputClassName}
              />
            )}
          />
          <Column
            header={renderHeader(
              'CV',
              <FontAwesomeIcon icon={faFilePdf} className={iconClassName} />
            )}
            body={cvBody}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
          />
          <Column
            header={renderHeader(
              'Details',
              <FontAwesomeIcon icon={faCircleInfo} className={iconClassName} />
            )}
            body={detailsBody}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
          />
          <Column
            header={<span className="sr-only">Delete</span>}
            headerClassName={headerCellClass}
            bodyClassName={bodyCellClass}
            body={deleteBody}
          />
        </DataTable>
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
        <span>{summaryCountLabel}</span>
        <span>{summaryRangeLabel}</span>
      </div>
    </div>
  )
}
