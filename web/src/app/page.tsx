'use client'

import { useState, useEffect, useRef } from 'react'
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

const API_BASE = '/api/servers'

export default function Home() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) {
      setToken(storedToken)
      fetchServers(storedToken)
      connectWebSocket(storedToken)
    } else {
      setShowLogin(true)
      setLoading(false)
    }
  }, [])

  const connectWebSocket = (authToken: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/ws?type=admin&token=${encodeURIComponent(authToken)}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WS connected')
      setWsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'server_added' || message.type === 'server_update') {
          setServers(prev => {
            const existing = prev.findIndex(s => s.id === message.data.id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = message.data
              return updated
            }
            return [...prev, message.data]
          })
        }
      } catch (err) {
        console.error('WS message error:', err)
      }
    }

    ws.onerror = (err) => {
      console.error('WS error:', err)
      setWsConnected(false)
    }

    ws.onclose = () => {
      console.log('WS disconnected')
      setWsConnected(false)
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (authToken) connectWebSocket(authToken)
      }, 3000)
    }

    wsRef.current = ws
  }

  const fetchServers = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE}?path=list`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const data = await response.json()
      setServers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch servers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleServerCreated = () => {
    fetchServers(token!)
  }

  const handleLogin = async () => {
    setLoginError('')
    try {
      const res = await fetch(`${API_BASE}?path=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('admin_token', data.token)
        setToken(data.token)
        setShowLogin(false)
        setUsername('')
        setPassword('')
        fetchServers(data.token)
        connectWebSocket(data.token)
      } else {
        setLoginError(data.error || '登录失败')
      }
    } catch {
      setLoginError('网络错误')
    }
  }

  const handleLogout = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    localStorage.removeItem('admin_token')
    setToken(null)
    setShowLogin(true)
    setServers([])
    setWsConnected(false)
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

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
      <Navbar serverCount={servers.length} onLogout={handleLogout} wsConnected={wsConnected} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <ServerDashboard servers={servers} token={token!} onSuccess={handleServerCreated} />
        )}
      </main>
    </div>
  )
}
