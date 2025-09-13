'use client'

import { useState } from 'react'
import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { exportHTMLReport } from '@/utils/html-report'

interface HTMLExportButtonProps {
  data: ProcessedLogEntry[]
  timeWindowStats: TimeWindowStats[]
  dateRange?: {
    start: Date | null
    end: Date | null
  }
  selectedDevices?: string[]
  timeRange?: {
    start: string
    end: string
  }
  appliedFilters?: {
    categories?: string[]
    status?: string[]
    protocols?: string[]
    countries?: string[]
    behaviorPatterns?: string[]
    whatsappActivity?: string[]
    facebookActivity?: string[]
  }
  className?: string
}

export default function HTMLExportButton({ 
  data, 
  timeWindowStats, 
  dateRange,
  selectedDevices,
  timeRange,
  appliedFilters,
  className = '' 
}: HTMLExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const filename = exportHTMLReport({
        data,
        timeWindowStats,
        dateRange,
        selectedDevices,
        timeRange,
        appliedFilters
      })
      
      // Show success message
      console.log(`HTML report exported: ${filename}`)
      
      // Optional: Show toast notification
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          alert(`Report saved to: ${filename}`)
        }, 100)
      }
    } catch (error) {
      console.error('Failed to export HTML report:', error)
      if (typeof window !== 'undefined') {
        alert('Failed to export report. Please try again.')
      }
    } finally {
      setIsExporting(false)
    }
  }

  // Filter for activities to show count
  const detectedActivities = timeWindowStats.filter(stat => 
    stat.whatsappActivity.activityScore > 0 ||
    stat.facebookActivity.activityScore > 0 ||
    stat.relationshipConcerns.concernScore > 0 ||
    stat.facebookActivity.isReelsScrolling ||
    stat.isRealChat
  )

  const criticalConcerns = detectedActivities.filter(stat => {
    return stat.relationshipConcerns.datingApps.length > 0 || 
           stat.relationshipConcerns.anonymousPlatforms.length > 0
  }).length

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || data.length === 0}
      className={`
        inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 
        text-white font-semibold rounded-lg shadow-lg hover:from-blue-700 hover:to-purple-700 
        transform transition-all duration-200 hover:scale-105 hover:shadow-xl
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${className}
      `}
    >
      {isExporting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Generating...</span>
        </>
      ) : (
        <>
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <span>Export HTML Report</span>
          {detectedActivities.length > 0 && (
            <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
              {detectedActivities.length}
              {criticalConcerns > 0 && (
                <span className="ml-1 text-red-200">🚨{criticalConcerns}</span>
              )}
            </span>
          )}
        </>
      )}
    </button>
  )
}
