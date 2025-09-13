'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { exportCommunicationReport } from '@/utils/pdf-export'

interface PDFExportButtonProps {
  data: ProcessedLogEntry[]
  timeWindowStats: TimeWindowStats[]
  dateRange?: {
    start: Date | null
    end: Date | null
  }
  selectedDevices?: string[]
}

export default function PDFExportButton({ data, timeWindowStats, dateRange, selectedDevices }: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const filename = exportCommunicationReport({
        data,
        timeWindowStats,
        dateRange,
        includeAllLogs: true,
        selectedDevices
      })
      
      // Show success message
      alert(`Report exported successfully as: ${filename}`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Calculate summary stats for button display
  const communicationPeriods = timeWindowStats.filter(stat => 
    stat.whatsappActivity.activityScore > 0 || 
    stat.facebookActivity.activityScore > 0 || 
    stat.isRealChat
  ).length

  const whatsappActivities = timeWindowStats.filter(s => s.whatsappActivity.activityScore > 0).length
  const facebookActivities = timeWindowStats.filter(s => s.facebookActivity.activityScore > 0).length

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Export Communication Report</span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Generate a professional PDF report of communication activity
          </p>
          
          {/* Summary stats */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
            <span>📊 {communicationPeriods} communication periods</span>
            <span>💬 {whatsappActivities} WhatsApp activities</span>
            <span>📘 {facebookActivities} Facebook activities</span>
            <span>📋 {data.length.toLocaleString()} total logs</span>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || data.length === 0}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            isExporting || data.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
          }`}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </>
          )}
        </button>
      </div>

      {/* Export options */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">Report Contents:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>✅ Communication activity timeline with time windows</li>
          <li>✅ WhatsApp calls, messages, and media transfers</li>
          <li>✅ Facebook/Messenger and Instagram activity</li>
          <li>✅ VPN attempts and suspicious behavior indicators</li>
          <li>✅ Detailed DNS logs table (communication-related entries)</li>
          <li>✅ Activity statistics and summary</li>
        </ul>
      </div>
    </div>
  )
}
