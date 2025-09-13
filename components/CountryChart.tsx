'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { ProcessedLogEntry } from '@/types/dns-log'
import { Globe, AlertTriangle } from 'lucide-react'

interface CountryChartProps {
  data: ProcessedLogEntry[]
}

export default function CountryChart({ data }: CountryChartProps) {
  // Filter for communication-related entries only
  const communicationEntries = data.filter(entry => 
    entry.category === 'WhatsApp Domain Access' ||
    entry.category === 'Facebook Domain Access' ||
    entry.category === 'Other Messaging' ||
    entry.domain.includes('whatsapp') ||
    entry.domain.includes('facebook') ||
    entry.domain.includes('instagram') ||
    entry.domain.includes('messenger')
  )

  // Analyze countries for communication apps
  const countryStats = communicationEntries.reduce((acc, entry) => {
    if (entry.destination_country) {
      const country = entry.destination_country
      if (!acc[country]) {
        acc[country] = { 
          country,
          whatsapp: 0, 
          facebook: 0, 
          other: 0,
          total: 0,
          isUnusual: false
        }
      }
      acc[country].total++
      
      if (entry.domain.includes('whatsapp')) {
        acc[country].whatsapp++
      } else if (entry.domain.includes('facebook') || entry.domain.includes('instagram')) {
        acc[country].facebook++
      } else {
        acc[country].other++
      }
    }
    return acc
  }, {} as Record<string, any>)

  // Define normal vs unusual countries for VPN detection
  const normalCountries = ['US', 'GB', 'IE', 'NL', 'DE', 'FR', 'CA', 'AU', 'SG', 'BR', 'ZA']
  
  const chartData = Object.values(countryStats)
    .map((stats: any) => ({
      ...stats,
      isUnusual: !normalCountries.includes(stats.country),
      percentage: ((stats.total / communicationEntries.length) * 100).toFixed(1)
    }))
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 12) // Top 12 countries for better visibility

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const total = data.whatsapp + data.facebook + data.other
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
            <span>{label}</span>
            {data.isUnusual && (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            )}
          </p>
          <div className="space-y-1 text-sm">
            <p style={{ color: '#25D366' }}>WhatsApp: {data.whatsapp} ({((data.whatsapp/total)*100).toFixed(1)}%)</p>
            <p style={{ color: '#1877F2' }}>Facebook: {data.facebook} ({((data.facebook/total)*100).toFixed(1)}%)</p>
            {data.other > 0 && (
              <p style={{ color: '#6B7280' }}>Other: {data.other} ({((data.other/total)*100).toFixed(1)}%)</p>
            )}
            <p className="text-gray-600 border-t pt-1 mt-1">
              Total: {total} requests ({data.percentage}% of all communication)
            </p>
          </div>
          {data.isUnusual && (
            <div className="mt-2 p-2 bg-orange-50 rounded text-xs text-orange-700">
              ⚠️ Unusual destination country - possible VPN usage
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // Colors for different types
  const getBarColor = (entry: any) => {
    if (entry.isUnusual) return '#F97316' // Orange for unusual countries
    if (entry.whatsapp > entry.facebook) return '#25D366' // WhatsApp green
    if (entry.facebook > entry.whatsapp) return '#1877F2' // Facebook blue
    return '#6B7280' // Gray for mixed/other
  }

  const totalCountries = Object.keys(countryStats).length
  const unusualCountries = chartData.filter(d => d.isUnusual).length
  const topCountry = chartData[0]

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Communication by Country</span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Geographic distribution of WhatsApp, Facebook, and messaging traffic
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p><strong>{totalCountries}</strong> countries total</p>
          {unusualCountries > 0 && (
            <p className="text-orange-600 flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{unusualCountries} unusual</span>
            </p>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="country" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <Bar dataKey="whatsapp" name="WhatsApp" fill="#25D366" />
          <Bar dataKey="facebook" name="Facebook" fill="#1877F2" />
          <Bar dataKey="other" name="Other Messaging" fill="#6B7280" />
        </BarChart>
      </ResponsiveContainer>

      {/* Country insights */}
      <div className="mt-4 space-y-3">
        {/* Top country info */}
        {topCountry && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Primary Destination: {topCountry.country}
            </h4>
            <p className="text-xs text-blue-700">
              {topCountry.total} requests ({topCountry.percentage}% of communication traffic)
            </p>
          </div>
        )}

        {/* Unusual countries warning */}
        {unusualCountries > 0 && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="text-sm font-semibold text-orange-800 mb-1 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Unusual Countries Detected</span>
            </h4>
            <p className="text-xs text-orange-700">
              {unusualCountries} countries outside normal WhatsApp/Facebook server locations. 
              This could indicate VPN usage or unusual routing.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {chartData.filter(d => d.isUnusual).map(country => (
                <span key={country.country} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  {country.country}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Normal countries info */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">Standard Server Locations:</h4>
          <p className="text-xs text-gray-600">
            <strong>Normal:</strong> US (Primary), GB/IE (Europe), NL/DE (CDN), FR (Regional)
          </p>
          <p className="text-xs text-gray-600">
            <strong>Unusual countries</strong> are highlighted in orange and may indicate VPN or proxy usage.
          </p>
        </div>
      </div>
    </div>
  )
}
