import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { format } from 'date-fns'

export interface HTMLReportOptions {
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
}

// Severity levels with colors - Removed 'Low' and 'Info' levels
const SEVERITY_LEVELS = {
  CRITICAL: { color: '#DC2626', bgColor: '#FEE2E2', label: 'Critical', stars: 5 }, // Red
  HIGH: { color: '#EA580C', bgColor: '#FED7AA', label: 'High', stars: 4 },        // Orange  
  MEDIUM: { color: '#D97706', bgColor: '#FEF3C7', label: 'Medium', stars: 3 },    // Amber
}

function getSeverityLevel(stat: TimeWindowStats): typeof SEVERITY_LEVELS.CRITICAL | null {
  // Dating apps and anonymous platforms = CRITICAL
  if (stat.relationshipConcerns.datingApps.length > 0 || 
      stat.relationshipConcerns.anonymousPlatforms.length > 0) {
    return SEVERITY_LEVELS.CRITICAL
  }
  
  // Alternative messaging or high concern scores = HIGH
  if (stat.relationshipConcerns.alternativeMessaging.length > 0 || 
      stat.relationshipConcerns.concernScore > 10) {
    return SEVERITY_LEVELS.HIGH
  }
  
  // Video calling or medium activity = MEDIUM
  if (stat.relationshipConcerns.videoCalling.length > 0 || 
      stat.facebookActivity.activityScore > 6 || 
      stat.whatsappActivity.activityScore > 6) {
    return SEVERITY_LEVELS.MEDIUM
  }
  
  // REMOVED: Low and Info severity levels
  // Regular messaging activity and background activity are now filtered out
  return null
}

function generateStars(count: number): string {
  const fullStars = '★'.repeat(count)
  const emptyStars = '☆'.repeat(5 - count)
  return fullStars + emptyStars
}

function generateTags(stat: TimeWindowStats): string[] {
  const tags: string[] = []
  
  // Platform tags
  if (stat.whatsappActivity.activityScore > 0) tags.push('WhatsApp')
  if (stat.facebookActivity.activityScore > 0) tags.push('Facebook')
  if (stat.facebookActivity.isInstagramActivity) tags.push('Instagram')
  if (stat.facebookActivity.isReelsScrolling) tags.push('Reels')
  
  // Activity type tags
  if (stat.whatsappActivity.isVoiceCall) tags.push('Voice Call')
  if (stat.whatsappActivity.isMediaTransfer) tags.push('Media Transfer')
  if (stat.facebookActivity.isMessaging) tags.push('Messaging')
  if (stat.facebookActivity.isCall) tags.push('Video Call')
  
  // Relationship concern tags
  if (stat.relationshipConcerns.datingApps.length > 0) {
    tags.push(...stat.relationshipConcerns.datingApps.map(app => app.toUpperCase()))
  }
  if (stat.relationshipConcerns.alternativeMessaging.length > 0) {
    tags.push(...stat.relationshipConcerns.alternativeMessaging.map(app => app.toUpperCase()))
  }
  if (stat.relationshipConcerns.videoCalling.length > 0) {
    tags.push(...stat.relationshipConcerns.videoCalling.map(app => app.toUpperCase()))
  }
  
  // Privacy/security tags
  if (stat.isPossibleVPN) tags.push('VPN Detected')
  if (stat.isActingSecret) tags.push('Privacy Behavior')
  if (stat.isReelsMasking) tags.push('Potential Masking')
  
  // Direction tags
  if (stat.whatsappActivity.callDirection) {
    tags.push(stat.whatsappActivity.callDirection === 'incoming' ? 'Incoming' : 'Outgoing')
  }
  
  return tags
}

function getActivityDescription(stat: TimeWindowStats): { title: string; description: string; algorithm: string } {
  // Dating apps (highest priority)
  if (stat.relationshipConcerns.datingApps.length > 0) {
    const app = stat.relationshipConcerns.datingApps[0]
    return {
      title: `${app.toUpperCase()} Dating App Activity Detected`,
      description: `DNS requests to ${app} indicate dating app usage. This suggests potential relationship concerns as dating apps are typically used for meeting new romantic partners outside of existing relationships.`,
      algorithm: 'Dating app domain pattern matching'
    }
  }
  
  // Anonymous platforms
  if (stat.relationshipConcerns.anonymousPlatforms.length > 0) {
    const platform = stat.relationshipConcerns.anonymousPlatforms[0]
    return {
      title: `${platform.toUpperCase()} Anonymous Platform Activity`,
      description: `Activity detected on ${platform}, an anonymous communication platform. These platforms allow secret messaging and anonymous interactions, which could indicate attempts to hide communication.`,
      algorithm: 'Anonymous platform domain detection'
    }
  }
  
  // Alternative messaging
  if (stat.relationshipConcerns.alternativeMessaging.length > 0) {
    const platform = stat.relationshipConcerns.alternativeMessaging[0]
    return {
      title: `${platform.toUpperCase()} Alternative Messaging Detected`,
      description: `Communication activity detected on ${platform}. While legitimate, alternative messaging platforms can be used for private communication outside of standard messaging apps.`,
      algorithm: 'Alternative messaging platform detection'
    }
  }
  
  // Video calling
  if (stat.relationshipConcerns.videoCalling.length > 0) {
    const platform = stat.relationshipConcerns.videoCalling[0]
    return {
      title: `${platform.toUpperCase()} Video Call Activity`,
      description: `Video calling activity detected on ${platform}. While often legitimate for business or family, private video calls could indicate personal relationships.`,
      algorithm: 'Video calling platform detection'
    }
  }
  
  // Facebook Reels
  if (stat.facebookActivity.isReelsScrolling) {
    return {
      title: 'Facebook/Instagram Reels Scrolling',
      description: 'Video content consumption detected through NetSeer CDN optimization patterns. This indicates scrolling through Reels or Stories, which is normal social media usage.',
      algorithm: 'Video CDN pattern analysis (NetSeer/static assets)'
    }
  }
  
  // Facebook messaging
  if (stat.facebookActivity.isCall) {
    return {
      title: 'Facebook/Messenger Video Call',
      description: 'Video call activity detected through STUN server connections and Messenger signaling. This indicates active video communication.',
      algorithm: 'STUN server detection + Messenger markers'
    }
  }
  
  if (stat.facebookActivity.isMediaTransfer && stat.facebookActivity.isMessaging) {
    return {
      title: 'Facebook Message with Possible Media Exchange',
      description: 'Message exchange with media transfer detected through upload (rupload.facebook.com) and download (scontent CDN) patterns combined with messaging context.',
      algorithm: 'Media upload/download + messaging context correlation'
    }
  }
  
  if (stat.facebookActivity.isMediaTransfer) {
    return {
      title: 'Facebook Possible Media Transfer',
      description: 'Media upload or download activity detected. This could indicate photos, videos, or documents being shared through Facebook Messenger.',
      algorithm: 'Media CDN pattern detection'
    }
  }
  
  if (stat.facebookActivity.isMessaging) {
    return {
      title: 'Facebook/Messenger Text Activity',
      description: 'Text messaging activity detected through real-time messaging protocols (MQTT) and messaging gateway access.',
      algorithm: 'MQTT + messaging gateway detection'
    }
  }
  
  // WhatsApp activities
  if (stat.whatsappActivity.isVoiceCall) {
    const direction = stat.whatsappActivity.callDirection || 'unknown direction'
    return {
      title: `WhatsApp Voice Note (${direction})`,
      description: `Voice note activity detected through WhatsApp signaling and media CDN patterns. ${direction === 'incoming' ? 'APNs notifications indicate this was received.' : 'Outgoing activity detected through upload patterns.'}`,
      algorithm: 'WhatsApp signaling + media CDN correlation'
    }
  }
  
  // Prioritize combined messaging over pure media transfer
  if (stat.whatsappActivity.isTextMessage && stat.whatsappActivity.isMediaTransfer) {
    const direction = stat.whatsappActivity.callDirection || 'bidirectional'
    return {
      title: `WhatsApp Conversation with Media (${direction})`,
      description: `Active WhatsApp conversation with media sharing detected. This includes text messages combined with photos, videos, voice notes, or documents. ${stat.whatsappActivity.activityScore > 6 ? 'High confidence due to strong activity patterns.' : 'Medium confidence based on persistent connection patterns.'}`,
      algorithm: 'WhatsApp messaging + media transfer correlation'
    }
  }
  
  if (stat.whatsappActivity.isMediaTransfer) {
    return {
      title: 'WhatsApp Media Transfer',
      description: 'Media transfer detected through WhatsApp multimedia gateway (mmg.whatsapp.net) or media CDN access. This indicates photos, videos, or voice notes being shared.',
      algorithm: 'WhatsApp media gateway + CDN detection'
    }
  }
  
  if (stat.whatsappActivity.isTextMessage) {
    const direction = stat.whatsappActivity.callDirection || 'bidirectional'
    return {
      title: `WhatsApp Text Message (${direction})`,
      description: `Text messaging activity detected through WhatsApp signaling domains. ${stat.whatsappActivity.activityScore > 6 ? 'High confidence due to APNs correlation.' : 'Medium confidence based on domain patterns.'}`,
      algorithm: 'WhatsApp signaling + conversation pattern analysis'
    }
  }
  
  // Instagram
  if (stat.facebookActivity.isInstagramActivity) {
    return {
      title: 'Instagram Messages/Stories Activity',
      description: 'Instagram messaging or Stories activity detected through Instagram API and messaging endpoints.',
      algorithm: 'Instagram API + messaging pattern detection'
    }
  }
  
  // Other messaging
  if (stat.isRealChat) {
    return {
      title: 'Other Messaging Activity',
      description: 'Communication activity detected on other messaging platforms or chat applications.',
      algorithm: 'Real chat pattern indicators'
    }
  }
  
  // Default
  return {
    title: 'Background Activity',
    description: 'Low-level background activity or app maintenance detected.',
    algorithm: 'Background pattern classification'
  }
}

export function generateHTMLReport(options: HTMLReportOptions): string {
  const { data, timeWindowStats, dateRange, selectedDevices, timeRange, appliedFilters } = options
  
  // IMPORTANT: Ensure activities match the actual filtered data date range
  let filteredActivities = timeWindowStats
  
  // Additional date range filtering to ensure consistency with raw data
  if (data.length > 0) {
    const dataTimestamps = data.map(entry => entry.parsedTimestamp).sort((a, b) => a.getTime() - b.getTime())
    const earliestDataDate = format(dataTimestamps[0], 'yyyy-MM-dd')
    const latestDataDate = format(dataTimestamps[dataTimestamps.length - 1], 'yyyy-MM-dd')
    
    // Filter activities to only include those within the actual data date range
    filteredActivities = timeWindowStats.filter(stat => {
      const [activityDate] = stat.timeWindow.split(' ')
      return activityDate >= earliestDataDate && activityDate <= latestDataDate
    })
  }
  
  // Filter for activities that have detectable communication
  const detectedActivities = filteredActivities.filter(stat => 
    stat.whatsappActivity.activityScore > 0 ||
    stat.facebookActivity.activityScore > 0 ||
    stat.relationshipConcerns.concernScore > 0 ||
    stat.facebookActivity.isReelsScrolling ||
    stat.isRealChat
  ).sort((a, b) => b.relationshipConcerns.concernScore - a.relationshipConcerns.concernScore) // Highest concerns first
  
  // Verify data consistency for debugging (can be removed in production)
  if (process.env.NODE_ENV === 'development' && detectedActivities.length > 0) {
    const firstActivity = detectedActivities[0]
    const lastActivity = detectedActivities[detectedActivities.length - 1]
    console.log('HTML Report Activity Range:', {
      first: firstActivity.timeWindow,
      last: lastActivity.timeWindow,
      total: detectedActivities.length,
      timeRange,
      appliedFilters: Object.keys(appliedFilters || {}).length
    })
  }
  
  // Group activities by hour for navigation
  const activitiesByHour = detectedActivities.reduce((acc, activity) => {
    const [datePart, timePart] = activity.timeWindow.split(' ')
    const hour = timePart.split(':')[0]
    const hourKey = `${hour}:00`
    
    if (!acc[hourKey]) {
      acc[hourKey] = []
    }
    acc[hourKey].push(activity)
    return acc
  }, {} as Record<string, TimeWindowStats[]>)
  
  // Sort hours for navigation
  const sortedHours = Object.keys(activitiesByHour).sort()
  
  // Calculate summary statistics
  const summary = {
    totalActivities: detectedActivities.length,
    criticalConcerns: detectedActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.CRITICAL).length,
    highConcerns: detectedActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.HIGH).length,
    whatsappActivities: detectedActivities.filter(s => s.whatsappActivity.activityScore > 0).length,
    facebookActivities: detectedActivities.filter(s => s.facebookActivity.activityScore > 0).length,
    relationshipConcerns: detectedActivities.filter(s => s.relationshipConcerns.concernScore > 0).length,
    reelsActivities: detectedActivities.filter(s => s.facebookActivity.isReelsScrolling).length,
    vpnDetections: detectedActivities.filter(s => s.isPossibleVPN).length,
    privacyBehavior: detectedActivities.filter(s => s.isActingSecret).length,
    maskingAttempts: detectedActivities.filter(s => s.isReelsMasking).length,
  }
  
  // Generate filename
  const generateFilename = () => {
    let devicePart = 'all'
    if (selectedDevices && selectedDevices.length > 0) {
      if (selectedDevices.length === 1) {
        devicePart = selectedDevices[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
      } else {
        devicePart = selectedDevices.length + '-devices'
      }
    }
    
    let timeRangePart = ''
    if (data.length > 0) {
      const timestamps = data.map(entry => entry.parsedTimestamp).sort((a, b) => a.getTime() - b.getTime())
      const startTime = format(timestamps[0], 'HH-mm')
      const endTime = format(timestamps[timestamps.length - 1], 'HH-mm')
      const dateYYMMDD = format(timestamps[0], 'yy-MM-dd')
      timeRangePart = `${dateYYMMDD}-from-${startTime}-to-${endTime}`
    } else {
      const now = new Date()
      const dateYYMMDD = format(now, 'yy-MM-dd')
      const currentTime = format(now, 'HH-mm')
      timeRangePart = `${dateYYMMDD}-from-${currentTime}-to-${currentTime}`
    }
    
    return `${devicePart}-${timeRangePart}-report.html`
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Communication Activity Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            min-height: 100vh;
            margin: 0;
            padding: 0;
        }
        
        .main-container {
            display: flex;
            min-height: 100vh;
        }
        
        .sidebar {
            width: 250px;
            background: white;
            border-right: 1px solid #e5e7eb;
            padding: 1.5rem;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
        }
        
        .content {
            margin-left: 250px;
            flex: 1;
            padding: 2rem;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .sidebar h3 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .time-nav {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .time-nav-item {
            margin-bottom: 0.5rem;
        }
        
        .time-nav-link {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem;
            border-radius: 0.5rem;
            text-decoration: none;
            color: #4b5563;
            font-weight: 500;
            transition: all 0.2s ease;
            border: 1px solid transparent;
        }
        
        .time-nav-link:hover {
            background: #f3f4f6;
            color: #1f2937;
            border-color: #d1d5db;
        }
        
        .time-nav-badge {
            background: #e5e7eb;
            color: #374151;
            padding: 0.25rem 0.5rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .time-nav-badge.critical {
            background: #fee2e2;
            color: #dc2626;
        }
        
        .time-nav-badge.high {
            background: #fed7aa;
            color: #ea580c;
        }
        
        .time-section {
            scroll-margin-top: 2rem;
        }
        
        .time-section-header {
            background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.75rem;
            margin: 2rem 0 1rem 0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .time-section-header h2 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 700;
        }
        
        .time-section-header .time-meta {
            font-size: 0.875rem;
            opacity: 0.9;
            margin-top: 0.25rem;
        }
        
        .header {
            background: white;
            border-radius: 1rem;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 800;
            color: #1f2937;
            margin-bottom: 0.5rem;
        }
        
        .header .subtitle {
            font-size: 1.1rem;
            color: #6b7280;
            margin-bottom: 1rem;
        }
        
        .header .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            font-size: 0.9rem;
            color: #374151;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .summary-card {
            background: white;
            border-radius: 0.75rem;
            padding: 1.5rem;
            box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        
        .summary-card h3 {
            font-size: 0.875rem;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
        }
        
        .summary-card .value {
            font-size: 2rem;
            font-weight: 700;
            color: #1f2937;
        }
        
        .activity-item {
            background: white;
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
            border-left: 4px solid;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .activity-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
        }
        
        .activity-header {
            display: flex;
            justify-content: between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        
        .activity-title {
            flex: 1;
        }
        
        .activity-title h3 {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }
        
        .activity-time {
            font-size: 0.875rem;
            color: #6b7280;
            font-weight: 500;
        }
        
        .confidence-rating {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-left: 1rem;
        }
        
        .stars {
            font-size: 1.2rem;
            color: #fbbf24;
        }
        
        .severity-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .description {
            color: #374151;
            margin-bottom: 1rem;
            line-height: 1.7;
        }
        
        .algorithm {
            background: #f8fafc;
            border-radius: 0.5rem;
            padding: 0.75rem;
            font-size: 0.875rem;
            color: #4b5563;
            margin-bottom: 1rem;
            border: 1px solid #e5e7eb;
        }
        
        .algorithm strong {
            color: #1f2937;
        }
        
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .tag {
            padding: 0.25rem 0.75rem;
            background: #f3f4f6;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            color: #374151;
            border: 1px solid #d1d5db;
        }
        
        .tag.platform {
            background: #dbeafe;
            color: #1e40af;
            border-color: #93c5fd;
        }
        
        .tag.concern {
            background: #fee2e2;
            color: #dc2626;
            border-color: #fca5a5;
        }
        
        .tag.privacy {
            background: #fef3c7;
            color: #d97706;
            border-color: #fcd34d;
        }
        
        .day-summary {
            background: white;
            border-radius: 1rem;
            padding: 2rem;
            margin-top: 2rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        
        .day-summary h2 {
            font-size: 1.875rem;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 1rem;
        }
        
        .summary-text {
            color: #374151;
            margin-bottom: 1.5rem;
            line-height: 1.7;
        }
        
        .recommendations {
            background: #f0f9ff;
            border-radius: 0.75rem;
            padding: 1.5rem;
            border: 1px solid #bae6fd;
        }
        
        .recommendations h3 {
            color: #0c4a6e;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        
        .recommendations ul {
            list-style: none;
            color: #0f172a;
        }
        
        .recommendations li {
            margin-bottom: 0.5rem;
            padding-left: 1.5rem;
            position: relative;
        }
        
        .recommendations li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #0284c7;
            font-weight: bold;
        }
        
        @media print {
            body { background: white; }
            .activity-item:hover { transform: none; }
        }
    </style>
</head>
<body>
    <div class="main-container">
        <!-- Sidebar Navigation -->
        <div class="sidebar">
            <h3>⏰ Time Navigation</h3>
            <ul class="time-nav">
                ${sortedHours.filter(hour => {
                  const hourActivities = activitiesByHour[hour]
                  // Only show hours that have activities with CRITICAL, HIGH, or MEDIUM severity
                  return hourActivities.some(s => getSeverityLevel(s) !== null)
                }).map(hour => {
                  const hourActivities = activitiesByHour[hour]
                  const filteredActivities = hourActivities.filter(s => getSeverityLevel(s) !== null)
                  const criticalCount = filteredActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.CRITICAL).length
                  const highCount = filteredActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.HIGH).length
                  const mediumCount = filteredActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.MEDIUM).length
                  
                  let badgeClass = ''
                  let badgeText = filteredActivities.length.toString()
                  
                  if (criticalCount > 0) {
                    badgeClass = 'critical'
                    badgeText = `${criticalCount}🚨`
                  } else if (highCount > 0) {
                    badgeClass = 'high'
                    badgeText = `${highCount}⚠️`
                  } else if (mediumCount > 0) {
                    badgeText = `${mediumCount}📋`
                  }
                  
                  return `
                    <li class="time-nav-item">
                        <a href="#time-${hour.replace(':', '')}" class="time-nav-link">
                            <span>${hour}</span>
                            <span class="time-nav-badge ${badgeClass}">${badgeText}</span>
                        </a>
                    </li>
                  `
                }).join('')}
            </ul>
            
            ${appliedFilters && Object.keys(appliedFilters).length > 0 ? `
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                <h3>🔍 Applied Filters</h3>
                <div style="font-size: 0.875rem; color: #6b7280;">
                    ${appliedFilters.categories && appliedFilters.categories.length > 0 ? 
                      `<p><strong>Categories:</strong> ${appliedFilters.categories.join(', ')}</p>` : ''
                    }
                    ${appliedFilters.status && appliedFilters.status.length > 0 ? 
                      `<p><strong>Status:</strong> ${appliedFilters.status.join(', ')}</p>` : ''
                    }
                    ${appliedFilters.behaviorPatterns && appliedFilters.behaviorPatterns.length > 0 ? 
                      `<p><strong>Behavior:</strong> ${appliedFilters.behaviorPatterns.join(', ')}</p>` : ''
                    }
                    ${appliedFilters.whatsappActivity && appliedFilters.whatsappActivity.length > 0 ? 
                      `<p><strong>WhatsApp:</strong> ${appliedFilters.whatsappActivity.join(', ')}</p>` : ''
                    }
                    ${appliedFilters.facebookActivity && appliedFilters.facebookActivity.length > 0 ? 
                      `<p><strong>Facebook:</strong> ${appliedFilters.facebookActivity.join(', ')}</p>` : ''
                    }
                </div>
            </div>
            ` : ''}
        </div>
        
        <!-- Main Content -->
        <div class="content">
            <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>Communication Activity Report</h1>
            <div class="subtitle">Comprehensive analysis of communication patterns and relationship concerns</div>
            <div class="meta">
                <span>📅 Generated: ${new Date().toLocaleString()} SAST</span>
                <span>📊 Total Entries: ${data.length.toLocaleString()}</span>
                <span>🔍 Activities Detected: ${detectedActivities.length}</span>
                ${selectedDevices && selectedDevices.length > 0 ? 
                  `<span>📱 Devices: ${selectedDevices.join(', ')}</span>` : 
                  '<span>📱 All Devices</span>'
                }
                ${timeRange ? 
                  `<span>⏰ Time Range: ${timeRange.start} - ${timeRange.end}</span>` : 
                  '<span>⏰ Time Range: All Day</span>'
                }
                ${appliedFilters && Object.keys(appliedFilters).length > 0 ? 
                  '<span>🔍 Filters Applied</span>' : 
                  ''
                }
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Critical Concerns</h3>
                <div class="value" style="color: #dc2626;">${summary.criticalConcerns}</div>
            </div>
            <div class="summary-card">
                <h3>High Priority</h3>
                <div class="value" style="color: #ea580c;">${summary.highConcerns}</div>
            </div>
            <div class="summary-card">
                <h3>WhatsApp Activities</h3>
                <div class="value" style="color: #25d366;">${summary.whatsappActivities}</div>
            </div>
            <div class="summary-card">
                <h3>Facebook Activities</h3>
                <div class="value" style="color: #1877f2;">${summary.facebookActivities}</div>
            </div>
            <div class="summary-card">
                <h3>Relationship Concerns</h3>
                <div class="value" style="color: #dc2626;">${summary.relationshipConcerns}</div>
            </div>
            <div class="summary-card">
                <h3>Privacy Detections</h3>
                <div class="value" style="color: #d97706;">${summary.vpnDetections + summary.privacyBehavior}</div>
            </div>
        </div>

        <!-- Activity Timeline by Hour -->
        <div class="activities">
            ${sortedHours.filter(hour => {
              const hourActivities = activitiesByHour[hour]
              // Only show hours that have activities with CRITICAL, HIGH, or MEDIUM severity
              return hourActivities.some(s => getSeverityLevel(s) !== null)
            }).map(hour => {
              const hourActivities = activitiesByHour[hour]
              const filteredActivities = hourActivities.filter(s => getSeverityLevel(s) !== null)
              const criticalCount = filteredActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.CRITICAL).length
              const highCount = filteredActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.HIGH).length
              const mediumCount = filteredActivities.filter(s => getSeverityLevel(s) === SEVERITY_LEVELS.MEDIUM).length
              
              return `
                <div class="time-section" id="time-${hour.replace(':', '')}">
                    <div class="time-section-header">
                        <h2>${hour} Hour</h2>
                        <div class="time-meta">
                            ${filteredActivities.length} significant activities detected
                            ${criticalCount > 0 ? ` • ${criticalCount} critical concerns` : ''}
                            ${highCount > 0 ? ` • ${highCount} high priority` : ''}
                            ${mediumCount > 0 ? ` • ${mediumCount} medium priority` : ''}
                        </div>
                    </div>
                    
                    ${hourActivities.filter(stat => {
                      const severity = getSeverityLevel(stat)
                      return severity !== null // Only include activities with CRITICAL, HIGH, or MEDIUM severity
                    }).map(stat => {
              const severity = getSeverityLevel(stat)!
              const { title, description, algorithm } = getActivityDescription(stat)
              const tags = generateTags(stat)
              const [datePart, timePart] = stat.timeWindow.split(' ')
              
              return `
                <div class="activity-item" style="border-left-color: ${severity.color}; background: ${severity.bgColor};">
                    <div class="activity-header">
                        <div class="activity-title">
                            <h3 style="color: ${severity.color};">${title}</h3>
                            <div class="activity-time">${datePart} at ${timePart}:00 SAST</div>
                        </div>
                        <div class="confidence-rating">
                            <div class="stars">${generateStars(severity.stars)}</div>
                            <div class="severity-badge" style="background: ${severity.color}; color: white;">
                                ${severity.label}
                            </div>
                        </div>
                    </div>
                    
                    <div class="description">${description}</div>
                    
                    <div class="algorithm">
                        <strong>Detection Algorithm:</strong> ${algorithm}
                        ${stat.isReelsMasking ? ` | ⚠️ ${stat.maskingEvidence}` : ''}
                    </div>
                    
                    <div class="tags">
                        ${tags.map(tag => {
                          let tagClass = 'tag'
                          if (['WhatsApp', 'Facebook', 'Instagram'].includes(tag)) tagClass += ' platform'
                          else if (stat.relationshipConcerns.datingApps.includes(tag.toLowerCase()) || 
                                  stat.relationshipConcerns.alternativeMessaging.includes(tag.toLowerCase())) tagClass += ' concern'
                          else if (['VPN Detected', 'Privacy Behavior', 'Potential Masking'].includes(tag)) tagClass += ' privacy'
                          
                          return `<span class="${tagClass}">${tag}</span>`
                        }).join('')}
                    </div>
                </div>
              `
                    }).join('')}
                </div>
              `
            }).join('')}
        </div>

        <!-- Day Summary -->
        <div class="day-summary">
            <h2>Daily Summary & Analysis</h2>
            
            <div class="summary-text">
                <p><strong>Communication Overview:</strong> 
                This report analyzed ${data.length.toLocaleString()} DNS log entries and detected ${summary.totalActivities} communication activities across multiple platforms.</p>
                
                ${summary.criticalConcerns > 0 ? `
                <p style="color: #dc2626; font-weight: 600; margin-top: 1rem;">
                ⚠️ <strong>Critical Concerns Detected:</strong> ${summary.criticalConcerns} high-priority relationship concerns were identified, including dating apps or anonymous communication platforms.
                </p>` : ''}
                
                ${summary.relationshipConcerns > 0 ? `
                <p style="color: #ea580c; margin-top: 1rem;">
                <strong>Relationship Concerns:</strong> ${summary.relationshipConcerns} activities detected on platforms that could indicate relationship concerns (dating apps: ${summary.criticalConcerns}, alternative messaging, video calling).
                </p>` : ''}
                
                <p style="margin-top: 1rem;">
                <strong>Standard Communication:</strong> WhatsApp activities (${summary.whatsappActivities}), Facebook/Messenger activities (${summary.facebookActivities}), and Reels scrolling (${summary.reelsActivities}) were detected.
                </p>
                
                ${summary.vpnDetections > 0 || summary.privacyBehavior > 0 ? `
                <p style="color: #d97706; margin-top: 1rem;">
                <strong>Privacy Behavior:</strong> VPN attempts (${summary.vpnDetections}) and privacy-focused behavior (${summary.privacyBehavior}) were detected.
                </p>` : ''}
                
                ${summary.maskingAttempts > 0 ? `
                <p style="color: #dc2626; margin-top: 1rem;">
                <strong>Potential Masking:</strong> ${summary.maskingAttempts} instances of potential Reels masking behavior detected.
                </p>` : ''}
            </div>
            
            <div class="recommendations">
                <h3>📋 Report Analysis & Recommendations</h3>
                <ul>
                    ${summary.criticalConcerns > 0 ? 
                      '<li><strong>Critical:</strong> Dating app or anonymous platform activity requires immediate discussion</li>' : 
                      '<li><strong>No Critical Concerns:</strong> No dating apps or anonymous platforms detected</li>'
                    }
                    ${summary.relationshipConcerns > 0 ? 
                      '<li><strong>Alternative Platforms:</strong> Consider discussing the use of alternative messaging platforms</li>' : 
                      '<li><strong>Standard Platforms:</strong> Only standard messaging platforms (WhatsApp, Facebook) detected</li>'
                    }
                    ${summary.reelsActivities > 0 ? 
                      '<li><strong>Video Content:</strong> Reels/Stories viewing activity detected - normal social media usage</li>' : ''
                    }
                    ${summary.vpnDetections > 0 || summary.privacyBehavior > 0 ? 
                      '<li><strong>Privacy Tools:</strong> VPN or privacy tool usage detected - consider discussing privacy needs</li>' : 
                      '<li><strong>Open Communication:</strong> No privacy tools detected - transparent internet usage</li>'
                    }
                    <li><strong>Technical Accuracy:</strong> This analysis is based on DNS request patterns and provides evidence-based insights</li>
                    <li><strong>Limitations:</strong> DNS analysis cannot see message content, only communication patterns and platform access</li>
                </ul>
            </div>
        </div>
            </div>
        </div>
    </div>
    
    <script>
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Highlight current section in navigation
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -80% 0px',
            threshold: 0
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const navLink = document.querySelector('a[href="#' + entry.target.id + '"]');
                if (navLink) {
                    if (entry.isIntersecting) {
                        document.querySelectorAll('.time-nav-link').forEach(link => {
                            link.style.background = '';
                            link.style.color = '#4b5563';
                            link.style.borderColor = 'transparent';
                        });
                        navLink.style.background = '#3b82f6';
                        navLink.style.color = 'white';
                        navLink.style.borderColor = '#1e40af';
                    }
                }
            });
        }, observerOptions);
        
        document.querySelectorAll('.time-section').forEach(section => {
            observer.observe(section);
        });
    </script>
</body>
</html>
  `

  return html
}

export function exportHTMLReport(options: HTMLReportOptions): string {
  const html = generateHTMLReport(options)
  
  // Generate device folder and filename
  let deviceFolder = 'all-devices'
  let devicePart = 'all'
  
  if (options.selectedDevices && options.selectedDevices.length > 0) {
    if (options.selectedDevices.length === 1) {
      const cleanDeviceName = options.selectedDevices[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
      deviceFolder = cleanDeviceName
      devicePart = cleanDeviceName
    } else {
      deviceFolder = `${options.selectedDevices.length}-devices`
      devicePart = `${options.selectedDevices.length}-devices`
    }
  }
  
  let timeRangePart = ''
  if (options.data.length > 0) {
    const timestamps = options.data.map(entry => entry.parsedTimestamp).sort((a, b) => a.getTime() - b.getTime())
    const startTime = format(timestamps[0], 'HH-mm')
    const endTime = format(timestamps[timestamps.length - 1], 'HH-mm')
    const dateYYMMDD = format(timestamps[0], 'yy-MM-dd')
    timeRangePart = `${dateYYMMDD}-from-${startTime}-to-${endTime}`
  } else {
    const now = new Date()
    const dateYYMMDD = format(now, 'yy-MM-dd')
    const currentTime = format(now, 'HH-mm')
    timeRangePart = `${dateYYMMDD}-from-${currentTime}-to-${currentTime}`
  }
  
  const filename = `${devicePart}-${timeRangePart}-report.html`
  const fullPath = `reports/${deviceFolder}/${filename}`
  
  // Create and download the HTML file with folder structure
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fullPath
  a.click()
  URL.revokeObjectURL(url)
  
  return fullPath
}
