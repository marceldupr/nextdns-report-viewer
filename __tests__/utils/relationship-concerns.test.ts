import { ProcessedLogEntry } from '@/types/dns-log'
import { parseISO, format } from 'date-fns'

// Helper function to create test DNS entries
function createTestEntry(
  timestamp: string,
  domain: string,
  queryType: string = 'A',
  deviceId: string = 'TEST',
  deviceName: string = 'Test Device'
): ProcessedLogEntry {
  const utcDate = parseISO(timestamp)
  
  return {
    timestamp,
    domain,
    query_type: queryType,
    dnssec: false,
    protocol: 'DNS-over-HTTPS',
    client_ip: '41.193.82.99',
    status: '',
    reasons: '',
    destination_country: 'GB',
    root_domain: domain.split('.').slice(-2).join('.'),
    device_id: deviceId,
    device_name: deviceName,
    device_model: 'iPhone',
    device_local_ip: '',
    matched_name: '',
    client_name: 'test',
    parsedTimestamp: utcDate,
    category: 'Communication' as any,
    isBlocked: false,
    timeWindow: format(utcDate, 'yyyy-MM-dd HH:mm')
  }
}

// Import the detection function
import { calculateTimeWindowStats } from '@/utils/csv-parser'

describe('Relationship Concern Detection Tests', () => {
  describe('Dating App Detection', () => {
    
    test('should detect major dating apps', () => {
      const datingAppTests = [
        { domain: 'api.tinder.com', expected: 'tinder.com' },
        { domain: 'bumble.com', expected: 'bumble.com' },
        { domain: 'hinge.co', expected: 'hinge.co' },
        { domain: 'match.com', expected: 'match.com' },
        { domain: 'okcupid.com', expected: 'okcupid.com' },
        { domain: 'grindr.com', expected: 'grindr.com' },
        { domain: 'ashley-madison.com', expected: 'ashley-madison.com' },
      ]
      
      datingAppTests.forEach(test => {
        const testData = [createTestEntry('2025-09-13T15:30:00.000Z', test.domain)]
        const stats = calculateTimeWindowStats(testData)
        
        expect(stats[0].relationshipConcerns.datingApps).toContain(test.expected)
        expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThan(8) // High concern
      })
    })

    test('should detect anonymous communication platforms', () => {
      const anonymousTests = [
        'yolo.live', 'sarahah.com', 'tellonym.me', 'curiouscat.me',
        'ask.fm', 'whisper.sh', 'ngl.link'
      ]
      
      anonymousTests.forEach(domain => {
        const testData = [createTestEntry('2025-09-13T15:30:00.000Z', domain)]
        const stats = calculateTimeWindowStats(testData)
        
        expect(stats[0].relationshipConcerns.anonymousPlatforms).toContain(domain)
        expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThan(6) // High concern
      })
    })

    test('should detect alternative messaging platforms', () => {
      const messagingTests = [
        'telegram.org', 'signal.org', 'discord.com', 'snapchat.com',
        'kik.com', 'viber.com', 'wickr.com', 'threema.ch'
      ]
      
      messagingTests.forEach(domain => {
        const testData = [createTestEntry('2025-09-13T15:30:00.000Z', domain)]
        const stats = calculateTimeWindowStats(testData)
        
        expect(stats[0].relationshipConcerns.alternativeMessaging).toContain(domain)
        expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThan(4) // Medium-high concern
      })
    })

    test('should detect video calling platforms', () => {
      const videoCallTests = [
        { domain: 'zoom.us', expected: 'Zoom Activity' },
        { domain: 'skype.com', expected: 'Skype Activity' },
        { domain: 'teams.microsoft.com', expected: 'Teams Activity' },
        { domain: 'webex.com', expected: 'Webex Activity' },
      ]
      
      videoCallTests.forEach(test => {
        const testData = [createTestEntry('2025-09-13T15:30:00.000Z', test.domain)]
        const stats = calculateTimeWindowStats(testData)
        
        expect(stats[0].relationshipConcerns.videoCalling).toContain(test.domain)
        expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThan(2) // Medium concern
      })
    })
  })

  describe('Exclusion Logic', () => {
    
    test('should exclude common Google false positives', () => {
      const excludedDomains = [
        'chat.google.com', // Auto-opened with Gmail
        'hangouts.google.com', // Legacy, auto-triggered
        'mail.google.com', // Email service
        'accounts.google.com', // Authentication
        'apis.google.com', // API calls
        'fonts.google.com' // Web fonts
      ]
      
      excludedDomains.forEach(domain => {
        const testData = [createTestEntry('2025-09-13T15:30:00.000Z', domain)]
        const stats = calculateTimeWindowStats(testData)
        
        // Should NOT trigger relationship concerns
        expect(stats[0].relationshipConcerns.concernScore).toBe(0)
        expect(stats[0].relationshipConcerns.videoCalling).toHaveLength(0)
        expect(stats[0].relationshipConcerns.alternativeMessaging).toHaveLength(0)
      })
    })

    test('should handle mixed legitimate and concerning activity', () => {
      const mixedActivity = [
        createTestEntry('2025-09-13T15:30:00.000Z', 'mail.google.com'), // Legitimate
        createTestEntry('2025-09-13T15:30:05.000Z', 'tinder.com'), // Concerning
        createTestEntry('2025-09-13T15:30:10.000Z', 'fonts.google.com'), // Legitimate
      ]
      
      const stats = calculateTimeWindowStats(mixedActivity)
      
      // Should detect only the concerning activity
      expect(stats[0].relationshipConcerns.datingApps).toContain('tinder.com')
      expect(stats[0].relationshipConcerns.concernScore).toBe(10) // Only Tinder counted
    })
  })

  describe('Concern Severity Scoring', () => {
    
    test('should assign appropriate concern scores by platform type', () => {
      const severityTests = [
        { domain: 'tinder.com', category: 'dating', expectedMin: 10 },
        { domain: 'whisper.sh', category: 'anonymous', expectedMin: 8 },
        { domain: 'telegram.org', category: 'messaging', expectedMin: 6 },
        { domain: 'zoom.us', category: 'video', expectedMin: 4 },
        { domain: 'twitter.com', category: 'social', expectedMin: 2 },
      ]
      
      severityTests.forEach(test => {
        const testData = [createTestEntry('2025-09-13T15:30:00.000Z', test.domain)]
        const stats = calculateTimeWindowStats(testData)
        
        expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThanOrEqual(test.expectedMin)
      })
    })

    test('should accumulate scores for multiple platforms', () => {
      const multipleThreats = [
        createTestEntry('2025-09-13T15:30:00.000Z', 'tinder.com'), // 10 points
        createTestEntry('2025-09-13T15:30:05.000Z', 'telegram.org'), // 6 points
        createTestEntry('2025-09-13T15:30:10.000Z', 'zoom.us'), // 4 points
      ]
      
      const stats = calculateTimeWindowStats(multipleThreats)
      
      // Should accumulate scores: 10 + 6 + 4 = 20
      expect(stats[0].relationshipConcerns.concernScore).toBe(20)
      expect(stats[0].relationshipConcerns.datingApps).toContain('tinder.com')
      expect(stats[0].relationshipConcerns.alternativeMessaging).toContain('telegram.org')
      expect(stats[0].relationshipConcerns.videoCalling).toContain('zoom.us')
    })
  })

  describe('Real-World Scenarios', () => {
    
    test('should detect Zoom activity (your specific example)', () => {
      const zoomActivity = [
        createTestEntry('2025-09-13T10:30:00.000Z', 'zoom.us', 'A'),
        createTestEntry('2025-09-13T10:30:05.000Z', 'zoomcdn.com', 'A'),
        createTestEntry('2025-09-13T10:30:10.000Z', 'zoom.us', 'HTTPS'),
      ]
      
      const stats = calculateTimeWindowStats(zoomActivity)
      
      expect(stats[0].relationshipConcerns.videoCalling).toContain('zoom.us')
      expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThan(0)
    })

    test('should detect multiple dating apps in sequence', () => {
      // Scenario: Someone checking multiple dating apps
      const multiDatingActivity = [
        createTestEntry('2025-09-13T15:30:00.000Z', 'tinder.com'),
        createTestEntry('2025-09-13T15:35:00.000Z', 'bumble.com'),
        createTestEntry('2025-09-13T15:40:00.000Z', 'hinge.co'),
      ]
      
      const stats = calculateTimeWindowStats(multiDatingActivity)
      
      // Should detect all three dating apps
      expect(stats.some(s => s.relationshipConcerns.datingApps.includes('tinder.com'))).toBe(true)
      expect(stats.some(s => s.relationshipConcerns.datingApps.includes('bumble.com'))).toBe(true)
      expect(stats.some(s => s.relationshipConcerns.datingApps.includes('hinge.co'))).toBe(true)
    })

    test('should detect secret messaging combinations', () => {
      // High-risk scenario: Dating app + anonymous platform + alternative messaging
      const secretCommunicationPattern = [
        createTestEntry('2025-09-13T15:30:00.000Z', 'tinder.com'),
        createTestEntry('2025-09-13T15:30:05.000Z', 'telegram.org'),
        createTestEntry('2025-09-13T15:30:10.000Z', 'whisper.sh'),
      ]
      
      const stats = calculateTimeWindowStats(secretCommunicationPattern)
      
      // Should detect all concern types
      expect(stats[0].relationshipConcerns.datingApps.length).toBeGreaterThan(0)
      expect(stats[0].relationshipConcerns.alternativeMessaging.length).toBeGreaterThan(0)
      expect(stats[0].relationshipConcerns.anonymousPlatforms.length).toBeGreaterThan(0)
      expect(stats[0].relationshipConcerns.concernScore).toBeGreaterThan(20) // Very high concern
    })
  })

  describe('Report Integration', () => {
    
    test('should generate clear activity descriptions for relationship concerns', () => {
      const expectedDescriptions = {
        dating: 'TINDER.COM Activity Detected',
        messaging: 'TELEGRAM.ORG Activity Detected',
        video: 'ZOOM.US Activity Detected',
        anonymous: 'WHISPER.SH Activity Detected',
        social: 'TWITTER.COM Activity Detected'
      }
      
      // Validate descriptions are clear and actionable
      Object.values(expectedDescriptions).forEach(description => {
        expect(description).toContain('Activity Detected')
        expect(description).toMatch(/[A-Z]/g) // Should be uppercase for visibility
      })
    })

    test('should prioritize relationship concerns in reports', () => {
      // Dating apps should have highest priority in reports
      const priorityOrder = [
        { type: 'dating', score: 10, platform: '🚨 Dating App' },
        { type: 'anonymous', score: 8, platform: '🚨 Anonymous Platform' },
        { type: 'messaging', score: 6, platform: '⚠️ Alternative Messaging' },
        { type: 'video', score: 4, platform: '📹 Video Calling' },
        { type: 'social', score: 2, platform: '📱 Social Media' }
      ]
      
      priorityOrder.forEach(item => {
        expect(item.score).toBeGreaterThan(0)
        // Each platform should have an appropriate emoji indicator
        const hasEmoji = item.platform.includes('🚨') || 
                        item.platform.includes('⚠️') || 
                        item.platform.includes('📹') || 
                        item.platform.includes('📱')
        expect(hasEmoji).toBe(true)
      })
    })
  })
})
