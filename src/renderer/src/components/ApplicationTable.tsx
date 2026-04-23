import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import React, { useState } from 'react'

export default function ApplicationTable() {
  const [data, setData] = useState([
    {
      name: 'My First App',
      role: 'Software Engineer',
      status: 'Applied',
      lastDeployed: '2024-06-01'
    }
    // Add more application data here
  ])

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
                setData((old) =>
                  old.map((r, i) => (i === row.index ? { ...r, status: newStatus } : r))
                )
              }}
              className="px-3 py-2 rounded-md text-sm bg-transparent border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-200"
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
        header: 'Last Deployed',
        accessorKey: 'lastDeployed'
      },
      {
        header: 'Actions',
        cell: () => (
          <div className="flex gap-3 items-center">
            <button className="text-sm text-gray-600 hover:text-gray-800">View</button>
            <button className="text-sm text-red-500 hover:underline">Delete</button>
          </div>
        )
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 text-sm text-gray-700 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
