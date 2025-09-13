'use client'

import { useState, useMemo, useCallback } from 'react'
import { BarChart3, LineChart, PieChart, Table, Settings, TrendingUp, Calendar } from 'lucide-react'
import FileSelector from '@/components/FileSelector'
import FilterPanel from '@/components/FilterPanel'
import StatsSummary from '@/components/StatsSummary'
import CommunicationActivityChart from '@/components/CommunicationActivityChart'
import TimeSeriesChart from '@/components/TimeSeriesChart'
import FilteredTimeSeriesChart from '@/components/FilteredTimeSeriesChart'
import CategoryChart from '@/components/CategoryChart'
import CountryChart from '@/components/CountryChart'
import DataTable from '@/components/DataTable'
import PDFExportButton from '@/components/PDFExportButton'
import HTMLExportButton from '@/components/HTMLExportButton'
import TrendAnalysis from '@/components/TrendAnalysis'
import { parseCSVFile, calculateTimeWindowStats } from '@/utils/csv-parser'
import { ProcessedLogEntry, FilterOptions } from '@/types/dns-log'
import { format, isWithinInterval } from 'date-fns'

export default function Dashboard() {
  const [rawData, setRawData] = useState<ProcessedLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeView, setActiveView] = useState<'overview' | 'charts' | 'trends' | 'table'>('overview')
  const [timeSeriesChartType, setTimeSeriesChartType] = useState<'scatter' | 'bar'>('scatter')
  const [categoryChartType, setCategoryChartType] = useState<'pie' | 'bar'>('pie')
  
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: { start: null, end: null },
    timeRange: { start: '00:00', end: '23:59' },
    devices: [],
    categories: [],
    status: [],
    protocols: [],
    countries: [],
    behaviorPatterns: [],
    whatsappActivity: [],
    facebookActivity: []
  })

  // Chart mode state - controlled by FilterPanel apply button
  const [isChartModeActive, setIsChartModeActive] = useState(false)
  const [selectedDayForCharts, setSelectedDayForCharts] = useState('')

  // Handle chart mode activation from FilterPanel
  const handleChartModeChange = useCallback((isActive: boolean, selectedDate: string) => {
    setIsChartModeActive(isActive)
    setSelectedDayForCharts(selectedDate)
  }, [])

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return rawData.filter(entry => {
      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const entryDate = entry.parsedTimestamp
        if (filters.dateRange.start && filters.dateRange.end) {
          if (!isWithinInterval(entryDate, {
            start: filters.dateRange.start,
            end: filters.dateRange.end
          })) {
            return false
          }
        } else if (filters.dateRange.start) {
          if (entryDate < filters.dateRange.start) return false
        } else if (filters.dateRange.end) {
          if (entryDate > filters.dateRange.end) return false
        }
      }

      // Time range filter
      const entryTime = format(entry.parsedTimestamp, 'HH:mm')
      if (entryTime < filters.timeRange.start || entryTime > filters.timeRange.end) {
        return false
      }

      // Device filter
      if (filters.devices.length > 0 && !filters.devices.includes(entry.device_name)) {
        return false
      }

      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(entry.category)) {
        return false
      }

      // Status filter
      if (filters.status.length > 0) {
        const status = entry.isBlocked ? 'blocked' : 'allowed'
        if (!filters.status.includes(status)) {
          return false
        }
      }

      // Protocol filter
      if (filters.protocols.length > 0 && !filters.protocols.includes(entry.protocol)) {
        return false
      }

      // Country filter
      if (filters.countries.length > 0 && !filters.countries.includes(entry.destination_country)) {
        return false
      }

      return true
    })
  }, [rawData, filters])

  // Calculate time window statistics for charts
  const timeWindowStats = useMemo(() => {
    return calculateTimeWindowStats(filteredData)
  }, [filteredData])

  // Filter time window stats based on behavioral patterns and WhatsApp activity
  const filteredTimeWindowStats = useMemo(() => {
    let filtered = timeWindowStats
    
    // Filter by behavioral patterns
    if (filters.behaviorPatterns && filters.behaviorPatterns.length > 0) {
      filtered = filtered.filter(stat => {
        return filters.behaviorPatterns!.some(pattern => {
          switch (pattern) {
            case 'real_chat':
              return stat.isRealChat
            case 'possible_vpn':
              return stat.isPossibleVPN
            case 'acting_secret':
              return stat.isActingSecret
            default:
              return false
          }
        })
      })
    }
    
    // Filter by WhatsApp activity types
    if (filters.whatsappActivity && filters.whatsappActivity.length > 0) {
      filtered = filtered.filter(stat => {
        return filters.whatsappActivity!.some(activity => {
          switch (activity) {
            case 'text_message':
              return stat.whatsappActivity.isTextMessage
            case 'media_transfer':
              return stat.whatsappActivity.isMediaTransfer
            case 'voice_call':
              return stat.whatsappActivity.isVoiceCall
            case 'video_call':
              return stat.whatsappActivity.isVideoCall
            default:
              return false
          }
        })
      })
    }
    
    // Filter by Facebook activity types
    if (filters.facebookActivity && filters.facebookActivity.length > 0) {
      filtered = filtered.filter(stat => {
        return filters.facebookActivity!.some(activity => {
          switch (activity) {
            case 'messaging':
              return stat.facebookActivity.isMessaging
            case 'media_transfer':
              return stat.facebookActivity.isMediaTransfer
            case 'instagram':
              return stat.facebookActivity.isInstagramActivity
            case 'background':
              return stat.facebookActivity.isBackgroundRefresh
            default:
              return false
          }
        })
      })
    }
    
    return filtered
  }, [timeWindowStats, filters.behaviorPatterns, filters.whatsappActivity, filters.facebookActivity])

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true)
    try {
      const data = await parseCSVFile(file)
      setRawData(data)
      
      // Reset filters when new file is loaded
      setFilters({
        dateRange: { start: null, end: null },
        timeRange: { start: '00:00', end: '23:59' },
        devices: [],
        categories: [],
        status: [],
        protocols: [],
        countries: [],
        behaviorPatterns: [],
        whatsappActivity: [],
        facebookActivity: []
      })
    } catch (error) {
      console.error('Error parsing CSV:', error)
      alert('Error parsing CSV file. Please check the file format.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const viewTabs = [
    { id: 'overview' as const, name: 'Overview', icon: BarChart3 },
    { id: 'charts' as const, name: 'Charts', icon: PieChart },
    { id: 'trends' as const, name: 'Trends', icon: TrendingUp },
    { id: 'table' as const, name: 'Data Table', icon: Table }
  ]

  if (rawData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              NextDNS Log Explorer
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Advanced DNS log analysis and visualization dashboard. 
              Upload your NextDNS CSV export to get started.
            </p>
          </div>
          
          <FileSelector onFileSelect={handleFileSelect} isLoading={isLoading} />
          
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <BarChart3 className="h-8 w-8 text-primary-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Advanced Filtering</h3>
                <p className="text-sm text-gray-600">Filter by date, time, device, category, and more</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <LineChart className="h-8 w-8 text-primary-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Rich Visualizations</h3>
                <p className="text-sm text-gray-600">Time series, pie charts, and statistical summaries</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <Table className="h-8 w-8 text-primary-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Detailed Analysis</h3>
                <p className="text-sm text-gray-600">Drill down into individual log entries</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">NextDNS Log Explorer</h1>
              <p className="text-gray-600 mt-2">
                Analyzing {filteredData.length.toLocaleString()} of {rawData.length.toLocaleString()} log entries
              </p>
            </div>
            <button
              onClick={() => {
                setRawData([])
                setFilters({
                  dateRange: { start: null, end: null },
                  timeRange: { start: '00:00', end: '23:59' },
                  devices: [],
                  categories: [],
                  status: [],
                  protocols: [],
                  countries: [],
                  behaviorPatterns: [],
                  whatsappActivity: []
                })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Load New File
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filter Panel */}
          <div className="lg:col-span-1">
            <FilterPanel 
              data={rawData} 
              filters={filters} 
              onFiltersChange={setFilters}
              onChartModeChange={handleChartModeChange}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* View Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 px-6">
                  {viewTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                          activeView === tab.id
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.name}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </div>

            {/* Content based on active view */}
            {activeView === 'overview' && (
              <div className="space-y-6">
                {/* Export Buttons - always available */}
                <div className="flex gap-4 flex-wrap">
                  <HTMLExportButton 
                    data={filteredData} 
                    timeWindowStats={filteredTimeWindowStats}
                    dateRange={filters.dateRange}
                    selectedDevices={filters.devices}
                    timeRange={filters.timeRange}
                    appliedFilters={{
                      categories: filters.categories,
                      status: filters.status,
                      protocols: filters.protocols,
                      countries: filters.countries,
                      behaviorPatterns: filters.behaviorPatterns,
                      whatsappActivity: filters.whatsappActivity,
                      facebookActivity: filters.facebookActivity
                    }}
                  />
                  <PDFExportButton 
                    data={filteredData} 
                    timeWindowStats={filteredTimeWindowStats}
                    dateRange={filters.dateRange}
                    selectedDevices={filters.devices}
                  />
                </div>
                
                {!isChartModeActive ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <div className="flex items-center justify-center space-x-2 text-blue-800 mb-2">
                      <Calendar className="h-5 w-5" />
                      <span className="font-medium">Select a Day and Apply Filter to View Charts</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                      1. Choose a day in the filter panel<br/>
                      2. Set your time window (e.g., 09:00 - 13:00)<br/>
                      3. Click "Apply Filter & Show Charts" to view minute-level analysis
                    </p>
                    {selectedDayForCharts && (
                      <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded text-sm text-green-800">
                        📅 Ready to analyze: {selectedDayForCharts}
                        <br/>
                        <button
                          onClick={() => {
                            setIsChartModeActive(false)
                            setSelectedDayForCharts('')
                          }}
                          className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Clear Selection
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Top Priority: Clear Communication Activity Chart */}
                    <CommunicationActivityChart data={filteredData} />
                    <StatsSummary data={filteredData} />
                    {/* Full-width time series chart for better visibility */}
                    <TimeSeriesChart data={filteredTimeWindowStats} chartType="scatter" />
                    {/* Category-based time series chart */}
                    <FilteredTimeSeriesChart data={filteredData} />
                
                    {/* Charts in a grid layout */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Category distribution chart */}
                      <CategoryChart data={filteredData} chartType="pie" />
                      {/* Country distribution chart */}
                      <CountryChart data={filteredData} />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeView === 'charts' && (
              <div className="space-y-6">
                {!isChartModeActive ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <div className="flex items-center justify-center space-x-2 text-blue-800 mb-2">
                      <Calendar className="h-5 w-5" />
                      <span className="font-medium">Select a Day and Apply Filter to View Charts</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                      Use the filter panel to select a day and time window, then click "Apply Filter & Show Charts" 
                      to view detailed minute-level analysis.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Chart Controls */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Chart Options</h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Time Series:</label>
                        <select
                          value={timeSeriesChartType}
                          onChange={(e) => setTimeSeriesChartType(e.target.value as 'scatter' | 'bar')}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="scatter">Scatter Plot</option>
                          <option value="bar">Bar Chart</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Categories:</label>
                        <select
                          value={categoryChartType}
                          onChange={(e) => setCategoryChartType(e.target.value as 'pie' | 'bar')}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="pie">Pie Chart</option>
                          <option value="bar">Bar Chart</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="space-y-6">
                  {/* Full-width time series chart with zoom controls */}
                  <TimeSeriesChart data={filteredTimeWindowStats} chartType={timeSeriesChartType} />
                  {/* Category-based time series chart */}
                  <FilteredTimeSeriesChart data={filteredData} />
                  {/* Category and Country charts */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <CategoryChart data={filteredData} chartType={categoryChartType} />
                        <CountryChart data={filteredData} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeView === 'trends' && (
              <TrendAnalysis data={filteredData} timeWindowStats={timeWindowStats} />
            )}

            {activeView === 'table' && (
              <DataTable data={filteredData} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
