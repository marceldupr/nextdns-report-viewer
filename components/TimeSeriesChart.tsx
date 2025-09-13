'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceDot, Brush } from 'recharts'
import { TimeWindowStats } from '@/types/dns-log'
import { MessageCircle, Zap, Shield, Eye, EyeOff } from 'lucide-react'

// Timestamps are now already in SAST format from data processing

interface TimeSeriesChartProps {
  data: TimeWindowStats[]
  chartType: 'scatter' | 'bar'
}

export default function TimeSeriesChart({ data, chartType }: TimeSeriesChartProps) {
  const formatTooltip = (value: number, name: string) => {
    const labels: Record<string, string> = {
      totalRequests: 'Total Requests',
      blockedRequests: 'Blocked Requests',
      allowedRequests: 'Allowed Requests',
      uniqueDomains: 'Unique Domains',
      chatScore: 'Chat Score'
    }
    return [value, labels[name] || name]
  }

  const formatXAxisLabel = (tickItem: string) => {
    // tickItem is in format "2025-09-12 14:30" (already in SAST)
    const [datePart, timePart] = tickItem.split(' ')
    return timePart + ' SAST'
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && label) {
      const data = payload[0].payload
      const [datePart, timePart] = label.split(' ')
      // label is already in SAST format
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">
            {datePart} {timePart}:00 SAST
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {formatTooltip(entry.value, entry.dataKey)[1]}: {entry.value.toLocaleString()}
            </p>
          ))}
          {data.isRealChat && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">REAL CHAT DETECTED</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Chat Score: {data.chatScore}/10
              </p>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // Custom dot for REAL CHAT indicators
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    if (payload.isRealChat) {
      return (
        <g>
          <circle 
            cx={cx} 
            cy={cy} 
            r={8} 
            fill="#10b981" 
            stroke="#ffffff" 
            strokeWidth={2}
          />
          <MessageCircle 
            x={cx - 6} 
            y={cy - 6} 
            width={12} 
            height={12} 
            className="text-white"
          />
        </g>
      )
    }
    return null
  }

  const realChatPoints = data.filter(point => point.isRealChat)
  const totalChatEvents = realChatPoints.length

  if (chartType === 'bar') {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">DNS Requests Over Time (Bar Chart)</h3>
            {totalChatEvents > 0 && (
              <p className="text-sm text-green-600 flex items-center space-x-1 mt-1">
                <MessageCircle className="h-4 w-4" />
                <span>{totalChatEvents} Real Chat Events Detected</span>
              </p>
            )}
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={600}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
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
            <Bar dataKey="totalRequests" fill="#3b82f6" name="Total Requests" />
            <Bar dataKey="blockedRequests" fill="#ef4444" name="Blocked Requests" />
            <Bar dataKey="allowedRequests" fill="#10b981" name="Allowed Requests" />
            
            {/* Add REAL CHAT indicators */}
            {realChatPoints.map((point, index) => (
              <ReferenceDot
                key={index}
                x={point.timeWindow}
                y={point.totalRequests}
                r={12}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={3}
              />
            ))}
            
            <Brush 
              dataKey="timeWindow" 
              height={30} 
              stroke="#3b82f6"
              tickFormatter={formatXAxisLabel}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">DNS Requests Over Time (Scatter Plot - Minute Level)</h3>
          {totalChatEvents > 0 && (
            <p className="text-sm text-green-600 flex items-center space-x-1 mt-1">
              <MessageCircle className="h-4 w-4" />
              <span>{totalChatEvents} Real Chat Events Detected</span>
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Real Chat Event</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span>Drag brush below to zoom</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={700}>
        <ScatterChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timeWindow" 
            type="category"
            tickFormatter={formatXAxisLabel}
            angle={-45}
            textAnchor="end"
            height={100}
            interval="preserveStartEnd"
          />
          <YAxis type="number" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <Scatter 
            dataKey="totalRequests" 
            fill="#3b82f6" 
            name="Total Requests"
          />
          <Scatter 
            dataKey="blockedRequests" 
            fill="#ef4444" 
            name="Blocked Requests"
          />
          <Scatter 
            dataKey="allowedRequests" 
            fill="#10b981" 
            name="Allowed Requests"
          />
          <Scatter 
            dataKey="uniqueDomains" 
            fill="#f59e0b" 
            name="Unique Domains"
          />
          
          {/* REAL CHAT indicator scatter */}
          <Scatter 
            dataKey="chatScore" 
            fill="#10b981" 
            name="Chat Score"
          />
          
          {/* Add brush for zooming */}
          <Brush 
            dataKey="timeWindow" 
            height={50} 
            stroke="#3b82f6"
            fill="#e0f2fe"
            tickFormatter={formatXAxisLabel}
            startIndex={Math.max(0, data.length - 20)}
            endIndex={data.length - 1}
          />
        </ScatterChart>
      </ResponsiveContainer>
      
      {/* Legend for REAL CHAT events */}
      {totalChatEvents > 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span>Real Chat Activity Detected</span>
          </h4>
          <p className="text-xs text-green-700">
            Green circles indicate time windows where both WhatsApp or Facebook messaging domains 
            were accessed with patterns suggesting actual conversation activity (not just background sync).
          </p>
        </div>
      )}
    </div>
  )
}