import Papa from 'papaparse'
import { format, parseISO, startOfMinute, addMinutes, isValid, addHours, differenceInMinutes } from 'date-fns'
import { DNSLogEntry, ProcessedLogEntry, DOMAIN_CATEGORIES, CategoryName, REAL_CHAT_INDICATORS, VPN_INDICATORS, SECRET_BEHAVIOR_INDICATORS, WHATSAPP_ACTIVITY_INDICATORS, FACEBOOK_ACTIVITY_INDICATORS, RELATIONSHIP_CONCERN_INDICATORS } from '@/types/dns-log'

// Convert UTC time to South Africa Standard Time (SAST = UTC+2)
function convertToSAST(utcDate: Date): Date {
  return addHours(utcDate, 2)
}

// Optimized DNS record deduplication - much faster for large datasets
function deduplicateDNSRecords(entries: ProcessedLogEntry[]): ProcessedLogEntry[] {
  const uniqueEntries = new Map<string, ProcessedLogEntry>()
  
  // Use a simple key: domain + rounded timestamp (to nearest 30 seconds)
  entries.forEach(entry => {
    const roundedTime = Math.floor(entry.parsedTimestamp.getTime() / 30000) * 30000 // 30-second buckets
    const key = `${entry.domain}_${roundedTime}`
    
    if (!uniqueEntries.has(key)) {
      // First entry for this domain+time - keep it
      uniqueEntries.set(key, { ...entry })
    } else {
      // Duplicate found - prefer A record, then AAAA, then others
      const existing = uniqueEntries.get(key)!
      const priority = { 'A': 1, 'AAAA': 2, 'HTTPS': 3 }
      const existingPriority = priority[existing.query_type as keyof typeof priority] || 99
      const newPriority = priority[entry.query_type as keyof typeof priority] || 99
      
      if (newPriority < existingPriority) {
        // Replace with higher priority entry
        uniqueEntries.set(key, { ...entry })
      }
      
      // Combine query types
      const existingTypes = existing.query_type.split(',')
      if (!existingTypes.includes(entry.query_type)) {
        existing.query_type = [...existingTypes, entry.query_type].join(',')
      }
    }
  })
  
  const deduplicatedEntries = Array.from(uniqueEntries.values())
  console.log(`🔄 Deduplicated ${entries.length} DNS records → ${deduplicatedEntries.length} unique events (${((1 - deduplicatedEntries.length / entries.length) * 100).toFixed(1)}% reduction)`)
  
  return deduplicatedEntries.sort((a, b) => b.parsedTimestamp.getTime() - a.parsedTimestamp.getTime())
}

// Advanced WhatsApp/Facebook detection based on sophisticated algorithm
// Helper function to find entries within a time window
function findEntriesInWindow(entries: ProcessedLogEntry[], targetTime: Date, beforeSeconds: number, afterSeconds: number): ProcessedLogEntry[] {
  return entries.filter(entry => {
    const timeDiff = (entry.parsedTimestamp.getTime() - targetTime.getTime()) / 1000
    return timeDiff >= -beforeSeconds && timeDiff <= afterSeconds
  })
}

// Helper function to check for domain patterns
function hasDomainPattern(entries: ProcessedLogEntry[], patterns: string[]): boolean {
  return entries.some(entry => 
    patterns.some(pattern => entry.domain.includes(pattern))
  )
}

// Helper function to count domain pattern occurrences
function countDomainPattern(entries: ProcessedLogEntry[], patterns: string[]): number {
  return entries.filter(entry => 
    patterns.some(pattern => entry.domain.includes(pattern))
  ).length
}

// Apple Push Notification detection for iOS incoming calls
function detectAPNs(entries: ProcessedLogEntry[]): ProcessedLogEntry[] {
  return entries.filter(entry => 
    entry.domain.includes('courier') && entry.domain.includes('push.apple.com')
  )
}

export function parseCSVFile(file: File): Promise<ProcessedLogEntry[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          console.log('📊 Raw CSV data rows:', results.data.length)
          console.log('🕐 Current time for validation:', new Date().toISOString())
          
          // Process in chunks to avoid blocking UI
          const rawProcessedData = results.data
            .filter((row: any) => row.timestamp && row.domain)
            .map((row: any) => processProcessLogEntry(row as DNSLogEntry))
          
          console.log('🔄 Starting deduplication...')
          
          // Use setTimeout to make deduplication non-blocking
          setTimeout(() => {
            try {
              // Skip deduplication for very large datasets to prevent UI freezing
              let processedData: ProcessedLogEntry[]
              if (rawProcessedData.length > 50000) {
                console.log('⚡ Large dataset detected, skipping deduplication for performance')
                processedData = rawProcessedData.sort((a, b) => b.parsedTimestamp.getTime() - a.parsedTimestamp.getTime())
              } else {
                // Deduplicate DNS records (A, AAAA, HTTPS for same domain/time)
                processedData = deduplicateDNSRecords(rawProcessedData)
              }
              
              // Filter out any future timestamps (validation)
              const now = new Date()
              const validData = processedData.filter(entry => {
                if (entry.parsedTimestamp > now) {
                  console.warn('🚫 Removing future timestamp:', entry.timestamp, '→', entry.parsedTimestamp.toISOString())
                  return false
                }
                return true
              })
              
              if (validData.length !== processedData.length) {
                console.log(`⚠️ Removed ${processedData.length - validData.length} future timestamps`)
                processedData = validData
              }
              
              console.log('✅ Processed entries:', processedData.length)
              
              // Log first and last few timestamps to verify range
              if (processedData.length > 0) {
                console.log('🕐 First timestamp (latest):', processedData[0].timestamp, '→', processedData[0].timeWindow)
                console.log('🕐 Last timestamp (earliest):', processedData[processedData.length - 1].timestamp, '→', processedData[processedData.length - 1].timeWindow)
                
                // Show a few timestamps in the middle
                const mid = Math.floor(processedData.length / 2)
                console.log('🕐 Middle timestamp:', processedData[mid].timestamp, '→', processedData[mid].timeWindow)
              }
              
              resolve(processedData)
            } catch (error) {
              reject(error)
            }
          }, 0) // Non-blocking setTimeout
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

function processProcessLogEntry(entry: DNSLogEntry): ProcessedLogEntry {
  const utcTimestamp = parseISO(entry.timestamp)
  const category = categorizeDomain(entry.domain, entry.root_domain)
  const isBlocked = entry.status === 'blocked'
  
  // Check if timestamp is already in SAST format (has +02:00) or needs conversion
  let finalTimestamp: Date
  let timeWindow: string
  
  if (entry.timestamp.includes('+02:00')) {
    // Already in SAST format, don't convert again
    finalTimestamp = utcTimestamp
    timeWindow = format(finalTimestamp, 'yyyy-MM-dd HH:mm')
    console.log('📅 SAST timestamp detected, no conversion needed:', entry.timestamp)
  } else if (entry.timestamp.endsWith('Z')) {
    // UTC format - but since system is running in SAST, don't add extra hours
    // The format() function will automatically display in local timezone (SAST)
    finalTimestamp = utcTimestamp
    timeWindow = format(finalTimestamp, 'yyyy-MM-dd HH:mm')
  } else {
    // Unknown format, assume UTC
    finalTimestamp = utcTimestamp
    timeWindow = format(finalTimestamp, 'yyyy-MM-dd HH:mm')
  }
  
  // Validate timestamp is not in the future
  const now = new Date()
  if (finalTimestamp > now) {
    console.warn('⚠️ Future timestamp detected:', entry.timestamp, '→', finalTimestamp.toISOString())
  }

  return {
    ...entry,
    parsedTimestamp: finalTimestamp,
    category,
    isBlocked,
    timeWindow,
    dnssec: entry.dnssec
  }
}

function categorizeDomain(domain: string, rootDomain: string): CategoryName {
  const domainToCheck = rootDomain || domain
  
  for (const [category, domains] of Object.entries(DOMAIN_CATEGORIES)) {
    if (category === 'Other') continue
    
    const categoryDomains = [...domains] as string[]
    if (categoryDomains.some(catDomain => 
      domainToCheck.includes(catDomain) || 
      domain.includes(catDomain)
    )) {
      return category as CategoryName
    }
  }
  
  return 'Other'
}

export function groupByTimeWindows(entries: ProcessedLogEntry[]) {
  const grouped = new Map<string, ProcessedLogEntry[]>()
  
  entries.forEach(entry => {
    const key = entry.timeWindow
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(entry)
  })
  
  return grouped
}

export function getAvailableDatesAndHours(entries: ProcessedLogEntry[]) {
  const dates = new Set<string>()
  const hours = new Set<string>()
  const dateHours = new Map<string, Set<string>>()
  
  if (entries.length === 0) {
    return {
      availableDates: [],
      availableHours: [],
      dateHourMap: {}
    }
  }
  
  // Process entries using SAST time windows (now minute-level)
  for (const entry of entries) {
    if (!entry.timeWindow) continue
    
    try {
      // timeWindow is now in SAST format: "2025-09-12 11:30"
      const [date, time] = entry.timeWindow.split(' ')
      const hour = time.split(':')[0] + ':00' // Convert minute to hour for selection
      
      dates.add(date)
      hours.add(hour)
      
      if (!dateHours.has(date)) {
        dateHours.set(date, new Set())
      }
      dateHours.get(date)!.add(hour)
    } catch (error) {
      // Skip invalid entries silently for performance
      continue
    }
  }
  
  return {
    availableDates: Array.from(dates).sort(),
    availableHours: Array.from(hours).sort(),
    dateHourMap: Object.fromEntries(
      Array.from(dateHours.entries()).map(([date, hourSet]) => [
        date, 
        Array.from(hourSet).sort()
      ])
    )
  }
}

// Helper function to detect suspicious Reels masking behavior
function detectReelsMasking(timeWindowStats: any[]): any[] {
  // Sort by time to analyze temporal patterns
  const sortedStats = [...timeWindowStats].sort((a, b) => a.timeWindow.localeCompare(b.timeWindow))
  
  return sortedStats.map((stat, index) => {
    let isReelsMasking = false
    let maskingEvidence = ''
    
    // Look for SUSPICIOUS patterns, not just any messaging near Reels
    // Suspicious = Strong messaging evidence (APNs, uploads, etc.) immediately after Reels stops
    
    const hasStrongMessagingEvidence = 
      // Facebook: Actual uploads or strong messaging context
      (stat.facebookActivity.isMessaging && stat.facebookActivity.isMediaTransfer) ||
      // WhatsApp: APNs notifications (incoming) or media uploads (outgoing)
      (stat.whatsappActivity.isTextMessage && stat.whatsappActivity.callDirection === 'incoming') ||
      stat.whatsappActivity.isMediaTransfer ||
      // High activity scores indicate real communication, not background sync
      stat.facebookActivity.activityScore > 6 ||
      stat.whatsappActivity.activityScore > 6
    
    if (hasStrongMessagingEvidence) {
      // Check for recent Reels activity that suddenly stopped (suspicious timing)
      const timeframeMins = 10 // Shorter window for suspicious behavior
      const currentTime = new Date(stat.timeWindow.replace(' ', 'T') + ':00')
      
      // Look for Reels that ended just before this messaging activity
      const recentReels = sortedStats.filter((otherStat, otherIndex) => {
        if (otherIndex >= index || !otherStat.facebookActivity.isReelsScrolling) return false
        
        const otherTime = new Date(otherStat.timeWindow.replace(' ', 'T') + ':00')
        const timeDiffMins = (currentTime.getTime() - otherTime.getTime()) / (1000 * 60)
        
        // Reels that ended 1-10 minutes before messaging = suspicious
        return timeDiffMins > 1 && timeDiffMins <= timeframeMins
      })
      
      // Also check if Reels resume shortly after messaging (sandwich pattern)
      const subsequentReels = sortedStats.filter((otherStat, otherIndex) => {
        if (otherIndex <= index || !otherStat.facebookActivity.isReelsScrolling) return false
        
        const otherTime = new Date(otherStat.timeWindow.replace(' ', 'T') + ':00')
        const timeDiffMins = (otherTime.getTime() - currentTime.getTime()) / (1000 * 60)
        
        // Reels that start 1-10 minutes after messaging = suspicious sandwich
        return timeDiffMins > 1 && timeDiffMins <= timeframeMins
      })
      
      if (recentReels.length > 0 || subsequentReels.length > 0) {
        isReelsMasking = true
        const beforeTimings = recentReels.map(r => r.timeWindow.split(' ')[1])
        const afterTimings = subsequentReels.map(r => r.timeWindow.split(' ')[1])
        
        if (beforeTimings.length > 0 && afterTimings.length > 0) {
          maskingEvidence = `Suspicious: Reels stopped at ${beforeTimings.join(', ')}, resumed at ${afterTimings.join(', ')}`
        } else if (beforeTimings.length > 0) {
          maskingEvidence = `Suspicious: Strong messaging activity ${beforeTimings.length > 0 ? (currentTime.getTime() - new Date(recentReels[0].timeWindow.replace(' ', 'T') + ':00').getTime()) / (1000 * 60) : 0}min after Reels stopped`
        } else {
          maskingEvidence = `Suspicious: Reels resumed ${(new Date(subsequentReels[0].timeWindow.replace(' ', 'T') + ':00').getTime() - currentTime.getTime()) / (1000 * 60)}min after messaging`
        }
      }
    }
    
    return {
      ...stat,
      isReelsMasking: isReelsMasking || false,
      maskingEvidence: maskingEvidence || ''
    }
  })
}

export function calculateTimeWindowStats(entries: ProcessedLogEntry[]) {
  const stats = new Map<string, any>()
  
  entries.forEach(entry => {
    const key = entry.timeWindow
    if (!stats.has(key)) {
      stats.set(key, {
        timeWindow: key,
        totalRequests: 0,
        blockedRequests: 0,
        allowedRequests: 0,
        uniqueDomains: new Set(),
        categories: new Map(),
        devices: new Map(),
        domains: new Set()
      })
    }
    
    const windowStats = stats.get(key)!
    windowStats.totalRequests++
    
    if (entry.isBlocked) {
      windowStats.blockedRequests++
    } else {
      windowStats.allowedRequests++
    }
    
    windowStats.uniqueDomains.add(entry.domain)
    windowStats.domains.add(entry.domain)
    
    // Count categories
    const currentCategoryCount = windowStats.categories.get(entry.category) || 0
    windowStats.categories.set(entry.category, currentCategoryCount + 1)
    
    // Count devices
    if (entry.device_name) {
      const currentDeviceCount = windowStats.devices.get(entry.device_name) || 0
      windowStats.devices.set(entry.device_name, currentDeviceCount + 1)
    }
  })
  
  // Convert Maps to objects and calculate final stats with all detection algorithms
  const baseStats = Array.from(stats.values()).map(stat => {
    const domains = Array.from(stat.domains) as string[]
    // Get entries for this time window for time-based analysis
    const windowEntries = entries.filter(entry => entry.timeWindow === stat.timeWindow)
    
    const { isRealChat, chatScore } = detectRealChat(domains)
    const { isPossibleVPN, vpnScore } = detectVPNAttempt(domains)
    const { isActingSecret, secretScore } = detectSecretBehavior(domains, isRealChat, isPossibleVPN)
    const relationshipConcerns = detectRelationshipConcerns(domains)
    const whatsappActivity = detectWhatsAppActivity(windowEntries)
    const facebookActivity = detectFacebookActivity(windowEntries)
    
    return {
      ...stat,
      uniqueDomains: stat.uniqueDomains.size,
      categories: Object.fromEntries(stat.categories),
      devices: Object.fromEntries(stat.devices),
      isRealChat,
      chatScore,
      isPossibleVPN,
      vpnScore,
      isActingSecret,
      secretScore,
      relationshipConcerns,
      whatsappActivity,
      facebookActivity
    }
  })
  
  // Apply Reels masking detection to the complete stats
  const statsWithMaskingDetection = detectReelsMasking(baseStats)
  
  return statsWithMaskingDetection
}

function detectRealChat(domains: string[]): { isRealChat: boolean; chatScore: number } {
  let chatScore = 0
  let hasWhatsAppChat = false
  let hasFacebookChat = false
  
  // Helper function to check if any domain matches patterns
  const matchesDomain = (domainList: string[], targetDomains: readonly string[]) => {
    return domainList.some(domain => 
      targetDomains.some(pattern => domain.includes(pattern))
    )
  }
  
  // Check WhatsApp patterns
  const whatsappCore = matchesDomain(domains, REAL_CHAT_INDICATORS.whatsapp.core)
  const whatsappMessaging = matchesDomain(domains, REAL_CHAT_INDICATORS.whatsapp.messaging)
  const whatsappApi = matchesDomain(domains, REAL_CHAT_INDICATORS.whatsapp.api)
  
  if (whatsappCore) {
    chatScore += 1  // Base score for WhatsApp presence
    if (whatsappMessaging) {
      chatScore += 4  // Strong indicator of active messaging
      hasWhatsAppChat = true
    }
    if (whatsappApi) {
      chatScore += 3  // API usage suggests interaction
    }
  }
  
  // Check Facebook patterns
  const facebookCore = matchesDomain(domains, REAL_CHAT_INDICATORS.facebook.core)
  const facebookMessaging = matchesDomain(domains, REAL_CHAT_INDICATORS.facebook.messaging)
  const facebookRealtime = matchesDomain(domains, REAL_CHAT_INDICATORS.facebook.realtime)
  
  if (facebookCore) {
    chatScore += 1  // Base score for Facebook presence
    if (facebookMessaging) {
      chatScore += 4  // Strong indicator of active messaging
      hasFacebookChat = true
    }
    if (facebookRealtime) {
      chatScore += 3  // Real-time features suggest active use
    }
  }
  
  // Much more lenient detection:
  // - Score >= 3 (core + some activity) OR
  // - Any messaging-specific domains OR
  // - Multiple core domains suggesting active session
  const multipleApps = whatsappCore && facebookCore
  const isRealChat = chatScore >= 3 || hasWhatsAppChat || hasFacebookChat || multipleApps
  
  return { isRealChat, chatScore }
}

function detectVPNAttempt(domains: string[]): { isPossibleVPN: boolean; vpnScore: number } {
  let vpnScore = 0
  
  // Helper function to check if any domain matches patterns
  const matchesDomain = (domainList: string[], targetDomains: readonly string[]) => {
    return domainList.some(domain => 
      targetDomains.some(pattern => domain.includes(pattern))
    )
  }
  
  // Check for direct VPN services
  if (matchesDomain(domains, VPN_INDICATORS.vpnServices)) {
    vpnScore += 10  // Very strong indicator
  }
  
  // Check for Tor/anonymity networks
  if (matchesDomain(domains, VPN_INDICATORS.anonymityNetworks)) {
    vpnScore += 8  // Strong anonymity attempt
  }
  
  // Check for privacy-focused DNS
  if (matchesDomain(domains, VPN_INDICATORS.privateDNS)) {
    vpnScore += 3  // Moderate privacy concern
  }
  
  // Check for proxy services
  if (matchesDomain(domains, VPN_INDICATORS.proxyServices)) {
    vpnScore += 6  // Strong proxy indication
  }
  
  // Check for privacy tools
  if (matchesDomain(domains, VPN_INDICATORS.privacyTools)) {
    vpnScore += 2  // Mild privacy tools usage
  }
  
  // Multiple unusual DNS queries to different regions (potential DNS tunneling)
  const uniqueCountries = new Set(domains.map(d => d.split('.').pop())).size
  if (uniqueCountries > 5) {
    vpnScore += 2  // Suspicious geographic diversity
  }
  
  // High number of failed/blocked requests (could indicate VPN detection evasion)
  const suspiciousPatterns = domains.filter(d => 
    d.includes('cdn') || d.includes('proxy') || d.includes('tunnel') || d.includes('vpn')
  ).length
  if (suspiciousPatterns > 3) {
    vpnScore += 3
  }
  
  const isPossibleVPN = vpnScore >= 4  // Lower threshold for detection
  
  return { isPossibleVPN, vpnScore }
}


function detectRelationshipConcerns(domains: string[]): {
  datingApps: string[]
  alternativeMessaging: string[]
  videoCalling: string[]
  socialMessaging: string[]
  anonymousPlatforms: string[]
  concernScore: number
} {
  const datingApps: string[] = []
  const alternativeMessaging: string[] = []
  const videoCalling: string[] = []
  const socialMessaging: string[] = []
  const anonymousPlatforms: string[] = []
  
  // Check each domain against relationship concern patterns
  domains.forEach(domain => {
    // Skip excluded patterns (common false positives)
    const isExcluded = RELATIONSHIP_CONCERN_INDICATORS.excludePatterns.some(pattern => 
      domain.includes(pattern)
    )
    if (isExcluded) return
    
    // Check dating apps
    RELATIONSHIP_CONCERN_INDICATORS.datingApps.forEach(app => {
      if (domain.includes(app) && !datingApps.includes(app)) {
        datingApps.push(app)
      }
    })
    
    // Check alternative messaging
    RELATIONSHIP_CONCERN_INDICATORS.alternativeMessaging.forEach(platform => {
      if (domain.includes(platform) && !alternativeMessaging.includes(platform)) {
        alternativeMessaging.push(platform)
      }
    })
    
    // Check video calling
    RELATIONSHIP_CONCERN_INDICATORS.videoCalling.forEach(platform => {
      if (domain.includes(platform) && !videoCalling.includes(platform)) {
        videoCalling.push(platform)
      }
    })
    
    // Check social messaging
    RELATIONSHIP_CONCERN_INDICATORS.socialMessaging.forEach(platform => {
      if (domain.includes(platform) && !socialMessaging.includes(platform)) {
        socialMessaging.push(platform)
      }
    })
    
    // Check anonymous platforms
    RELATIONSHIP_CONCERN_INDICATORS.anonymousPlatforms.forEach(platform => {
      if (domain.includes(platform) && !anonymousPlatforms.includes(platform)) {
        anonymousPlatforms.push(platform)
      }
    })
  })
  
  // Calculate concern score based on types and severity
  let concernScore = 0
  concernScore += datingApps.length * 10 // High concern for dating apps
  concernScore += anonymousPlatforms.length * 8 // High concern for anonymous platforms
  concernScore += alternativeMessaging.length * 6 // Medium-high concern for secret messaging
  concernScore += videoCalling.length * 4 // Medium concern for video calls
  concernScore += socialMessaging.length * 2 // Lower concern for social media
  
  return {
    datingApps,
    alternativeMessaging,
    videoCalling,
    socialMessaging,
    anonymousPlatforms,
    concernScore
  }
}

function detectSecretBehavior(domains: string[], isRealChat: boolean, isPossibleVPN: boolean): { isActingSecret: boolean; secretScore: number } {
  let secretScore = 0
  
  // Helper function to check if any domain matches patterns
  const matchesDomain = (domainList: string[], targetDomains: readonly string[]) => {
    return domainList.some(domain => 
      targetDomains.some(pattern => domain.includes(pattern))
    )
  }
  
  // Base multipliers for existing suspicious activities
  if (isRealChat) secretScore += 2  // Messaging activity
  if (isPossibleVPN) secretScore += 4  // VPN usage
  
  // Check for temporary email services
  if (matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.tempEmail)) {
    secretScore += 6  // Strong indicator of hiding identity
  }
  
  // Check for encrypted messaging beyond mainstream
  if (matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.encryptedMessaging)) {
    secretScore += 4  // Privacy-focused communication
  }
  
  // Check for anonymous file storage/sharing
  if (matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.anonymousStorage)) {
    secretScore += 5  // File sharing with privacy focus
  }
  
  // Check for cryptocurrency privacy tools
  if (matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.cryptoPrivacy)) {
    secretScore += 7  // Financial privacy/anonymity
  }
  
  // Check for alternative social media
  if (matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.altSocial)) {
    secretScore += 3  // Non-mainstream social platforms
  }
  
  // Check for private search engines
  if (matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.privateSearch)) {
    secretScore += 2  // Privacy-focused search
  }
  
  // Pattern analysis: Multiple privacy tools in same window
  const privacyToolCount = [
    matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.tempEmail),
    matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.encryptedMessaging),
    matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.anonymousStorage),
    matchesDomain(domains, SECRET_BEHAVIOR_INDICATORS.cryptoPrivacy),
    matchesDomain(domains, VPN_INDICATORS.vpnServices),
    matchesDomain(domains, VPN_INDICATORS.anonymityNetworks)
  ].filter(Boolean).length
  
  if (privacyToolCount >= 3) {
    secretScore += 5  // Multiple privacy tools = very suspicious
  }
  
  // Time-based suspicious pattern: Late night activity with privacy tools
  const timeWindow = domains[0] // This would need to be passed differently in real implementation
  // For now, we'll use a simpler heuristic
  
  // Unusual domain patterns that suggest obfuscation
  const obfuscatedDomains = domains.filter(d => 
    d.includes('--') || d.match(/[0-9]{4,}/) || d.includes('temp') || d.includes('anon')
  ).length
  if (obfuscatedDomains > 2) {
    secretScore += 3
  }
  
  const isActingSecret = secretScore >= 7  // Threshold for "acting secret"
  
  return { isActingSecret, secretScore }
}

export function detectWhatsAppActivity(windowEntries: ProcessedLogEntry[]) {
  // Sort entries by timestamp for temporal analysis
  const sortedEntries = [...windowEntries].sort((a, b) => a.parsedTimestamp.getTime() - b.parsedTimestamp.getTime())
  
  let isTextMessage = false
  let isMediaTransfer = false
  let isVoiceCall = false
  let isVideoCall = false
  let activityScore = 0
  let callDirection = '' // 'incoming', 'outgoing', or ''

  // Check for WhatsApp activity patterns using sophisticated algorithm
  const hasSignalling = hasDomainPattern(sortedEntries, WHATSAPP_ACTIVITY_INDICATORS.signalling)
  const hasMediaUpload = hasDomainPattern(sortedEntries, WHATSAPP_ACTIVITY_INDICATORS.mediaUpload)
  const hasMediaDownload = hasDomainPattern(sortedEntries, WHATSAPP_ACTIVITY_INDICATORS.mediaDownload)
  const hasCore = hasDomainPattern(sortedEntries, WHATSAPP_ACTIVITY_INDICATORS.core)
  const hasCalls = hasDomainPattern(sortedEntries, WHATSAPP_ACTIVITY_INDICATORS.calls)
  
  // CRITICAL: Check for ongoing Reels/video activity that could explain WhatsApp domains
  const hasReelsVideo = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.reelsVideo)

  if (!hasCore && !hasSignalling) {
    return { isTextMessage, isMediaTransfer, isVoiceCall, isVideoCall, activityScore, callDirection }
  }
  
  // CONSERVATIVE: If NetSeer CDN (ongoing Reels) present, be very conservative about WhatsApp detection
  const hasNetSeerCDN = sortedEntries.some(entry => entry.domain.includes('-netseer-ipaddr-assoc.'))
  if (hasNetSeerCDN) {
    // When NetSeer CDN is active, only detect WhatsApp activity with VERY strong evidence
    // Strong evidence = APNs notifications (incoming) or media uploads (mmg.whatsapp.net)
    const apnsEntries = detectAPNs(sortedEntries)
    const hasStrongWhatsAppEvidence = apnsEntries.length > 0 || hasMediaUpload
    
    if (!hasStrongWhatsAppEvidence) {
      // Likely just background WhatsApp activity during Reels scrolling
      return { isTextMessage, isMediaTransfer, isVoiceCall, isVideoCall, activityScore: 0, callDirection }
    }
  }

  // SOPHISTICATED WHATSAPP DETECTION ALGORITHM

  // 1. INCOMING CALL DETECTION (iOS): APNs within -10s to +5s, followed by WhatsApp signalling
  const apnsEntries = detectAPNs(sortedEntries)
  for (const apnsEntry of apnsEntries) {
    const signallingInWindow = findEntriesInWindow(sortedEntries, apnsEntry.parsedTimestamp, 10, 5)
      .filter(entry => WHATSAPP_ACTIVITY_INDICATORS.signalling.some(pattern => entry.domain.includes(pattern)))
    
    if (signallingInWindow.length > 0) {
      // Check no Facebook interference in same window
      const facebookInterference = findEntriesInWindow(sortedEntries, apnsEntry.parsedTimestamp, 10, 15)
        .filter(entry => 
          entry.domain.includes('rupload.facebook.com') || 
          entry.domain.includes('edge-mqtt.facebook.com')
        )
      
      if (facebookInterference.length === 0) {
        isVoiceCall = true
        callDirection = 'incoming'
        activityScore += 8 // High confidence
        break
      }
    }
  }

  // 2. VOICE NOTE DETECTION: Revised based on real-world testing
  // Most "call" detections are actually voice notes - be more conservative
  if (!isVoiceCall && hasSignalling) {
    const signallingEntries = sortedEntries.filter(entry => 
      WHATSAPP_ACTIVITY_INDICATORS.signalling.some(pattern => entry.domain.includes(pattern))
    )

    for (const signallingEntry of signallingEntries) {
      // Look for media CDN that comes AFTER signalling (indicates voice note playback/processing)
      const laterMediaCDN = findEntriesInWindow(sortedEntries, signallingEntry.parsedTimestamp, 0, 120)
        .filter(entry => 
          entry.domain.includes('media-') && 
          entry.domain.includes('cdn.whatsapp.net') &&
          entry.parsedTimestamp > signallingEntry.parsedTimestamp
        )
      
      // Check for APNs (incoming vs outgoing)
      const precedingAPNs = findEntriesInWindow(sortedEntries, signallingEntry.parsedTimestamp, 15, 0)
        .filter(entry => entry.domain.includes('courier') && entry.domain.includes('push.apple.com'))
      
      // Pattern: Signalling followed by media CDN (voice note audio/data)
      // Conservative: classify as voice note unless clear call indicators
      if (laterMediaCDN.length > 0) {
        isMediaTransfer = true // Changed from isVoiceCall to isMediaTransfer (voice note)
        callDirection = precedingAPNs.length > 0 ? 'incoming' : 'outgoing'
        activityScore += precedingAPNs.length > 0 ? 8 : 6
        break
      }
    }
  }

  // 3. TEXT MESSAGE AND CONVERSATION DETECTION: Balanced approach
  if (!isVoiceCall && !isMediaTransfer) {
    const hasAPNsActivity = apnsEntries.length > 0
    const hasDitActivity = hasDomainPattern(sortedEntries, ['dit.whatsapp.net'])
    const hasGraphActivity = hasDomainPattern(sortedEntries, ['graph.whatsapp.com'])
    
    // Pattern 1: APNs + WhatsApp signalling (incoming notification) - HIGHEST CONFIDENCE
    if (hasAPNsActivity && hasSignalling) {
      isTextMessage = true
      activityScore += 7 // High confidence for APNs-triggered activity
    }
    // Pattern 2: Multiple WhatsApp domains in sequence (active conversation)
    else if (hasDitActivity && hasGraphActivity && hasSignalling) {
      // dit + graph + g.whatsapp = active conversation pattern
      isTextMessage = true
      activityScore += 5 // Medium-high confidence for conversation
    }
    // Pattern 2b: Graph API + signalling (outgoing message)
    else if (hasGraphActivity && hasSignalling) {
      // graph + g.whatsapp = outgoing message pattern
      isTextMessage = true
      activityScore += 4 // Medium confidence for outgoing
    }
    // Pattern 3: mmg upload activity (indicates active messaging session)
    else if (hasMediaUpload) {
      // If there's media upload, there's likely text activity too
      isTextMessage = true
      activityScore += 4 // Medium confidence
    }
    
    // Still exclude: Isolated single domain requests (keep-alive)
  }

  // 4. VOICE NOTE/MEDIA SENT DETECTION: mmg.whatsapp.net present
  // Real pattern: mmg → dit → static → media CDN (voice note upload sequence)
  if (hasMediaUpload) {
    isMediaTransfer = true
    activityScore += 6 // High confidence for mmg.whatsapp.net
    
    // Check for the complete voice note sequence
    const hasStaticActivity = hasDomainPattern(sortedEntries, ['static.whatsapp.net'])
    const hasDitActivity = hasDomainPattern(sortedEntries, ['dit.whatsapp.net'])
    
    if (hasMediaDownload && hasStaticActivity && hasDitActivity) {
      activityScore += 3 // Very high confidence for complete voice note sequence
    }
  }

  // 5. VOICE NOTE RECEIVED DETECTION: APNs + WhatsApp signalling + media CDN (voice note playback)
  // Pattern: APNs notification → WhatsApp signalling → media CDN (voice note received and played)
  if (!isVoiceCall && !isMediaTransfer) {
    for (const apnsEntry of apnsEntries) {
      const whatsappSignalling = findEntriesInWindow(sortedEntries, apnsEntry.parsedTimestamp, 0, 300) // 5 minute window
        .filter(entry => WHATSAPP_ACTIVITY_INDICATORS.signalling.some(pattern => entry.domain.includes(pattern)))
      
      if (whatsappSignalling.length > 0) {
        // Check for media CDN (indicates voice note playback, not call)
        const voiceNoteMedia = findEntriesInWindow(sortedEntries, apnsEntry.parsedTimestamp, 0, 300)
          .filter(entry => entry.domain.includes('media-') && entry.domain.includes('cdn.whatsapp.net'))
        
        // Check for Apple system activity (if present, it's likely a call, not voice note)
        const appleSystemActivity = findEntriesInWindow(sortedEntries, apnsEntry.parsedTimestamp, 30, 30)
          .filter(entry => 
            entry.domain.includes('apple.com') || 
            entry.domain.includes('icloud.com')
          )
        
        if (voiceNoteMedia.length > 0 && appleSystemActivity.length < 2) {
          // Media CDN + minimal Apple activity = voice note received
          isMediaTransfer = true
          activityScore += 6
          break
        }
      }
    }
  }

  // 6. MEDIA RECEIVED DETECTION: media-*.cdn.whatsapp.net without call patterns
  if (hasMediaDownload && !hasMediaUpload && !isVoiceCall) {
    isMediaTransfer = true
    activityScore += 4
  }

  // 7. PERSISTENT CONNECTION DETECTION: Improve classification for ongoing conversations
  // When we detect media activity but not strong text patterns, it could be persistent connection
  if (isMediaTransfer && !isTextMessage && activityScore >= 4) {
    // Media activity during persistent connection should still count as messaging
    // This handles the case where ongoing conversations show minimal DNS activity
    isTextMessage = true
    activityScore += 2 // Boost confidence for persistent connection messaging
  }

  // Minimal score for any WhatsApp presence
  if (activityScore === 0 && (hasCore || hasSignalling)) {
    activityScore = 1
  }

  return {
    isTextMessage,
    isMediaTransfer,
    isVoiceCall,
    isVideoCall,
    activityScore,
    callDirection
  }
}

export function detectFacebookActivity(windowEntries: ProcessedLogEntry[]) {
  // Sort entries by timestamp for temporal analysis
  const sortedEntries = [...windowEntries].sort((a, b) => a.parsedTimestamp.getTime() - b.parsedTimestamp.getTime())
  
  
  let isMessaging = false
  let isMediaTransfer = false
  let isBackgroundRefresh = false
  let isInstagramActivity = false
  let isReelsScrolling = false // NEW: Specific Reels detection
  let activityScore = 0
  let isCall = false

  // Check for Facebook activity patterns using sophisticated algorithm
  const hasCalls = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.calls)
  const hasTextSend = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.textSend)
  const hasMessagingMQTT = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.messaging)
  const hasMediaUpload = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.mediaUpload)
  const hasMediaDownload = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.mediaDownload)
  const hasCore = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.core)
  const hasBackground = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.background)
  const hasReelsVideo = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.reelsVideo)

  if (!hasCore && !hasMessagingMQTT && !hasTextSend && !hasMediaUpload) {
    return { isMessaging, isMediaTransfer, isBackgroundRefresh, isInstagramActivity, isReelsScrolling, activityScore, isCall }
  }

  // SOPHISTICATED FACEBOOK/MESSENGER DETECTION ALGORITHM

  // 0. CRITICAL: REELS/VIDEO CONTENT DETECTION (Prevents false messaging positives)
  // This is the key edge case that creates trust issues - Reels viewing looks like messaging!
  if (hasReelsVideo) {
    // Check for video streaming indicators that distinguish from real messaging
    const hasVideoStaticAssets = sortedEntries.some(entry => 
      entry.domain.includes('static-') && entry.domain.includes('.xx.fbcdn.net')
    )
    const hasNetSeerCDN = sortedEntries.some(entry => 
      entry.domain.includes('-netseer-ipaddr-assoc.')
    )
    const hasExternalVideo = sortedEntries.some(entry => 
      entry.domain.includes('external-') && entry.domain.includes('.xx.fbcdn.net')
    )
    const hasOculusContent = sortedEntries.some(entry => 
      entry.domain.includes('oculuscdn.com') || entry.domain.includes('securecdn.oculus.com')
    )
    // CONSERVATIVE APPROACH: NetSeer CDN is ALWAYS definitive for Reels
    if (hasNetSeerCDN) {
      // NetSeer CDN indicates ongoing Reels - classify as video consumption
      // This prevents false messaging alerts during innocent Reels scrolling
      return { 
        isMessaging: false, 
        isMediaTransfer: false, 
        isBackgroundRefresh: true, 
        isInstagramActivity: false, 
        isReelsScrolling: true, 
        activityScore: 3, // Keep original score for consistency
        isCall: false 
      }
    } else if (hasVideoStaticAssets) {
      // Video static assets without strong messaging evidence = Reels
      isReelsScrolling = true
      activityScore = 3
      return { isMessaging, isMediaTransfer, isBackgroundRefresh, isInstagramActivity, isReelsScrolling, activityScore, isCall }
    }
  }

  // 1. CALL DETECTION: external.xx.fbcdn.net (STUN) + Messenger markers
  if (hasCalls && (hasMessagingMQTT || hasCore)) {
    // Check no decisive WhatsApp media signals in same window
    const whatsappInterference = sortedEntries.filter(entry => 
      entry.domain.includes('mmg.whatsapp.net') || 
      entry.domain.includes('media-') && entry.domain.includes('cdn.whatsapp.net')
    )
    
    if (whatsappInterference.length === 0) {
      isCall = true
      activityScore += 7 // High confidence for calls
    }
  }

  // 2. DETECT APP LAUNCH vs REAL ACTIVITY (REFINED)
  // Facebook app launch creates a burst of URLs, but we need to check for real messaging evidence first
  const totalFacebookDomains = sortedEntries.filter(entry => entry.domain.includes('facebook')).length
  const uniqueFacebookDomains = new Set(sortedEntries.filter(entry => entry.domain.includes('facebook')).map(e => e.domain)).size
  
  // Check for strong messaging evidence that overrides app launch detection
  // Strong evidence = actual media activity or E2EE chat activity, not just MQTT
  const hasE2EE = hasDomainPattern(sortedEntries, ['chat-e2ee.facebook.com'])
  
  // IMPROVED: More sophisticated app launch detection
  // App launch pattern: Many core Facebook domains + typical app launch domains
  const hasTypicalAppLaunchDomains = hasDomainPattern(sortedEntries, [
    'www.facebook.com', 'web.facebook.com', 'm.facebook.com',
    'gateway.facebook.com', 'graph.facebook.com', 'api.facebook.com',
    'star.fallback.c10r.facebook.com', 'lookaside.facebook.com'
  ])
  
  // If we see burst of Facebook activity with typical app launch domains, it's likely app launch
  // UNLESS we have very specific messaging patterns (not just any media/MQTT activity)
  // IMPROVED: Be more conservative about what constitutes "specific messaging evidence"
  // During app launch, web.facebook.com is very common, so be more selective
  const hasStrongTextSendEvidence = hasDomainPattern(sortedEntries, ['pm.facebook.com'])
  const hasWeakTextSendEvidence = hasDomainPattern(sortedEntries, ['web.facebook.com'])
  // IMPROVED: Consider temporal patterns - app launch = tight burst, messaging = more isolated
  const analyzeTemporalPattern = () => {
    if (!hasMediaUpload) return { isBurstPattern: false, isIsolatedPattern: false }
    
    // Find rupload entries and check temporal distribution
    const ruploadEntries = sortedEntries.filter(entry => entry.domain.includes('rupload.facebook.com'))
    if (ruploadEntries.length === 0) return { isBurstPattern: false, isIsolatedPattern: false }
    
    const ruploadTime = ruploadEntries[0].parsedTimestamp.getTime()
    
    // Count how many OTHER Facebook domains occur within 5 seconds of rupload
    const nearbyFacebookEntries = sortedEntries.filter(entry => 
      entry.domain.includes('facebook') && 
      !entry.domain.includes('rupload.facebook.com') &&
      Math.abs(entry.parsedTimestamp.getTime() - ruploadTime) <= 5000 // 5 second window
    )
    
    const isBurstPattern = nearbyFacebookEntries.length >= 6 // Many domains near rupload = burst
    const isIsolatedPattern = nearbyFacebookEntries.length <= 2 // Few domains near rupload = isolated
    
    return { isBurstPattern, isIsolatedPattern }
  }
  
  const { isBurstPattern, isIsolatedPattern } = analyzeTemporalPattern()
  
  const hasSpecificMessagingEvidence = (
    // Media upload in burst pattern is less likely to be messaging
    (hasMediaUpload && !isBurstPattern && (hasStrongTextSendEvidence || hasWeakTextSendEvidence || hasMessagingMQTT || hasE2EE)) ||
    // Isolated media upload with messaging context = strong evidence
    (hasMediaUpload && isIsolatedPattern && hasMessagingMQTT) ||
    (hasStrongTextSendEvidence && hasMessagingMQTT && !hasMediaUpload && !hasMediaDownload) || // Text-only messaging with pm.facebook.com
    (detectAPNs(sortedEntries).length > 0 && (hasMediaUpload || hasMediaDownload)) || // APNs + media = likely incoming/outgoing message
    // Allow web.facebook.com if it's isolated activity (not many domains)
    (hasWeakTextSendEvidence && uniqueFacebookDomains <= 5 && totalFacebookDomains <= 8)
  )
  // NOTE: Temporal pattern matters - burst vs isolated activity
  
  // BALANCED app launch detection - more conservative to allow real messaging
  const isLikelyAppLaunch = (
    // High threshold - only very obvious app launches
    (uniqueFacebookDomains >= 8 && totalFacebookDomains >= 10 && hasTypicalAppLaunchDomains && !hasMediaUpload && !hasMediaDownload) ||
    // Any activity with gateway + graph + edge-mqtt + www together (very obvious app launch) but NO media upload/download
    (hasDomainPattern(sortedEntries, ['gateway.facebook.com']) && 
     hasDomainPattern(sortedEntries, ['graph.facebook.com']) && 
     hasDomainPattern(sortedEntries, ['edge-mqtt.facebook.com']) &&
     hasDomainPattern(sortedEntries, ['www.facebook.com']) &&
     !hasMediaUpload && !hasMediaDownload &&
     !hasSpecificMessagingEvidence)
  )
  
  if (isLikelyAppLaunch) {
    // App launch detected - only count as background activity
    isBackgroundRefresh = true
    activityScore = 1
    return { isMessaging, isMediaTransfer, isBackgroundRefresh, isInstagramActivity, isReelsScrolling, activityScore, isCall }
  }


  // 3. TEXT SENT: pm.facebook.com/web.facebook.com + edge-mqtt.facebook.com, no upload, no media download
  // Must be ISOLATED activity, not part of app launch or ongoing NetSeer CDN Reels
  const hasNetSeerCDN = sortedEntries.some(entry => entry.domain.includes('-netseer-ipaddr-assoc.'))
  
  // BALANCED text messaging detection - allow both pm.facebook.com and web.facebook.com but be selective
  const hasStrictTextSendEvidence = hasDomainPattern(sortedEntries, ['pm.facebook.com'])
  // hasWeakTextSendEvidence is already defined above
  
  if (!isCall && (hasStrictTextSendEvidence || (hasWeakTextSendEvidence && uniqueFacebookDomains <= 4)) && hasMessagingMQTT && !hasMediaUpload && !hasMediaDownload && !isLikelyAppLaunch && !hasNetSeerCDN) {
    isMessaging = true
    activityScore += 6 // High confidence for text sent
  }

  // 4. MESSAGE + PHOTO EXCHANGE PATTERN: Revised based on real-world validation
  // Test validation: 08:08 UTC and 16:08 UTC showed messaging without strict APNs requirement
  // CRITICAL: Check for ongoing Reels activity that could explain messaging domains
  
  // Check for media upload/download patterns with messaging context
  // IMPROVED: Be more conservative - don't flag as messaging if we have app launch indicators
  const hasAppLaunchIndicators = (
    uniqueFacebookDomains >= 7 && 
    totalFacebookDomains >= 8 && 
    hasTypicalAppLaunchDomains
  )
  
  // NetSeer CDN detection is handled earlier in the reels detection section
  // (hasNetSeerCDN variable is already defined above)
  
  if ((hasMediaUpload || hasMediaDownload) && !hasNetSeerCDN) {
    const hasUpload = hasDomainPattern(sortedEntries, ['rupload.facebook.com'])
    const hasDownload = hasDomainPattern(sortedEntries, ['scontent-', 'fbcdn.net'])
    const hasE2EE = hasDomainPattern(sortedEntries, ['chat-e2ee.facebook.com'])
    const hasMessagingContext = hasMessagingMQTT || hasE2EE || hasDomainPattern(sortedEntries, ['gateway.facebook.com', 'graph.facebook.com'])
    
    // CRITICAL FIX: Media upload/download should override app launch detection when there's messaging context
    // This handles the real messaging patterns like the 10:08 "Hello lief" test
    const hasStrongMessagingEvidence = 
      hasStrongTextSendEvidence || 
      (hasE2EE && hasMessagingContext) ||  // E2EE + messaging context is strong evidence
      (hasUpload && hasMessagingContext) ||  // Upload + messaging context is strong evidence  
      detectAPNs(sortedEntries).length > 0 ||
      (hasWeakTextSendEvidence && uniqueFacebookDomains <= 5)
    
    if (hasMessagingContext && (hasStrongMessagingEvidence || !isLikelyAppLaunch)) {
      if (hasUpload && hasDownload) {
        // Both upload and download = message exchange with photos
        isMessaging = true
        isMediaTransfer = true
        activityScore += 9 // Very high confidence for complete exchange
      } else if (hasUpload && (hasTextSend || hasE2EE || hasMessagingContext)) {
        // Upload with messaging context = sending photo/media
        isMessaging = true
        isMediaTransfer = true
        activityScore += 8 // High confidence for media sent
      } else if (hasDownload && hasE2EE && hasMessagingMQTT) {
        // Download + E2EE + MQTT = receiving message with photo
        isMessaging = true
        isMediaTransfer = true
        activityScore += 7 // High confidence for media received
      }
    }
    
    // Secondary pattern: APNs-triggered activity (for incoming messages)
    const apnsEntries = detectAPNs(sortedEntries)
    if (apnsEntries.length > 0 && !isMessaging) {
      for (const apnsEntry of apnsEntries) {
        const facebookActivity = findEntriesInWindow(sortedEntries, apnsEntry.parsedTimestamp, 0, 300) // Extended to 5 minutes
          .filter(entry => entry.domain.includes('facebook'))
        
        if (facebookActivity.length > 0 && (hasUpload || hasDownload)) {
          isMessaging = true
          if (hasUpload || hasDownload) isMediaTransfer = true
          activityScore += 6 // Medium-high confidence for APNs-triggered activity
          break
        }
      }
    }
  }

  // 5. API-BASED MESSAGING: chat-e2ee + star.fallback + core domains
  // CRITICAL FIX: Be much more restrictive about API-based messaging detection
  const hasAPI = hasDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.api)
  if (!isCall && !isMessaging && (hasMessagingMQTT || hasAPI) && !isLikelyAppLaunch && !hasNetSeerCDN) {
    // E2EE messaging or API activity indicates real messaging
    const hasE2EE = hasDomainPattern(sortedEntries, ['chat-e2ee.facebook.com'])
    const hasStarFallback = hasDomainPattern(sortedEntries, ['star.fallback.c10r.facebook.com'])
    const hasAPNsEvidence = detectAPNs(sortedEntries).length > 0
    
    // CRITICAL FIX: Require APNs evidence for MQTT-only detection, or strong API patterns
    if ((hasE2EE && hasStarFallback) || (hasStarFallback && hasAPNsEvidence) || (hasE2EE && hasAPNsEvidence)) {
      isMessaging = true
      if (hasE2EE && hasStarFallback) {
        activityScore += 6 // High confidence for E2EE + API
      } else if (hasE2EE || hasStarFallback) {
        activityScore += 5 // Medium-high confidence
      }
    }
    // Remove standalone MQTT detection here - it's handled in section 6 with stricter rules
  }

  // 6. ISOLATED NOTIFICATION RECEIVED: edge-mqtt.facebook.com alone (no send UI, no media, not app launch)
  // CRITICAL FIX: Be much more restrictive about isolated MQTT detection
  if (!isCall && !isMessaging && hasMessagingMQTT && !hasTextSend && !hasMediaUpload && !hasMediaDownload && !isLikelyAppLaunch && !hasNetSeerCDN) {
    // Additional check: must be VERY isolated MQTT activity
    const mqttEntries = sortedEntries.filter(entry => entry.domain.includes('edge-mqtt.facebook.com'))
    const otherFacebookEntries = sortedEntries.filter(entry => 
      entry.domain.includes('facebook') && !entry.domain.includes('edge-mqtt.facebook.com')
    )
    
    // CRITICAL FIX: Only classify as messaging if MQTT is truly isolated (≤1 other Facebook domain) AND has APNs
    const hasAPNsEvidence = detectAPNs(sortedEntries).length > 0
    if (mqttEntries.length >= 1 && otherFacebookEntries.length <= 1 && hasAPNsEvidence) {
      isMessaging = true
      activityScore += 4 // Medium confidence for notification received with APNs
    }
  }

  // 7. MEDIA SENT: rupload.facebook.com present (but ONLY if part of messaging activity)
  if (hasMediaUpload && !isLikelyAppLaunch && isMessaging) {
    // Only count rupload if we already detected messaging activity
    isMediaTransfer = true
    activityScore += 3 // Lower score since it requires messaging context
  }

  // 8. MEDIA RECEIVED: scontent.*.fbcdn.net ONLY if part of messaging activity
  if (hasMediaDownload && !hasMediaUpload && !isLikelyAppLaunch && isMessaging) {
    // Only count scontent if we already detected messaging activity
    isMediaTransfer = true
    activityScore += 2 // Lower score since it requires messaging context
  }
  
  // IMPORTANT: Isolated rupload or scontent without messaging context = insufficient evidence

  // 9. INSTAGRAM ACTIVITY: Check for Instagram-specific patterns
  const instagramEntries = sortedEntries.filter(entry => entry.domain.includes('instagram'))
  if (instagramEntries.length > 0) {
    isInstagramActivity = true
    activityScore += 3
  }

  // 7. TIE-BREAKER LOGIC: When both WhatsApp and Facebook signals present
  // Count app-specific hits - this is handled at a higher level

  // 9. BACKGROUND REFRESH: Only basic domain access without specific activity patterns
  if (!isMessaging && !isMediaTransfer && !isCall && !isInstagramActivity && 
      (hasBackground || (hasCore && countDomainPattern(sortedEntries, FACEBOOK_ACTIVITY_INDICATORS.core) <= 2))) {
    isBackgroundRefresh = true
    activityScore = 1 // Minimal score for background activity
  }

  // Minimal score for any Facebook presence
  if (activityScore === 0 && hasCore) {
    activityScore = 1
  }

  return {
    isMessaging,
    isMediaTransfer,
    isBackgroundRefresh,
    isInstagramActivity,
    isReelsScrolling,
    activityScore,
    isCall
  }
}
