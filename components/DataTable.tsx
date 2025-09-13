'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, ExternalLink } from 'lucide-react'
import { ProcessedLogEntry } from '@/types/dns-log'
// Timestamps are now already converted to SAST in the data processing pipeline

interface DataTableProps {
  data: ProcessedLogEntry[]
}

type SortField = keyof ProcessedLogEntry
type SortDirection = 'asc' | 'desc'

export default function DataTable({ data }: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('parsedTimestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    
    const term = searchTerm.toLowerCase()
    return data.filter(entry => 
      entry.domain.toLowerCase().includes(term) ||
      entry.device_name?.toLowerCase().includes(term) ||
      entry.category.toLowerCase().includes(term) ||
      entry.status.toLowerCase().includes(term) ||
      entry.protocol.toLowerCase().includes(term)
    )
  }, [data, searchTerm])

  // Sort data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      // Handle different data types
      if (sortField === 'parsedTimestamp') {
        const aTime = (aVal as Date).getTime()
        const bTime = (bVal as Date).getTime()
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aStr = aVal.toLowerCase()
        const bStr = bVal.toLowerCase()
        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
        return 0
      }

      // Handle numeric and other types
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Fallback for other types
      const aStr = String(aVal)
      const bStr = String(bVal)
      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />
  }

  const getStatusBadge = (status: string, isBlocked: boolean) => {
    if (isBlocked) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Blocked
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Allowed
      </span>
    )
  }

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'WhatsApp Domain Access': 'bg-green-100 text-green-800',
      'Facebook Domain Access': 'bg-blue-100 text-blue-800',
      'Other Messaging': 'bg-purple-100 text-purple-800',
      'Social Media': 'bg-pink-100 text-pink-800',
      'Streaming & Entertainment': 'bg-orange-100 text-orange-800',
      'Google Services': 'bg-yellow-100 text-yellow-800',
      'Cloud & CDN': 'bg-gray-100 text-gray-800',
      'Advertising & Analytics': 'bg-red-100 text-red-800',
      'Security & Monitoring': 'bg-indigo-100 text-indigo-800',
      'Other': 'bg-gray-100 text-gray-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[category] || colors['Other']}`}>
        {category}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">DNS Log Entries</h3>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search domains, devices, categories..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <span className="text-sm text-gray-600">
              {sortedData.length.toLocaleString()} entries
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('parsedTimestamp')}
              >
                <div className="flex items-center space-x-1">
                  <span>Time</span>
                  <SortIcon field="parsedTimestamp" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('domain')}
              >
                <div className="flex items-center space-x-1">
                  <span>Domain</span>
                  <SortIcon field="domain" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center space-x-1">
                  <span>Category</span>
                  <SortIcon field="category" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <SortIcon field="status" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('device_name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Device</span>
                  <SortIcon field="device_name" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('protocol')}
              >
                <div className="flex items-center space-x-1">
                  <span>Protocol</span>
                  <SortIcon field="protocol" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('destination_country')}
              >
                <div className="flex items-center space-x-1">
                  <span>Country</span>
                  <SortIcon field="destination_country" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((entry, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.parsedTimestamp.toLocaleTimeString()} SAST
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="flex items-center space-x-2">
                    <span className="truncate max-w-xs" title={entry.domain}>
                      {entry.domain}
                    </span>
                    <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getCategoryBadge(entry.category)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(entry.status, entry.isBlocked)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.device_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.protocol}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.destination_country || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} entries
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
