'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { ServerDashboard } from '@/components/ServerDashboard'

interface Server {
  id: string
  hostname: string
  public_ip: string
  last_update: string
  cpu: {
    usage_percent: number
    cores: number
  }
  memory: {
    total: number
    used: number
    used_percent: number
  }
}

export default function Home() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch('/api/servers?path=servers')
        const data = await response.json()
        setServers(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Failed to fetch servers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchServers()
    const interval = setInterval(fetchServers, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar serverCount={servers.length} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <ServerDashboard servers={servers} />
        )}
      </main>
    </div>
  )
}
