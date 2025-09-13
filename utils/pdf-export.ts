import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { format, addHours } from 'date-fns'

// Convert UTC time to South Africa Standard Time (SAST = UTC+2)
// Note: Timestamps in data are now already converted to SAST, but we keep this for report generation times
function convertToSAST(utcDate: Date): Date {
  return addHours(utcDate, 2)
}

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export interface PDFExportOptions {
  data: ProcessedLogEntry[]
  timeWindowStats: TimeWindowStats[]
  dateRange?: {
    start: Date | null
    end: Date | null
  }
  includeAllLogs?: boolean
  selectedDevices?: string[] // For device-specific filtering
}

export function exportCommunicationReport(options: PDFExportOptions) {
  const { data, timeWindowStats, dateRange, includeAllLogs = true, selectedDevices } = options
  
  // Note: data and timeWindowStats should already be filtered data from the UI
  
  // Create new PDF document
  const doc = new jsPDF('p', 'mm', 'a4')
  let yPosition = 20

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Communication Activity Report', 20, yPosition)
  yPosition += 10

  // Report metadata
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const generatedTime = convertToSAST(new Date())
  doc.text(`Generated: ${generatedTime.toLocaleString()} SAST`, 20, yPosition)
  yPosition += 5
  doc.text(`Total Log Entries: ${data.length.toLocaleString()}`, 20, yPosition)
  yPosition += 5
  
  if (dateRange?.start || dateRange?.end) {
    const startStr = dateRange.start ? format(dateRange.start, 'MMM dd, yyyy') : 'Beginning'
    const endStr = dateRange.end ? format(dateRange.end, 'MMM dd, yyyy') : 'End'
    doc.text(`Date Range: ${startStr} - ${endStr}`, 20, yPosition)
    yPosition += 5
  }
  
  yPosition += 10

  // Communication Evidence Summary
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Communication Evidence Summary', 20, yPosition)
  yPosition += 5
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text('This report shows communication evidence detected by algorithmic analysis, excluding background app activity.', 20, yPosition)
  yPosition += 4
  doc.text('DNS records are deduplicated (A, AAAA, HTTPS queries for same domain/time counted as one event).', 20, yPosition)
  yPosition += 10

  // Filter communication activities - be more inclusive
  const communicationActivities = timeWindowStats.filter(stat => 
    stat.whatsappActivity.activityScore > 0 || 
    stat.facebookActivity.activityScore > 0 || 
    stat.whatsappActivity.isTextMessage ||
    stat.whatsappActivity.isMediaTransfer ||
    stat.facebookActivity.isMessaging ||
    stat.facebookActivity.isMediaTransfer ||
    stat.facebookActivity.isInstagramActivity ||
    stat.isRealChat
  ).sort((a, b) => a.timeWindow.localeCompare(b.timeWindow))

  // Debug: Log what activities are being detected
  console.log('🔍 Communication activities found:', communicationActivities.length)
  communicationActivities.slice(0, 5).forEach(stat => {
    console.log(`📊 ${stat.timeWindow}:`, {
      whatsapp: stat.whatsappActivity,
      facebook: stat.facebookActivity,
      realChat: stat.isRealChat
    })
  })

  // Filter to ONLY detected communication evidence (exclude background and low confidence)
  const detectedActivities = communicationActivities.filter(stat => {
    return (
      stat.whatsappActivity.isVoiceCall ||
      stat.whatsappActivity.isVideoCall ||
      stat.whatsappActivity.isMediaTransfer ||
      stat.whatsappActivity.isTextMessage ||
      stat.facebookActivity.isCall ||
      stat.facebookActivity.isMediaTransfer ||
      stat.facebookActivity.isMessaging ||
      stat.facebookActivity.isInstagramActivity ||
      stat.facebookActivity.isReelsScrolling ||
      stat.relationshipConcerns.concernScore > 0 || // Include relationship concerns
      (stat.isRealChat && stat.whatsappActivity.activityScore === 0 && stat.facebookActivity.activityScore === 0)
    )
  })

  // Create focused activity table showing ONLY detected communication evidence
  const activityTableData = detectedActivities.map(stat => {
    // stat.timeWindow is already in SAST format (yyyy-MM-dd HH:mm), just format for display
    const [datePart, timePart] = stat.timeWindow.split(' ')
    const timeStr = `${datePart}, ${timePart}:00 SAST`

    let platform = ''
    let activityType = ''
    let algorithmUsed = ''

    // WhatsApp Activities (acknowledging detection uncertainty)
    if (stat.whatsappActivity.isVoiceCall || stat.whatsappActivity.isVideoCall) {
      platform = 'WhatsApp'
      const direction = stat.whatsappActivity.callDirection || 'unknown'
      activityType = `Call or Voice Note (${direction})`
      algorithmUsed = 'Signalling → media CDN (uncertain: call vs voice note)'
    } else if (stat.whatsappActivity.isMediaTransfer) {
      platform = 'WhatsApp'
      activityType = 'Media Transfer'
      // Check if it's sent or received based on domain patterns
      const windowEntries = data.filter(entry => entry.timeWindow === stat.timeWindow)
      const hasUpload = windowEntries.some(entry => entry.domain.includes('mmg.whatsapp.net'))
      const hasDownload = windowEntries.some(entry => entry.domain.includes('media-') && entry.domain.includes('cdn.whatsapp.net'))
      
      if (hasUpload && hasDownload) {
        activityType = 'Voice Note Sent (with playback)'
        algorithmUsed = 'mmg + media CDN'
      } else if (hasUpload) {
        activityType = 'Media Sent (Voice Note/Photo)'
        algorithmUsed = 'mmg.whatsapp.net'
      } else if (hasDownload) {
        activityType = 'Media Received (Voice Note/Photo)'
        algorithmUsed = 'APNs → signalling → media CDN'
      } else {
        algorithmUsed = 'Media patterns'
      }
    } else if (stat.whatsappActivity.isTextMessage) {
      platform = 'WhatsApp'
      activityType = 'Text Message'
      
      // Determine which pattern was used
      const windowEntries = data.filter(entry => entry.timeWindow === stat.timeWindow)
      const hasAPNs = windowEntries.some(entry => entry.domain.includes('courier') && entry.domain.includes('push.apple.com'))
      const hasDit = windowEntries.some(entry => entry.domain.includes('dit.whatsapp.net'))
      const hasGraph = windowEntries.some(entry => entry.domain.includes('graph.whatsapp.com'))
      
      if (hasAPNs) {
        algorithmUsed = 'APNs + signalling'
      } else if (hasDit) {
        algorithmUsed = 'dit.whatsapp.net + activity'
      } else if (hasGraph) {
        algorithmUsed = 'graph.whatsapp.com + activity'
      } else {
        algorithmUsed = 'Multiple signalling + device activity'
      }
    }
    
    // Facebook Activities
    else if (stat.facebookActivity.isCall) {
      platform = 'Facebook'
      activityType = 'Voice/Video Call'
      algorithmUsed = 'external.xx.fbcdn.net (STUN) + Messenger markers'
    } else if (stat.facebookActivity.isMediaTransfer && stat.facebookActivity.isMessaging) {
      platform = 'Facebook'
      const windowEntries = data.filter(entry => entry.timeWindow === stat.timeWindow)
      const hasUpload = windowEntries.some(entry => entry.domain.includes('rupload.facebook.com'))
      const hasDownload = windowEntries.some(entry => entry.domain.includes('scontent-') && entry.domain.includes('fbcdn.net'))
      
      if (hasUpload && hasDownload) {
        activityType = 'Message + Possible Media Exchange'
        algorithmUsed = 'APNs → rupload + scontent'
      } else if (hasUpload) {
        activityType = 'Possible Media Sent'
        algorithmUsed = 'rupload + messaging'
      } else {
        activityType = 'Possible Media Received'
        algorithmUsed = 'scontent + messaging'
      }
    } else if (stat.facebookActivity.isMediaTransfer) {
      platform = 'Facebook'
      const windowEntries = data.filter(entry => entry.timeWindow === stat.timeWindow)
      const hasUpload = windowEntries.some(entry => entry.domain.includes('rupload.facebook.com'))
      
      if (hasUpload) {
        activityType = 'Possible Media Sent'
        algorithmUsed = 'rupload + messaging'
      } else {
        activityType = 'Possible Media Received'
        algorithmUsed = 'scontent + messaging'
      }
    } else if (stat.facebookActivity.isMessaging) {
      platform = 'Facebook'
      const windowEntries = data.filter(entry => entry.timeWindow === stat.timeWindow)
      const hasTextSend = windowEntries.some(entry => 
        entry.domain.includes('pm.facebook.com') || entry.domain.includes('web.facebook.com')
      )
      
      if (hasTextSend) {
        activityType = 'Message Sent'
        algorithmUsed = 'pm/web + edge-mqtt'
      } else {
        activityType = 'Notification Received'
        algorithmUsed = 'edge-mqtt isolated'
      }
    } else if (stat.facebookActivity.isReelsScrolling) {
      platform = 'Facebook'
      activityType = 'Reels Scrolling'
      algorithmUsed = 'Video CDN + static assets (NetSeer/external)'
    } else if (stat.facebookActivity.isInstagramActivity) {
      platform = 'Instagram'
      activityType = 'Messages/Stories'
      algorithmUsed = 'Instagram + API'
    }
    
    // Relationship concern platforms (CRITICAL for trust issues)
    else if (stat.relationshipConcerns.concernScore > 0) {
      const concerns = stat.relationshipConcerns
      
      if (concerns.datingApps.length > 0) {
        platform = '🚨 Dating App'
        activityType = `${concerns.datingApps[0].toUpperCase()} Activity Detected`
        algorithmUsed = 'Dating app domain access'
      } else if (concerns.anonymousPlatforms.length > 0) {
        platform = '🚨 Anonymous Platform'
        activityType = `${concerns.anonymousPlatforms[0].toUpperCase()} Activity Detected`
        algorithmUsed = 'Anonymous communication platform'
      } else if (concerns.alternativeMessaging.length > 0) {
        platform = '⚠️ Alternative Messaging'
        activityType = `${concerns.alternativeMessaging[0].toUpperCase()} Activity Detected`
        algorithmUsed = 'Alternative messaging platform'
      } else if (concerns.videoCalling.length > 0) {
        platform = '📹 Video Calling'
        activityType = `${concerns.videoCalling[0].toUpperCase()} Activity Detected`
        algorithmUsed = 'Video calling platform'
      } else if (concerns.socialMessaging.length > 0) {
        platform = '📱 Social Media'
        activityType = `${concerns.socialMessaging[0].toUpperCase()} Activity Detected`
        algorithmUsed = 'Social media with messaging'
      }
    }
    // Other messaging apps
    else if (stat.isRealChat) {
      platform = 'Other Apps'
      activityType = 'Messaging Activity'
      algorithmUsed = 'Real chat indicators'
    }

    // Add masking detection warning if present
    let finalActivityType = activityType
    if (stat.isReelsMasking) {
      finalActivityType = `${activityType} ⚠️ (Potential Reels Masking)`
    }
    
    return [
      timeStr,
      platform,
      finalActivityType,
      algorithmUsed + (stat.isReelsMasking ? ` | ${stat.maskingEvidence}` : '')
    ]
  })

  if (activityTableData.length > 0) {
    doc.autoTable({
      head: [['Time (SAST)', 'Platform', 'Communication Evidence', 'Detection Algorithm']],
      body: activityTableData,
      startY: yPosition,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 }, // Blue header for evidence
      alternateRowStyles: { fillColor: [248, 250, 252] }, // Light gray alternating rows
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      columnStyles: {
        0: { cellWidth: 35 },  // Time
        1: { cellWidth: 20 },  // Platform
        2: { cellWidth: 30 },  // Activity
        3: { cellWidth: 85, overflow: 'linebreak' }   // Algorithm (much wider with forced wrapping)
      },
      // Highlight based on activity type
      didParseCell: (data: any) => {
        const rowIndex = data.row.index
        const activityType = activityTableData[rowIndex]?.[2] // Activity type
        
        // Subtle highlighting for different evidence types
        if (activityType?.includes('Call')) {
          data.cell.styles.fillColor = [220, 252, 231] // Light green highlight
          data.cell.styles.textColor = [21, 128, 61] // Dark green text
        }
        // Light highlighting for media
        else if (activityType?.includes('Media') || activityType?.includes('Voice Note')) {
          data.cell.styles.fillColor = [255, 237, 213] // Light orange highlight
          data.cell.styles.textColor = [154, 52, 18] // Dark orange text
        }
        // Light highlighting for messages
        else if (activityType?.includes('Message') || activityType?.includes('Text')) {
          data.cell.styles.fillColor = [239, 246, 255] // Light blue highlight
          data.cell.styles.textColor = [30, 64, 175] // Dark blue text
        }
      }
    })
    yPosition = (doc as any).lastAutoTable.finalY + 15
  } else {
    doc.setFontSize(10)
    doc.text('No communication evidence detected in the selected time range.', 20, yPosition)
    doc.text('This indicates either no communication occurred, or only background app activity was present.', 20, yPosition + 5)
    yPosition += 20
  }

  // Detection Methodology & Category Explanations
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Detection Methodology', 20, yPosition)
  yPosition += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  
  // WhatsApp Detection Explanation
  doc.setFont('helvetica', 'bold')
  doc.text('WhatsApp Activity Detection:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.text('• Incoming Calls: Apple Push Notification (-10s to +5s) → WhatsApp signalling (High confidence)', 25, yPosition)
  yPosition += 4
  doc.text('• Calls or Voice Notes: Signalling → media CDN (uncertain: DNS cannot distinguish calls from voice notes)', 25, yPosition)
  yPosition += 4
  doc.text('• Voice Note Sent: mmg.whatsapp.net (upload) + dit/static/media sequence', 25, yPosition)
  yPosition += 4
  doc.text('• Voice Note Received: APNs → signalling → media CDN (notification + playback)', 25, yPosition)
  yPosition += 4
  doc.text('• Text Messages: APNs + signalling (incoming), OR active conversation patterns (dit + graph + signalling)', 25, yPosition)
  yPosition += 4
  doc.text('• Media Sent: mmg.whatsapp.net detected (voice notes, photos, videos)', 25, yPosition)
  yPosition += 4
  doc.text('• Media Received: media-*.cdn.whatsapp.net without call patterns', 25, yPosition)
  yPosition += 8

  // Facebook Detection Explanation
  doc.setFont('helvetica', 'bold')
  doc.text('Facebook Activity Detection:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.text('• Calls: external.xx.fbcdn.net (STUN) + Messenger markers, no WhatsApp media interference', 25, yPosition)
  yPosition += 4
  doc.text('• Message + Photo Exchange: APNs → rupload.facebook.com + scontent-*.fbcdn.net pattern', 25, yPosition)
  yPosition += 4
  doc.text('• Message Sent: pm.facebook.com/web.facebook.com + edge-mqtt.facebook.com, isolated activity', 25, yPosition)
  yPosition += 4
  doc.text('• Notification Received: edge-mqtt.facebook.com isolated (not during app launch)', 25, yPosition)
  yPosition += 4
  doc.text('• Media Sent: rupload.facebook.com isolated (not during app launch)', 25, yPosition)
  yPosition += 4
  doc.text('• Media Received: scontent.*.fbcdn.net or *.fbsbx.com isolated activity', 25, yPosition)
  yPosition += 4
  doc.text('• App Launch Detection: 4+ unique domains + 8+ requests = background activity (excluded)', 25, yPosition)
  yPosition += 4
  doc.text('• Message Checking: Facebook domains without upload/download = viewing previous messages', 25, yPosition)
  yPosition += 8

  // Other Messaging Explanation
  doc.setFont('helvetica', 'bold')
  doc.text('Other Messaging Apps Include:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.text('• Telegram (telegram.org)', 25, yPosition)
  yPosition += 4
  doc.text('• Discord (discord.com, discordapp.com)', 25, yPosition)
  yPosition += 4
  doc.text('• Signal (signal.org)', 25, yPosition)
  yPosition += 4
  doc.text('• Slack (slack.com)', 25, yPosition)
  yPosition += 4
  doc.text('• Microsoft Teams (teams.microsoft.com)', 25, yPosition)
  yPosition += 4
  doc.text('• Zoom (zoom.us)', 25, yPosition)
  yPosition += 8

  // Legend for highlighting
  doc.setFont('helvetica', 'bold')
  doc.text('Report Legend:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(21, 128, 61) // Green
  doc.text('🟢 Green Highlight: Call evidence (voice/video)', 25, yPosition)
  yPosition += 4
  doc.setTextColor(154, 52, 18) // Orange
  doc.text('🟠 Orange Highlight: Media transfer evidence', 25, yPosition)
  yPosition += 4
  doc.setTextColor(30, 64, 175) // Blue
  doc.text('🔵 Blue Highlight: Messaging evidence', 25, yPosition)
  yPosition += 4
  doc.setTextColor(0, 0, 0) // Reset to black
  doc.text('⚪ No Highlight: Background activity (excluded from main analysis)', 25, yPosition)
  yPosition += 10

  // Activity Statistics
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Activity Statistics', 20, yPosition)
  yPosition += 10

  // Enhanced statistics using sophisticated detection
  const whatsappCalls = communicationActivities.filter(s => s.whatsappActivity.isVoiceCall || s.whatsappActivity.isVideoCall).length
  const whatsappMessages = communicationActivities.filter(s => s.whatsappActivity.isTextMessage).length
  const whatsappMedia = communicationActivities.filter(s => s.whatsappActivity.isMediaTransfer).length
  const facebookCalls = communicationActivities.filter(s => s.facebookActivity.isCall).length
  const facebookMessages = communicationActivities.filter(s => s.facebookActivity.isMessaging).length
  const facebookMedia = communicationActivities.filter(s => s.facebookActivity.isMediaTransfer).length
  const otherMessaging = communicationActivities.filter(s => s.isRealChat && 
    s.whatsappActivity.activityScore === 0 && s.facebookActivity.activityScore === 0).length
  const vpnAttempts = timeWindowStats.filter(s => s.isPossibleVPN).length
  const secretBehavior = timeWindowStats.filter(s => s.isActingSecret).length

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  // WhatsApp Statistics
  doc.setFont('helvetica', 'bold')
  doc.text('WhatsApp Activity:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.text(`  • Calls or Voice Notes: ${whatsappCalls} periods (DNS cannot distinguish)`, 25, yPosition)
  yPosition += 4
  doc.text(`  • Text Messages: ${whatsappMessages} periods`, 25, yPosition)
  yPosition += 4
  doc.text(`  • Media Transfer: ${whatsappMedia} periods`, 25, yPosition)
  yPosition += 6

  // Facebook Statistics
  doc.setFont('helvetica', 'bold')
  doc.text('Facebook Activity:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.text(`  • Calls: ${facebookCalls} periods`, 25, yPosition)
  yPosition += 4
  doc.text(`  • Messages/Notifications: ${facebookMessages} periods`, 25, yPosition)
  yPosition += 4
  doc.text(`  • Media Transfer: ${facebookMedia} periods`, 25, yPosition)
  yPosition += 6

  // Other Statistics
  doc.setFont('helvetica', 'bold')
  doc.text('Other Activity:', 20, yPosition)
  yPosition += 4
  doc.setFont('helvetica', 'normal')
  doc.text(`  • Other Messaging Apps: ${otherMessaging} periods`, 25, yPosition)
  yPosition += 4
  doc.text(`  • VPN Attempts Detected: ${vpnAttempts} periods`, 25, yPosition)
  yPosition += 4
  doc.text(`  • Suspicious Privacy Behavior: ${secretBehavior} periods`, 25, yPosition)
  yPosition += 15

  // Country Analysis Section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Geographic Analysis', 20, yPosition)
  yPosition += 10

  // Analyze countries for communication apps
  const communicationEntries = data.filter(entry => 
    entry.category === 'WhatsApp Domain Access' ||
    entry.category === 'Facebook Domain Access' ||
    entry.domain.includes('whatsapp') ||
    entry.domain.includes('facebook') ||
    entry.domain.includes('instagram')
  )

  const countryStats = communicationEntries.reduce((acc, entry) => {
    if (entry.destination_country) {
      const country = entry.destination_country
      if (!acc[country]) {
        acc[country] = { whatsapp: 0, facebook: 0, total: 0 }
      }
      acc[country].total++
      
      if (entry.domain.includes('whatsapp')) {
        acc[country].whatsapp++
      } else if (entry.domain.includes('facebook') || entry.domain.includes('instagram')) {
        acc[country].facebook++
      }
    }
    return acc
  }, {} as Record<string, { whatsapp: number; facebook: number; total: number }>)

  const sortedCountries = Object.entries(countryStats)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10) // Top 10 countries

  if (sortedCountries.length > 0) {
    const countryTableData = sortedCountries.map(([country, stats]) => [
      country,
      stats.whatsapp.toString(),
      stats.facebook.toString(),
      stats.total.toString(),
      ((stats.total / communicationEntries.length) * 100).toFixed(1) + '%'
    ])

    doc.autoTable({
      head: [['Country', 'WhatsApp', 'Facebook', 'Total', 'Percentage']],
      body: countryTableData,
      startY: yPosition,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 }
      }
    })
    yPosition = (doc as any).lastAutoTable.finalY + 10

    // Country analysis insights
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const totalCountries = Object.keys(countryStats).length
    const topCountry = sortedCountries[0]
    doc.text(`• Communication servers accessed in ${totalCountries} countries`, 25, yPosition)
    yPosition += 4
    doc.text(`• Primary destination: ${topCountry[0]} (${topCountry[1].total} requests)`, 25, yPosition)
    yPosition += 4
    
    // VPN detection based on unusual countries
    const unusualCountries = sortedCountries.filter(([country]) => 
      !['US', 'GB', 'IE', 'NL', 'DE', 'FR'].includes(country)
    )
    if (unusualCountries.length > 0) {
      doc.setTextColor(220, 38, 38) // Red color
      doc.text(`• Unusual countries detected: ${unusualCountries.map(([c]) => c).join(', ')} (potential VPN)`, 25, yPosition)
      doc.setTextColor(0, 0, 0) // Reset to black
      yPosition += 4
    }
    
    yPosition += 10
  }

  // Summary note about the focused approach
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text(`Report Focus: This analysis shows ${detectedActivities.length} communication evidence instances`, 20, yPosition)
  yPosition += 4
  doc.text(`from ${communicationActivities.length} total communication periods analyzed.`, 20, yPosition)
  yPosition += 4
  doc.text('Background app activity and low-confidence detections are excluded for clarity.', 20, yPosition)
  yPosition += 10

  // Generate filename based on device and time range
  const generateFilename = () => {
    // Determine device part
    let devicePart = 'all'
    if (selectedDevices && selectedDevices.length > 0) {
      if (selectedDevices.length === 1) {
        // Single device - use device name or ID
        const deviceName = selectedDevices[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
        devicePart = deviceName
      } else {
        // Multiple specific devices
        devicePart = selectedDevices.length + '-devices'
      }
    }
    
    // Determine time range
    let timeRangePart = ''
    if (dateRange?.start && dateRange?.end) {
      const startTime = format(dateRange.start, 'HH-mm')
      const endTime = format(dateRange.end, 'HH-mm')
      const dateYYMMDD = format(dateRange.start, 'yy-MM-dd')
      timeRangePart = `${dateYYMMDD}-from-${startTime}-to-${endTime}`
    } else if (data.length > 0) {
      // Use data range if no explicit date range provided
      const timestamps = data.map(entry => entry.parsedTimestamp).sort((a, b) => a.getTime() - b.getTime())
      const startTime = format(timestamps[0], 'HH-mm')
      const endTime = format(timestamps[timestamps.length - 1], 'HH-mm')
      const dateYYMMDD = format(timestamps[0], 'yy-MM-dd')
      timeRangePart = `${dateYYMMDD}-from-${startTime}-to-${endTime}`
    } else {
      // Fallback to current time
      const now = new Date()
      const dateYYMMDD = format(now, 'yy-MM-dd')
      const currentTime = format(now, 'HH-mm')
      timeRangePart = `${dateYYMMDD}-from-${currentTime}-to-${currentTime}`
    }
    
    return `${devicePart}-${timeRangePart}.pdf`
  }
  
  const filename = generateFilename()
  doc.save(filename)

  return filename
}

export function exportTimeWindowChart(chartElement: HTMLElement, data: ProcessedLogEntry[]) {
  // This function would capture the chart as an image and add it to PDF
  // Implementation would use html2canvas to capture the chart
  return new Promise((resolve, reject) => {
    import('html2canvas').then(html2canvas => {
      html2canvas.default(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png')
        
        const doc = new jsPDF('p', 'mm', 'a4')
        const imgWidth = 170
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        
        doc.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight)
        
        // Use data range for chart filename
        const timestamps = data.map(entry => entry.parsedTimestamp).sort((a, b) => a.getTime() - b.getTime())
        if (timestamps.length > 0) {
          const startTime = format(timestamps[0], 'HH-mm')
          const endTime = format(timestamps[timestamps.length - 1], 'HH-mm')
          const dateYYMMDD = format(timestamps[0], 'yy-MM-dd')
          const filename = `chart-${dateYYMMDD}-from-${startTime}-to-${endTime}.pdf`
          doc.save(filename)
        } else {
          const dateYYMMDD = format(new Date(), 'yy-MM-dd')
          const currentTime = format(new Date(), 'HH-mm')
          doc.save(`chart-${dateYYMMDD}-from-${currentTime}-to-${currentTime}.pdf`)
        }
        
        resolve(imgData)
      }).catch(reject)
    }).catch(reject)
  })
}
