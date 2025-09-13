'use client'

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts'
import { ProcessedLogEntry, DOMAIN_CATEGORIES, TimeWindowStats } from '@/types/dns-log'
import { Zap, Filter, Shield } from 'lucide-react'
import { calculateTimeWindowStats } from '@/utils/csv-parser'
// Timestamps are now already converted to SAST in the data processing pipeline

interface FilteredTimeSeriesChartProps {
  data: ProcessedLogEntry[]
}

export default function FilteredTimeSeriesChart({ data }: FilteredTimeSeriesChartProps) {
  // Get time window stats with VPN detection
  const timeWindowStats = calculateTimeWindowStats(data)
  
  // Group data by time windows and categories, including VPN/Secret indicators
  const timeWindowData = data.reduce((acc, entry) => {
    const timeWindow = entry.timeWindow
    
    if (!acc[timeWindow]) {
      acc[timeWindow] = {
        timeWindow,
        total: 0,
        ...Object.keys(DOMAIN_CATEGORIES).reduce((catAcc, category) => {
          catAcc[category] = 0
          return catAcc
        }, {} as Record<string, number>)
      }
    }
    
    acc[timeWindow].total++
    acc[timeWindow][entry.category]++
    
    return acc
  }, {} as Record<string, any>)

  // Merge with VPN/Secret detection data
  const chartData = Object.values(timeWindowData)
    .map(windowData => {
      const stats = timeWindowStats.find(stat => stat.timeWindow === windowData.timeWindow)
      const maxValue = Math.max(...Object.keys(DOMAIN_CATEGORIES).map(cat => windowData[cat] || 0))
      
      return {
        ...windowData,
        vpnIndicator: stats?.isPossibleVPN ? maxValue * 1.1 : null,
        secretIndicator: stats?.isActingSecret ? maxValue * 1.2 : null
      }
    })
    .sort((a, b) => a.timeWindow.localeCompare(b.timeWindow))

  // Find VPN attempt time ranges for overlay
  const vpnAttempts = timeWindowStats
    .filter(stat => stat.isPossibleVPN)
    .map(stat => stat.timeWindow)

  const formatXAxisLabel = (tickItem: string) => {
    const [datePart, timePart] = tickItem.split(' ')
    // tickItem is already in SAST format
    return timePart + ' SAST'
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const [datePart, timePart] = label.split(' ')
      // label is already in SAST format
      
      // Find VPN/Secret info for this time window
      const windowStats = timeWindowStats.find(stat => stat.timeWindow === label)
      const isVPNAttempt = windowStats?.isPossibleVPN
      const isActingSecret = windowStats?.isActingSecret
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <p className="font-medium text-gray-900 mb-2">
            {datePart} {timePart}:00 SAST
          </p>
          {payload
            .filter((entry: any) => entry.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.dataKey}: {entry.value.toLocaleString()}
              </p>
            ))}
          
          {/* Show VPN/Secret behavior indicators */}
          {(isVPNAttempt || isActingSecret) && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              {isVPNAttempt && (
                <div className="flex items-center space-x-2 mb-1">
                  <Shield className="h-3 w-3 text-orange-600" />
                  <span className="text-xs font-medium text-orange-700">VPN Attempt Detected</span>
                </div>
              )}
              {isActingSecret && (
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-red-600 rounded-full" />
                  <span className="text-xs font-medium text-red-700">Acting Secret</span>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // Color palette for different categories
  const categoryColors = {
    'WhatsApp Domain Access': '#25D366',
    'Facebook Domain Access': '#1877F2',
    'Other Messaging': '#8B5CF6',
    'Social Media': '#EC4899',
    'Streaming & Entertainment': '#F59E0B',
    'Google Services': '#EA4335',
    'Cloud & CDN': '#6B7280',
    'Advertising & Analytics': '#EF4444',
    'Security & Monitoring': '#10B981',
    'Other': '#9CA3AF'
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">DNS Requests Over Time (By Category)</h3>
          <p className="text-sm text-gray-600 mt-1">
            Shows activity patterns for different types of services and applications
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>Category Breakdown</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span>Zoom & Pan Enabled</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timeWindow" 
            tickFormatter={formatXAxisLabel}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Background bars for VPN attempts */}
          <Bar
            dataKey="vpnIndicator"
            fill="#FEE2E2"
            fillOpacity={0.4}
            stroke="#FCA5A5"
            strokeWidth={1}
            name="VPN Attempt"
            isAnimationActive={false}
          />
          
          {/* Background bars for Acting Secret */}
          <Bar
            dataKey="secretIndicator"
            fill="#FECACA"
            fillOpacity={0.6}
            stroke="#F87171"
            strokeWidth={2}
            name="Acting Secret"
            isAnimationActive={false}
          />
          
          {Object.entries(categoryColors).map(([category, color]) => (
            <Line
              key={category}
              type="monotone"
              dataKey={category}
              stroke={color}
              strokeWidth={2}
              name={category}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
          
          {/* Add brush for zooming */}
          <Brush 
            dataKey="timeWindow" 
            height={50} 
            stroke="#3b82f6"
            fill="#e0f2fe"
            tickFormatter={formatXAxisLabel}
            startIndex={Math.max(0, chartData.length - 20)}
            endIndex={chartData.length - 1}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Legend explaining the categories and overlays */}
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">Category Guide:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
            <div><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: categoryColors['WhatsApp Domain Access']}}></span>WhatsApp</div>
            <div><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: categoryColors['Facebook Domain Access']}}></span>Facebook/Messenger</div>
            <div><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: categoryColors['Other Messaging']}}></span>Other Messaging</div>
            <div><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: categoryColors['Social Media']}}></span>Social Media</div>
            <div><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: categoryColors['Streaming & Entertainment']}}></span>Streaming</div>
            <div><span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: categoryColors['Google Services']}}></span>Google</div>
          </div>
        </div>
        
        {/* Background Overlay Legend */}
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            Privacy & Security Overlays:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-3 bg-red-100 border border-red-300 border-dashed"></div>
              <span className="text-red-700">Light Red: VPN Attempt</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-3 bg-red-200 border-2 border-red-400 border-dashed"></div>
              <span className="text-red-800">Dark Red: Acting Secret</span>
            </div>
          </div>
          <p className="text-xs text-red-600 mt-2">
            Background overlays show time periods with suspicious privacy-seeking behavior
          </p>
        </div>
      </div>
    </div>
  )
}
