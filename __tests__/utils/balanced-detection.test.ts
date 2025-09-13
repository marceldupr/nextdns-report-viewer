import { ProcessedLogEntry } from '@/types/dns-log'
import { detectFacebookActivity } from '@/utils/csv-parser'
import { parseISO, format } from 'date-fns'

// Helper function to create test DNS entries
function createTestEntry(
  timestamp: string,
  domain: string,
  queryType: string = 'A'
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
    root_domain: domain.includes('fbcdn.net') ? 'fbcdn.net' : domain.split('.').slice(-2).join('.'),
    device_id: 'CL8T6',
    device_name: 'iPhone',
    device_model: 'iPhone 13 Pro',
    device_local_ip: '',
    matched_name: '',
    client_name: 'nextdns-ios',
    parsedTimestamp: utcDate,
    category: 'Communication' as any,
    isBlocked: false,
    timeWindow: format(utcDate, 'yyyy-MM-dd HH:mm')
  }
}

describe('Balanced Detection Tests', () => {
  describe('CRITICAL Balance: Real Messaging vs Reels', () => {
    
    test('should detect REAL messaging (your 10:08 test) - NO NetSeer CDN', () => {
      // Your actual messaging test data - should still work
      const realMessaging = [
        createTestEntry('2025-09-13T08:08:14.142Z', 'rupload.facebook.com'),
        createTestEntry('2025-09-13T08:08:05.359Z', 'www.facebook.com'),
        createTestEntry('2025-09-13T08:08:04.666Z', 'chat-e2ee.facebook.com'),
        createTestEntry('2025-09-13T08:08:03.684Z', 'graph.facebook.com'),
        createTestEntry('2025-09-13T08:08:03.667Z', 'gateway.facebook.com'),
        // NO NetSeer CDN = real messaging
      ]
      
      const result = detectFacebookActivity(realMessaging)
      
      // Should detect as messaging (your original test)
      expect(result.isMessaging).toBe(true)
      expect(result.isMediaTransfer).toBe(true)
      expect(result.isReelsScrolling).toBe(false)
      expect(result.activityScore).toBeGreaterThan(6)
    })

    test('should detect REELS scrolling - WITH NetSeer CDN', () => {
      // Your real Reels data with NetSeer CDN
      const reelsScrolling = [
        createTestEntry('2025-09-13T20:56:00.000Z', '4bea6f62-e80c-4908-b0ed-c3701607fa3e-netseer-ipaddr-assoc.xy.fbcdn.net'),
        createTestEntry('2025-09-13T20:56:05.000Z', 'chat-e2ee.facebook.com'), // Background sync
        createTestEntry('2025-09-13T20:56:10.000Z', 'edge-mqtt.facebook.com'), // Background updates
        createTestEntry('2025-09-13T20:56:15.000Z', 'gateway.facebook.com'), // Background API
        // NetSeer CDN present = Reels, NOT messaging
      ]
      
      const result = detectFacebookActivity(reelsScrolling)
      
      
      // Should detect as Reels, NOT messaging
      expect(result.isReelsScrolling).toBe(true)
      expect(result.isMessaging).toBe(false)
      expect(result.isMediaTransfer).toBe(false)
      expect(result.activityScore).toBe(3)
    })

    test('should prioritize Reels when NetSeer CDN present (conservative approach)', () => {
      // Conservative approach: NetSeer CDN always indicates Reels, even with messaging domains
      const netSeerWithMessagingDomains = [
        createTestEntry('2025-09-13T20:56:00.000Z', '4bea6f62-netseer-ipaddr-assoc.xy.fbcdn.net'), // NetSeer CDN
        createTestEntry('2025-09-13T20:56:05.000Z', 'rupload.facebook.com'), // Analytics upload
        createTestEntry('2025-09-13T20:56:10.000Z', 'chat-e2ee.facebook.com'), // Background sync
        createTestEntry('2025-09-13T20:56:15.000Z', 'edge-mqtt.facebook.com'), // Background updates
        createTestEntry('2025-09-13T20:56:20.000Z', 'gateway.facebook.com'), // Background API
      ]
      
      const result = detectFacebookActivity(netSeerWithMessagingDomains)
      
      
      // Should prioritize Reels when NetSeer CDN present (conservative approach)
      expect(result.isReelsScrolling).toBe(true)
      expect(result.isMessaging).toBe(false) // Conservative: classify as Reels
      expect(result.activityScore).toBe(3)
    })
  })

  describe('Trust Issue Prevention Validation', () => {
    
    test('should prevent false messaging alerts during innocent Reels', () => {
      // The exact scenario that was causing trust issues
      const innocentReelsWithBackgroundDomains = [
        // NetSeer CDN (definitive Reels indicator)
        createTestEntry('2025-09-13T20:56:00.000Z', '4bea6f62-netseer-ipaddr-assoc.xy.fbcdn.net'),
        
        // Background domains that LOOK like messaging but aren't
        createTestEntry('2025-09-13T20:56:05.000Z', 'chat-e2ee.facebook.com'),
        createTestEntry('2025-09-13T20:56:10.000Z', 'edge-mqtt.facebook.com'),
        createTestEntry('2025-09-13T20:56:15.000Z', 'rupload.facebook.com'), // Analytics, not message
      ]
      
      const result = detectFacebookActivity(innocentReelsWithBackgroundDomains)
      
      // CRITICAL: Should NOT detect as messaging (trust issue prevention)
      expect(result.isMessaging).toBe(false)
      expect(result.isMediaTransfer).toBe(false)
      expect(result.isReelsScrolling).toBe(true)
      expect(result.activityScore).toBe(3)
    })

    test('should maintain detection accuracy for legitimate messaging', () => {
      // Ensure we don't lose legitimate messaging detection
      const legitimateMessagingWithoutReels = [
        createTestEntry('2025-09-13T08:08:14.142Z', 'rupload.facebook.com'),
        createTestEntry('2025-09-13T08:08:04.666Z', 'chat-e2ee.facebook.com'),
        createTestEntry('2025-09-13T08:08:03.684Z', 'graph.facebook.com'),
        // NO NetSeer CDN = should detect messaging
      ]
      
      const result = detectFacebookActivity(legitimateMessagingWithoutReels)
      
      // Should detect messaging when no Reels indicators
      expect(result.isMessaging).toBe(true)
      expect(result.isMediaTransfer).toBe(true)
      expect(result.isReelsScrolling).toBe(false)
    })
  })
})
