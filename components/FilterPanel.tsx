'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Monitor, Tag, Filter, X, MessageCircle, Shield, EyeOff, Phone, Image, Mic, Users, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { FilterOptions, ProcessedLogEntry, DOMAIN_CATEGORIES } from '@/types/dns-log'
import { getAvailableDatesAndHours } from '@/utils/csv-parser'

interface FilterPanelProps {
  data: ProcessedLogEntry[]
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  onChartModeChange?: (isActive: boolean, selectedDate: string) => void
}

export default function FilterPanel({ data, filters, onFiltersChange, onChartModeChange }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [availableDevices, setAvailableDevices] = useState<string[]>([])
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [dateHourMap, setDateHourMap] = useState<Record<string, string[]>>({})
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [isChartModeActive, setIsChartModeActive] = useState<boolean>(false)

  useEffect(() => {
    if (data.length === 0) return
    
    // Extract unique devices, countries, and available dates/hours from data
    const devices = [...new Set(data.map(entry => entry.device_name).filter(Boolean))]
    const countries = [...new Set(data.map(entry => entry.destination_country).filter(Boolean))]
    const { availableDates: dates, dateHourMap: hourMap } = getAvailableDatesAndHours(data)
    
    setAvailableDevices(devices.sort())
    setAvailableCountries(countries.sort())
    setAvailableDates(dates)
    setDateHourMap(hourMap)
    
    // Set first available date as default
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0])
    }
  }, [data, selectedDate])

  const updateFilters = (updates: Partial<FilterOptions>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: { start: null, end: null },
      timeRange: { start: '00:00', end: '23:59' },
      devices: [],
      categories: [],
      status: [],
      protocols: [],
      countries: []
    })
  }

  const activeFiltersCount = [
    filters.devices.length,
    filters.categories.length,
    filters.status.length,
    filters.protocols.length,
    filters.countries.length,
    filters.dateRange.start || filters.dateRange.end ? 1 : 0
  ].reduce((sum, count) => sum + count, 0)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            {activeFiltersCount > 0 && (
              <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {activeFiltersCount} active
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-red-600 flex items-center space-x-1"
              >
                <X className="h-4 w-4" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Available Days */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4" />
              <span>Available Days</span>
            </label>
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                updateFilters({
                  dateRange: {
                    start: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
                    end: e.target.value ? new Date(e.target.value + 'T23:59:59') : null
                  }
                })
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">All Available Days</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </option>
              ))}
            </select>
          </div>

          {/* Time Window Filter for Selected Day */}
          {selectedDate && (
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4" />
                <span>Time Window for {selectedDate}</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={filters.timeRange.start}
                    onChange={(e) => updateFilters({
                      timeRange: { ...filters.timeRange, start: e.target.value }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={filters.timeRange.end}
                    onChange={(e) => updateFilters({
                      timeRange: { ...filters.timeRange, end: e.target.value }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  onClick={() => updateFilters({ timeRange: { start: '09:00', end: '17:00' } })}
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  Business Hours
                </button>
                <button
                  onClick={() => updateFilters({ timeRange: { start: '18:00', end: '22:00' } })}
                  className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                >
                  Evening
                </button>
                <button
                  onClick={() => updateFilters({ timeRange: { start: '00:00', end: '23:59' } })}
                  className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                >
                  All Day
                </button>
              </div>
              <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">
                <strong>Current Window:</strong> {filters.timeRange.start} - {filters.timeRange.end} SAST
                <br />
                Charts will show minute-level detail within this time range.
              </div>
              
              {/* Apply Filter Button */}
              <div className="mt-4">
                <button
                  onClick={() => {
                    if (selectedDate) {
                      setIsChartModeActive(true)
                      updateFilters({
                        dateRange: {
                          start: new Date(selectedDate + 'T00:00:00'),
                          end: new Date(selectedDate + 'T23:59:59')
                        }
                      })
                      // Notify parent component about chart mode activation
                      onChartModeChange?.(true, selectedDate)
                    }
                  }}
                  disabled={!selectedDate}
                  className={`w-full px-4 py-2 rounded font-medium transition-colors ${
                    selectedDate
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isChartModeActive ? '✅ Charts Active' : 'Apply Filter & Show Charts'}
                </button>
                {isChartModeActive && (
                  <p className="text-xs text-green-600 mt-1 text-center">
                    Charts are now showing minute-level data for {selectedDate}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Categories */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Tag className="h-4 w-4" />
              <span>Categories</span>
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.keys(DOMAIN_CATEGORIES).map((category) => (
                <label key={category} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFilters({
                          categories: [...filters.categories, category]
                        })
                      } else {
                        updateFilters({
                          categories: filters.categories.filter(c => c !== category)
                        })
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Behavioral Patterns */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <EyeOff className="h-4 w-4" />
              <span>Behavioral Patterns</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.behaviorPatterns?.includes('real_chat') || false}
                  onChange={(e) => {
                    const currentPatterns = filters.behaviorPatterns || []
                    if (e.target.checked) {
                      updateFilters({
                        behaviorPatterns: [...currentPatterns, 'real_chat']
                      })
                    } else {
                      updateFilters({
                        behaviorPatterns: currentPatterns.filter(p => p !== 'real_chat')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <MessageCircle className="h-3 w-3 text-green-600" />
                  <span>Real Chat Activity</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.behaviorPatterns?.includes('possible_vpn') || false}
                  onChange={(e) => {
                    const currentPatterns = filters.behaviorPatterns || []
                    if (e.target.checked) {
                      updateFilters({
                        behaviorPatterns: [...currentPatterns, 'possible_vpn']
                      })
                    } else {
                      updateFilters({
                        behaviorPatterns: currentPatterns.filter(p => p !== 'possible_vpn')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <Shield className="h-3 w-3 text-orange-600" />
                  <span>Possible VPN Attempt</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.behaviorPatterns?.includes('acting_secret') || false}
                  onChange={(e) => {
                    const currentPatterns = filters.behaviorPatterns || []
                    if (e.target.checked) {
                      updateFilters({
                        behaviorPatterns: [...currentPatterns, 'acting_secret']
                      })
                    } else {
                      updateFilters({
                        behaviorPatterns: currentPatterns.filter(p => p !== 'acting_secret')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <EyeOff className="h-3 w-3 text-red-600" />
                  <span>Acting Secret</span>
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Filter time windows by detected behavioral patterns
            </p>
          </div>

          {/* WhatsApp Activity Patterns */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp Activity Types</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.whatsappActivity?.includes('text_message') || false}
                  onChange={(e) => {
                    const currentActivity = filters.whatsappActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        whatsappActivity: [...currentActivity, 'text_message']
                      })
                    } else {
                      updateFilters({
                        whatsappActivity: currentActivity.filter(a => a !== 'text_message')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <MessageCircle className="h-3 w-3 text-blue-600" />
                  <span>Text Messages</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.whatsappActivity?.includes('media_transfer') || false}
                  onChange={(e) => {
                    const currentActivity = filters.whatsappActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        whatsappActivity: [...currentActivity, 'media_transfer']
                      })
                    } else {
                      updateFilters({
                        whatsappActivity: currentActivity.filter(a => a !== 'media_transfer')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <Image className="h-3 w-3 text-purple-600" />
                  <span>Media/Voice Notes</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.whatsappActivity?.includes('voice_call') || false}
                  onChange={(e) => {
                    const currentActivity = filters.whatsappActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        whatsappActivity: [...currentActivity, 'voice_call']
                      })
                    } else {
                      updateFilters({
                        whatsappActivity: currentActivity.filter(a => a !== 'voice_call')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <Phone className="h-3 w-3 text-green-600" />
                  <span>Voice Calls</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.whatsappActivity?.includes('video_call') || false}
                  onChange={(e) => {
                    const currentActivity = filters.whatsappActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        whatsappActivity: [...currentActivity, 'video_call']
                      })
                    } else {
                      updateFilters({
                        whatsappActivity: currentActivity.filter(a => a !== 'video_call')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <Mic className="h-3 w-3 text-red-600" />
                  <span>Video Calls</span>
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Filter by specific WhatsApp activity types based on DNS patterns
            </p>
          </div>

          {/* Facebook Activity Patterns */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="h-4 w-4" />
              <span>Facebook/Messenger Activity</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.facebookActivity?.includes('messaging') || false}
                  onChange={(e) => {
                    const currentActivity = filters.facebookActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        facebookActivity: [...currentActivity, 'messaging']
                      })
                    } else {
                      updateFilters({
                        facebookActivity: currentActivity.filter(a => a !== 'messaging')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <MessageCircle className="h-3 w-3 text-blue-600" />
                  <span>Active Messaging</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.facebookActivity?.includes('media_transfer') || false}
                  onChange={(e) => {
                    const currentActivity = filters.facebookActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        facebookActivity: [...currentActivity, 'media_transfer']
                      })
                    } else {
                      updateFilters({
                        facebookActivity: currentActivity.filter(a => a !== 'media_transfer')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <Image className="h-3 w-3 text-purple-600" />
                  <span>Media Transfers</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.facebookActivity?.includes('instagram') || false}
                  onChange={(e) => {
                    const currentActivity = filters.facebookActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        facebookActivity: [...currentActivity, 'instagram']
                      })
                    } else {
                      updateFilters({
                        facebookActivity: currentActivity.filter(a => a !== 'instagram')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <Users className="h-3 w-3 text-pink-600" />
                  <span>Instagram Activity</span>
                </span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.facebookActivity?.includes('background') || false}
                  onChange={(e) => {
                    const currentActivity = filters.facebookActivity || []
                    if (e.target.checked) {
                      updateFilters({
                        facebookActivity: [...currentActivity, 'background']
                      })
                    } else {
                      updateFilters({
                        facebookActivity: currentActivity.filter(a => a !== 'background')
                      })
                    }
                  }}
                  className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                />
                <span className="text-sm text-gray-700 flex items-center space-x-1">
                  <RefreshCw className="h-3 w-3 text-gray-600" />
                  <span>Background Refresh</span>
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Filter by Facebook/Messenger activity patterns and background vs real usage
            </p>
          </div>

          {/* Devices */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Monitor className="h-4 w-4" />
              <span>Devices</span>
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableDevices.map((device) => (
                <label key={device} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.devices.includes(device)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFilters({
                          devices: [...filters.devices, device]
                        })
                      } else {
                        updateFilters({
                          devices: filters.devices.filter(d => d !== device)
                        })
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{device}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
            <div className="space-y-2">
              {['blocked', 'allowed'].map((status) => (
                <label key={status} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(status)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFilters({
                          status: [...filters.status, status]
                        })
                      } else {
                        updateFilters({
                          status: filters.status.filter(s => s !== status)
                        })
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Protocols */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Protocols</label>
            <div className="space-y-2">
              {['DNS-over-HTTPS', 'UDP', 'TCP'].map((protocol) => (
                <label key={protocol} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.protocols.includes(protocol)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFilters({
                          protocols: [...filters.protocols, protocol]
                        })
                      } else {
                        updateFilters({
                          protocols: filters.protocols.filter(p => p !== protocol)
                        })
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{protocol}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
