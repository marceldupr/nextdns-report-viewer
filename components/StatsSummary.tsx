'use client'

import { Shield, Globe, Monitor, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { ProcessedLogEntry } from '@/types/dns-log'

interface StatsSummaryProps {
  data: ProcessedLogEntry[]
}

export default function StatsSummary({ data }: StatsSummaryProps) {
  const totalRequests = data.length
  const blockedRequests = data.filter(entry => entry.isBlocked).length
  const allowedRequests = totalRequests - blockedRequests
  const blockRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0
  
  const uniqueDomains = new Set(data.map(entry => entry.domain)).size
  const uniqueDevices = new Set(data.map(entry => entry.device_name).filter(Boolean)).size
  const uniqueCountries = new Set(data.map(entry => entry.destination_country).filter(Boolean)).size
  
  // Top domains
  const domainCounts = data.reduce((acc, entry) => {
    acc[entry.domain] = (acc[entry.domain] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Top blocked domains
  const blockedDomainCounts = data
    .filter(entry => entry.isBlocked)
    .reduce((acc, entry) => {
      acc[entry.domain] = (acc[entry.domain] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  
  const topBlockedDomains = Object.entries(blockedDomainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const stats = [
    {
      title: 'Total Requests',
      value: totalRequests.toLocaleString(),
      icon: Globe,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Blocked Requests',
      value: blockedRequests.toLocaleString(),
      icon: Shield,
      color: 'text-red-600',
      bg: 'bg-red-50',
      subtitle: `${blockRate.toFixed(1)}% blocked`
    },
    {
      title: 'Allowed Requests',
      value: allowedRequests.toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      subtitle: `${(100 - blockRate).toFixed(1)}% allowed`
    },
    {
      title: 'Unique Domains',
      value: uniqueDomains.toLocaleString(),
      icon: Globe,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: 'Active Devices',
      value: uniqueDevices.toLocaleString(),
      icon: Monitor,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    {
      title: 'Countries',
      value: uniqueCountries.toLocaleString(),
      icon: Globe,
      color: 'text-teal-600',
      bg: 'bg-teal-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-sm text-gray-500">{stat.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Top Domains and Blocked Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Domains */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Top Requested Domains
          </h3>
          <div className="space-y-3">
            {topDomains.map(([domain, count], index) => (
              <div key={domain} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 text-xs font-medium rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-900 truncate" title={domain}>
                    {domain.length > 40 ? `${domain.substring(0, 40)}...` : domain}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Blocked Domains */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
            Top Blocked Domains
          </h3>
          <div className="space-y-3">
            {topBlockedDomains.length > 0 ? (
              topBlockedDomains.map(([domain, count], index) => (
                <div key={domain} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-900 truncate" title={domain}>
                      {domain.length > 40 ? `${domain.substring(0, 40)}...` : domain}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No blocked domains in current filter</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
