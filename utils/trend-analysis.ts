import { ProcessedLogEntry, TimeWindowStats } from '@/types/dns-log'
import { format, parseISO, differenceInDays, startOfDay, eachDayOfInterval, isSameDay } from 'date-fns'

export interface DailyTrend {
  date: string
  displayDate: string
  whatsappActivity: number
  facebookActivity: number
  totalCommunication: number
  vpnAttempts: number
  secretBehavior: number
  uniqueCountries: number
  peakHour: string
  deviceCount: number
}

export interface TrendComparison {
  current: DailyTrend
  previous: DailyTrend | null
  changes: {
    whatsappActivity: { value: number; percentage: number; trend: 'up' | 'down' | 'stable' }
    facebookActivity: { value: number; percentage: number; trend: 'up' | 'down' | 'stable' }
    totalCommunication: { value: number; percentage: number; trend: 'up' | 'down' | 'stable' }
    vpnAttempts: { value: number; percentage: number; trend: 'up' | 'down' | 'stable' }
    secretBehavior: { value: number; percentage: number; trend: 'up' | 'down' | 'stable' }
  }
}

export interface WeeklyPattern {
  dayOfWeek: string
  averageActivity: number
  peakHours: string[]
  isWeekend: boolean
}

export function calculateDailyTrends(data: ProcessedLogEntry[], timeWindowStats: TimeWindowStats[]): DailyTrend[] {
  if (data.length === 0) return []

  // Get date range from data
  const dates = data.map(entry => startOfDay(entry.parsedTimestamp))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  
  const dateRange = eachDayOfInterval({ start: minDate, end: maxDate })

  return dateRange.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayData = data.filter(entry => isSameDay(entry.parsedTimestamp, date))
    const dayStats = timeWindowStats.filter(stat => stat.timeWindow.startsWith(dateStr))

    // Calculate daily metrics
    const whatsappActivity = dayStats.filter(s => s.whatsappActivity.activityScore > 0).length
    const facebookActivity = dayStats.filter(s => s.facebookActivity.activityScore > 0).length
    const totalCommunication = dayStats.filter(s => s.isRealChat).length
    const vpnAttempts = dayStats.filter(s => s.isPossibleVPN).length
    const secretBehavior = dayStats.filter(s => s.isActingSecret).length
    
    const uniqueCountries = new Set(dayData.map(entry => entry.destination_country).filter(Boolean)).size
    const deviceCount = new Set(dayData.map(entry => entry.device_name).filter(Boolean)).size

    // Find peak hour
    const hourlyActivity = dayStats.reduce((acc, stat) => {
      const hour = stat.timeWindow.split(' ')[1]
      acc[hour] = (acc[hour] || 0) + stat.totalRequests
      return acc
    }, {} as Record<string, number>)
    
    const peakHour = Object.entries(hourlyActivity)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '00:00'

    return {
      date: dateStr,
      displayDate: format(date, 'MMM dd'),
      whatsappActivity,
      facebookActivity,
      totalCommunication,
      vpnAttempts,
      secretBehavior,
      uniqueCountries,
      peakHour,
      deviceCount
    }
  })
}

export function calculateTrendComparisons(dailyTrends: DailyTrend[]): TrendComparison[] {
  return dailyTrends.map((current, index) => {
    const previous = index > 0 ? dailyTrends[index - 1] : null
    
    const calculateChange = (currentVal: number, previousVal: number | null) => {
      if (previousVal === null || previousVal === 0) {
        return {
          value: currentVal,
          percentage: 0,
          trend: 'stable' as const
        }
      }
      
      const change = currentVal - previousVal
      const percentage = (change / previousVal) * 100
      
      return {
        value: change,
        percentage: Math.round(percentage),
        trend: Math.abs(percentage) < 10 ? 'stable' : percentage > 0 ? 'up' : 'down'
      } as const
    }

    return {
      current,
      previous,
      changes: {
        whatsappActivity: calculateChange(current.whatsappActivity, previous?.whatsappActivity || null),
        facebookActivity: calculateChange(current.facebookActivity, previous?.facebookActivity || null),
        totalCommunication: calculateChange(current.totalCommunication, previous?.totalCommunication || null),
        vpnAttempts: calculateChange(current.vpnAttempts, previous?.vpnAttempts || null),
        secretBehavior: calculateChange(current.secretBehavior, previous?.secretBehavior || null)
      }
    }
  })
}

export function calculateWeeklyPatterns(dailyTrends: DailyTrend[]): WeeklyPattern[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  return dayNames.map((dayName, dayIndex) => {
    const daysOfWeek = dailyTrends.filter((trend, index) => {
      const date = parseISO(trend.date + 'T00:00:00')
      return date.getDay() === dayIndex
    })

    if (daysOfWeek.length === 0) {
      return {
        dayOfWeek: dayName,
        averageActivity: 0,
        peakHours: [],
        isWeekend: dayIndex === 0 || dayIndex === 6
      }
    }

    const averageActivity = daysOfWeek.reduce((sum, day) => sum + day.totalCommunication, 0) / daysOfWeek.length
    
    // Find most common peak hours for this day of week
    const peakHourCounts = daysOfWeek.reduce((acc, day) => {
      acc[day.peakHour] = (acc[day.peakHour] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const peakHours = Object.entries(peakHourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([hour]) => hour)

    return {
      dayOfWeek: dayName,
      averageActivity: Math.round(averageActivity * 10) / 10,
      peakHours,
      isWeekend: dayIndex === 0 || dayIndex === 6
    }
  })
}

export function detectAnomalies(dailyTrends: DailyTrend[]): Array<{
  date: string
  type: 'communication_spike' | 'vpn_surge' | 'country_anomaly' | 'device_anomaly'
  description: string
  severity: 'medium' | 'high'
  value: number
}> {
  const anomalies: Array<{
    date: string
    type: 'communication_spike' | 'vpn_surge' | 'country_anomaly' | 'device_anomaly'
    description: string
    severity: 'medium' | 'high'
    value: number
  }> = []
  
  if (dailyTrends.length < 2) return anomalies

  // Calculate averages for baseline
  const avgCommunication = dailyTrends.reduce((sum, day) => sum + day.totalCommunication, 0) / dailyTrends.length
  const avgVPN = dailyTrends.reduce((sum, day) => sum + day.vpnAttempts, 0) / dailyTrends.length
  const avgCountries = dailyTrends.reduce((sum, day) => sum + day.uniqueCountries, 0) / dailyTrends.length
  const avgDevices = dailyTrends.reduce((sum, day) => sum + day.deviceCount, 0) / dailyTrends.length

  dailyTrends.forEach(day => {
    // Communication spike detection
    if (day.totalCommunication > avgCommunication * 2.5) {
      anomalies.push({
        date: day.date,
        type: 'communication_spike',
        description: `Unusually high communication activity (${day.totalCommunication} vs avg ${Math.round(avgCommunication)})`,
        severity: day.totalCommunication > avgCommunication * 4 ? 'high' : 'medium',
        value: day.totalCommunication
      })
    }

    // VPN surge detection
    if (day.vpnAttempts > avgVPN * 3 && day.vpnAttempts > 2) {
      anomalies.push({
        date: day.date,
        type: 'vpn_surge',
        description: `Significant increase in VPN attempts (${day.vpnAttempts} vs avg ${Math.round(avgVPN)})`,
        severity: day.vpnAttempts > avgVPN * 5 ? 'high' : 'medium',
        value: day.vpnAttempts
      })
    }

    // Country diversity anomaly
    if (day.uniqueCountries > avgCountries * 2 && day.uniqueCountries > 5) {
      anomalies.push({
        date: day.date,
        type: 'country_anomaly',
        description: `Unusual geographic diversity (${day.uniqueCountries} countries vs avg ${Math.round(avgCountries)})`,
        severity: day.uniqueCountries > avgCountries * 3 ? 'high' : 'medium',
        value: day.uniqueCountries
      })
    }

    // Device anomaly
    if (day.deviceCount > avgDevices * 1.5 && day.deviceCount > 3) {
      anomalies.push({
        date: day.date,
        type: 'device_anomaly',
        description: `More devices active than usual (${day.deviceCount} vs avg ${Math.round(avgDevices)})`,
        severity: 'medium',
        value: day.deviceCount
      })
    }
  })

  return anomalies.sort((a, b) => b.value - a.value)
}
