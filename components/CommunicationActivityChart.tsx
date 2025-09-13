'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, Brush } from 'recharts'
import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { MessageCircle, Phone, Image, Users, AlertCircle } from 'lucide-react'
import { calculateTimeWindowStats } from '@/utils/csv-parser'
// Timestamps are now already converted to SAST in the data processing pipeline

interface CommunicationActivityChartProps {
  data: ProcessedLogEntry[]
}

export default function CommunicationActivityChart({ data }: CommunicationActivityChartProps) {
  // Get time window stats with all detection algorithms
  const timeWindowStats = calculateTimeWindowStats(data)
  
  // Create simplified communication activity data
  const communicationData = timeWindowStats.map((stat, index) => {
    let activityType = 'No Activity'
    let activityLevel = 0
    let color = '#E5E7EB' // Gray for no activity
    let description = 'No messaging detected'
    
    // Debug logging removed for performance

    // Balance WhatsApp and Facebook detection equally
    
    // Check both platforms and pick the highest activity
    const whatsappScore = stat.whatsappActivity.activityScore
    const facebookScore = stat.facebookActivity.activityScore
    
    // WhatsApp activities
    if (stat.whatsappActivity.isVoiceCall || stat.whatsappActivity.isVideoCall) {
      activityType = 'WhatsApp Call'
      activityLevel = 5
      color = '#10B981' // Green
      description = stat.whatsappActivity.isVideoCall ? 'WhatsApp Video Call' : 'WhatsApp Voice Call'
    } 
    // Facebook activities (equal priority)
    else if (stat.facebookActivity.isReelsScrolling) {
      activityType = 'Facebook Reels'
      activityLevel = 3 // Lower than messaging but visible
      color = '#F97316' // Orange for Reels
      description = 'Facebook/Instagram Reels Scrolling'
    } 
    else if (stat.facebookActivity.isMediaTransfer) {
      activityType = 'Facebook Media'
      activityLevel = 5 // Same as WhatsApp media
      color = '#EC4899' // Pink
      description = 'Facebook/Messenger Possible Media Transfer'
    } 
    else if (stat.whatsappActivity.isMediaTransfer) {
      activityType = 'WhatsApp Media'
      activityLevel = 4
      color = '#8B5CF6' // Purple
      description = 'WhatsApp Photo/Voice Note/Video'
    }
    else if (stat.facebookActivity.isMessaging) {
      activityType = 'Facebook Message'
      activityLevel = 4 // Same as WhatsApp messages
      color = '#1877F2' // Facebook Blue
      description = 'Facebook/Messenger Messages'
    } 
    else if (stat.whatsappActivity.isTextMessage) {
      activityType = 'WhatsApp Message'
      activityLevel = 3
      color = '#25D366' // WhatsApp Green
      description = 'WhatsApp Text Messages'
    }
    else if (stat.relationshipConcerns.concernScore > 0) {
      const concerns = stat.relationshipConcerns
      if (concerns.datingApps.length > 0) {
        activityType = '🚨 Dating App'
        activityLevel = 8 // Very high priority
        color = '#DC2626' // Red for high concern
        description = `${concerns.datingApps[0].toUpperCase()} Activity Detected`
      } else if (concerns.anonymousPlatforms.length > 0) {
        activityType = '🚨 Anonymous'
        activityLevel = 7 // High priority
        color = '#B91C1C' // Dark red
        description = `${concerns.anonymousPlatforms[0].toUpperCase()} Activity Detected`
      } else if (concerns.alternativeMessaging.length > 0) {
        activityType = '⚠️ Alt Messaging'
        activityLevel = 6 // Medium-high priority
        color = '#D97706' // Orange
        description = `${concerns.alternativeMessaging[0].toUpperCase()} Activity Detected`
      } else if (concerns.videoCalling.length > 0) {
        activityType = '📹 Video Call'
        activityLevel = 5 // Medium priority
        color = '#7C3AED' // Purple
        description = `${concerns.videoCalling[0].toUpperCase()} Activity Detected`
      } else if (concerns.socialMessaging.length > 0) {
        activityType = '📱 Social Media'
        activityLevel = 4 // Lower priority
        color = '#059669' // Green
        description = `${concerns.socialMessaging[0].toUpperCase()} Activity Detected`
      }
    }
    else if (stat.facebookActivity.isInstagramActivity) {
      activityType = 'Instagram'
      activityLevel = 3 // Boost Instagram priority
      color = '#E1306C' // Instagram Pink
      description = 'Instagram Messages/Stories'
    }
    // Other real chat activity
    else if (stat.isRealChat) {
      activityType = 'Other Messaging'
      activityLevel = 2
      color = '#F59E0B' // Orange
      description = 'Other Messaging Apps'
    }

    return {
      timeWindow: stat.timeWindow,
      activityType,
      activityLevel,
      color,
      description: stat.isReelsMasking ? `${description} ⚠️ (Potential Reels Masking)` : description,
      totalRequests: stat.totalRequests,
      // Add privacy indicators
      hasVPN: stat.isPossibleVPN,
      isSecret: stat.isActingSecret,
      isReelsMasking: stat.isReelsMasking
    }
  }).sort((a, b) => a.timeWindow.localeCompare(b.timeWindow))

  const formatTime = (timeWindow: string) => {
    const [datePart, timePart] = timeWindow.split(' ')
    // timeWindow is already in SAST format
    const [hour, minute] = timePart.split(':')
    const hour12 = parseInt(hour) === 0 ? 12 : parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)
    const ampm = parseInt(hour) >= 12 ? 'PM' : 'AM'
    return `${hour12}:${minute} ${ampm} SAST`
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const [datePart, timePart] = data.timeWindow.split(' ')
      // timeWindow is already in SAST format
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            {datePart} at {formatTime(data.timeWindow)}
          </p>
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: data.color }}>
              {data.description}
            </p>
            <p className="text-xs text-gray-600">
              Total DNS requests: {data.totalRequests}
            </p>
            {data.hasVPN && (
              <p className="text-xs text-orange-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>VPN detected during this activity</span>
              </p>
            )}
            {data.isSecret && (
              <p className="text-xs text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>Suspicious privacy behavior</span>
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  // Count activity types for summary
  const activitySummary = communicationData.reduce((acc, item) => {
    if (item.activityLevel > 0) {
      acc[item.activityType] = (acc[item.activityType] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const totalActivityPeriods = Object.values(activitySummary).reduce((sum, count) => sum + count, 0)

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-blue-200">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
              <MessageCircle className="h-6 w-6 text-blue-600" />
              <span>Real Communication Activity (Minute-Level Detail)</span>
            </h2>
            <p className="text-gray-600 mt-1">
              Clear view of when actual messaging, calls, and media sharing occurred. Use the brush below to zoom into specific time periods.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{totalActivityPeriods}</p>
            <p className="text-sm text-gray-600">Active periods</p>
            <div className="flex items-center justify-end space-x-2 mt-2 text-xs text-gray-500">
              <span>🔍 Drag brush below to zoom</span>
            </div>
          </div>
        </div>
        
        {/* Activity Summary */}
        {totalActivityPeriods > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Activity Summary:</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(activitySummary).map(([type, count]) => (
                <div key={type} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ 
                    backgroundColor: communicationData.find(d => d.activityType === type)?.color 
                  }}></div>
                  <span className="text-blue-800">{type}: {count} periods</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={500}>
        <BarChart data={communicationData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <XAxis 
            dataKey="timeWindow"
            tickFormatter={formatTime}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="activityLevel" 
            radius={[4, 4, 0, 0]}
            stroke="#ffffff"
            strokeWidth={1}
          >
            {communicationData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                opacity={entry.hasVPN || entry.isSecret ? 0.8 : 1.0}
              />
            ))}
          </Bar>
          
          {/* Add zoom/brush functionality */}
          <Brush 
            dataKey="timeWindow" 
            height={50} 
            stroke="#3b82f6"
            fill="#e0f2fe"
            tickFormatter={formatTime}
            startIndex={Math.max(0, communicationData.length - 15)}
            endIndex={communicationData.length - 1}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Simple Legend for Non-Technical Users */}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-gray-700">WhatsApp Calls</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 rounded bg-purple-500"></div>
            <span className="text-gray-700">Photos/Voice Notes</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 rounded bg-blue-600"></div>
            <span className="text-gray-700">Text Messages</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 rounded bg-pink-500"></div>
            <span className="text-gray-700">Facebook/Instagram</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-gray-700">Other Apps</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-4 h-4 rounded bg-gray-300"></div>
            <span className="text-gray-700">No Activity</span>
          </div>
        </div>
        
        {/* Privacy Warning */}
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-xs text-yellow-800 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>
              <strong>Privacy Note:</strong> Bars with reduced opacity indicate VPN or suspicious privacy behavior was detected during that communication period.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
