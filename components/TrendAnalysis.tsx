'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, Clock } from 'lucide-react'
import { calculateDailyTrends, calculateTrendComparisons, calculateWeeklyPatterns, detectAnomalies } from '@/utils/trend-analysis'

interface TrendAnalysisProps {
  data: ProcessedLogEntry[]
  timeWindowStats: TimeWindowStats[]
}

export default function TrendAnalysis({ data, timeWindowStats }: TrendAnalysisProps) {
  const dailyTrends = calculateDailyTrends(data, timeWindowStats)
  const trendComparisons = calculateTrendComparisons(dailyTrends)
  const weeklyPatterns = calculateWeeklyPatterns(dailyTrends)
  const anomalies = detectAnomalies(dailyTrends)

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (dailyTrends.length < 2) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Trend Analysis</h3>
          <p className="text-gray-600">
            Need at least 2 days of data to show trends. Currently have {dailyTrends.length} day(s).
          </p>
        </div>
      </div>
    )
  }

  const latestComparison = trendComparisons[trendComparisons.length - 1]

  return (
    <div className="space-y-6">
      {/* Trend Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">WhatsApp Activity</p>
              <p className="text-2xl font-semibold text-gray-900">{latestComparison.current.whatsappActivity}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getTrendColor(latestComparison.changes.whatsappActivity.trend)}`}>
              {getTrendIcon(latestComparison.changes.whatsappActivity.trend)}
              <span className="text-sm font-medium">
                {latestComparison.changes.whatsappActivity.percentage !== 0 && 
                  `${Math.abs(latestComparison.changes.whatsappActivity.percentage)}%`
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Facebook Activity</p>
              <p className="text-2xl font-semibold text-gray-900">{latestComparison.current.facebookActivity}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getTrendColor(latestComparison.changes.facebookActivity.trend)}`}>
              {getTrendIcon(latestComparison.changes.facebookActivity.trend)}
              <span className="text-sm font-medium">
                {latestComparison.changes.facebookActivity.percentage !== 0 && 
                  `${Math.abs(latestComparison.changes.facebookActivity.percentage)}%`
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Communication</p>
              <p className="text-2xl font-semibold text-gray-900">{latestComparison.current.totalCommunication}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getTrendColor(latestComparison.changes.totalCommunication.trend)}`}>
              {getTrendIcon(latestComparison.changes.totalCommunication.trend)}
              <span className="text-sm font-medium">
                {latestComparison.changes.totalCommunication.percentage !== 0 && 
                  `${Math.abs(latestComparison.changes.totalCommunication.percentage)}%`
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">VPN Attempts</p>
              <p className="text-2xl font-semibold text-gray-900">{latestComparison.current.vpnAttempts}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getTrendColor(latestComparison.changes.vpnAttempts.trend)}`}>
              {getTrendIcon(latestComparison.changes.vpnAttempts.trend)}
              <span className="text-sm font-medium">
                {latestComparison.changes.vpnAttempts.percentage !== 0 && 
                  `${Math.abs(latestComparison.changes.vpnAttempts.percentage)}%`
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Countries</p>
              <p className="text-2xl font-semibold text-gray-900">{latestComparison.current.uniqueCountries}</p>
            </div>
            <div className="text-gray-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Communication Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="whatsappActivity" stroke="#25D366" strokeWidth={3} name="WhatsApp" />
            <Line type="monotone" dataKey="facebookActivity" stroke="#1877F2" strokeWidth={3} name="Facebook" />
            <Line type="monotone" dataKey="vpnAttempts" stroke="#F97316" strokeWidth={2} name="VPN Attempts" />
            <Line type="monotone" dataKey="secretBehavior" stroke="#EF4444" strokeWidth={2} name="Secret Behavior" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Patterns & Anomalies */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Weekly Pattern Radar */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity Patterns</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={weeklyPatterns}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dayOfWeek" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} />
              <Radar name="Average Activity" dataKey="averageActivity" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-xs text-gray-600">
            <p>Shows average communication activity by day of week</p>
          </div>
        </div>

        {/* Anomalies List */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span>Detected Anomalies</span>
          </h3>
          
          {anomalies.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {anomalies.slice(0, 10).map((anomaly, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${
                  anomaly.severity === 'high' ? 'bg-red-50 border-red-500' :
                  anomaly.severity === 'medium' ? 'bg-orange-50 border-orange-500' :
                  'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{anomaly.date}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      anomaly.severity === 'high' ? 'bg-red-100 text-red-800' :
                      anomaly.severity === 'medium' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{anomaly.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No significant anomalies detected in the data.</p>
          )}
        </div>
      </div>
    </div>
  )
}
