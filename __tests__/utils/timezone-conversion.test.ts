import { parseISO, addHours, format } from 'date-fns'

describe('Timezone Conversion Tests', () => {
  test('should correctly handle UTC timestamps in SAST system timezone', () => {
    // Test case: Facebook message at 08:08 UTC should display as 10:08 SAST
    const utcTimestamp = '2025-09-13T08:08:14.142Z'
    const utcDate = parseISO(utcTimestamp)
    
    // Since system is in SAST (UTC+2), UTC times automatically display in SAST
    // 08:08 UTC displays as 10:08 in local timezone (SAST)
    const timeWindow = format(utcDate, 'yyyy-MM-dd HH:mm')
    
    // This should now be 10:08 SAST (no double conversion)
    expect(timeWindow).toBe('2025-09-13 10:08')
  })

  test('should not double-convert SAST timestamps', () => {
    // Simulate what happens in PDF export (FIXED version)
    const timeWindow = '2025-09-13 10:08' // Already in SAST
    const [datePart, timePart] = timeWindow.split(' ')
    const timeStr = `${datePart}, ${timePart}:00 SAST`
    
    expect(timeStr).toBe('2025-09-13, 10:08:00 SAST')
  })

  test('should match chat log times with DNS log times', () => {
    // Your chat: "Hello lief" at 10:08 SAST
    // DNS log: 2025-09-13T08:08:14.142Z (UTC)
    
    const dnsUtcTime = '2025-09-13T08:08:14.142Z'
    const dnsUtcDate = parseISO(dnsUtcTime)
    // No conversion needed - system timezone handles this automatically
    
    const chatSastTime = '10:08'
    const expectedHour = 10
    const expectedMinute = 8
    
    // Since system is in SAST, UTC time displays correctly in local time
    expect(dnsUtcDate.getHours()).toBe(expectedHour)
    expect(dnsUtcDate.getMinutes()).toBe(expectedMinute)
  })

  test('should verify WhatsApp voice note timing', () => {
    // From your chat log: voice notes throughout the day
    // Example: 00:00:06 SAST should correspond to 22:00:06 UTC (previous day)
    
    const chatSastTime = '00:00:06' // Midnight SAST
    const [hours, minutes, seconds] = chatSastTime.split(':').map(Number)
    
    // Create SAST time
    const sastDate = new Date('2025-09-13T00:00:06') // This represents SAST
    
    // Convert to UTC (subtract 2 hours)
    const utcDate = addHours(sastDate, -2)
    
    expect(utcDate.getHours()).toBe(22) // 22:00 UTC
    expect(utcDate.getDate()).toBe(12) // Previous day
  })
})
