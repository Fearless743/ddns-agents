'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { ServerDashboard } from '@/components/ServerDashboard'

interface Server {
  id: string
  hostname: string
  public_ip: string
  last_update: string
  os: string
  platform: string
  agent_version: string
  created_at: string
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
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/servers?path=list')
      if (res.ok) {
        setIsLoggedIn(true)
        setShowLogin(false)
      } else if (res.status === 401) {
        setShowLogin(true)
      }
    } catch {
      setShowLogin(true)
    }
  }

  const handleLogin = async () => {
    setLoginError('')
    try {
      const res = await fetch('/api/servers?path=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setIsLoggedIn(true)
        setShowLogin(false)
        setUsername('')
        setPassword('')
        fetchServers()
      } else {
        setLoginError(data.error || '登录失败')
      }
    } catch {
      setLoginError('网络错误')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/servers?path=logout', { method: 'POST' })
    } catch {}
    setIsLoggedIn(false)
    setShowLogin(true)
    setServers([])
  }

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/servers?path=list')
      const data = await response.json()
      setServers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch servers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      fetchServers()
      const interval = setInterval(fetchServers, 30000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn])

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">DDNS Dashboard</h1>
            <p className="mt-2 text-gray-600">请登录以继续</p>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handleLogin() }}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            {loginError && (
              <p className="text-sm text-red-600 mb-4">{loginError}</p>
            )}
            
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              登录
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar serverCount={servers.length} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
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
