import { Cpu, MemoryStick, HardDrive, Network, Shield, Clock, RefreshCw, Plus } from 'lucide-react'
import { useState } from 'react'

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
    model_name: string
  }
  memory: {
    total: number
    used: number
    used_percent: number
  }
  disk: Array<{
    mountpoint: string
    used_percent: number
    fs_type: string
  }>
  network: Array<{
    name: string
    bytes_sent: number
    bytes_recv: number
    packets_sent: number
    packets_recv: number
  }>
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title: string
}

function Modal({ isOpen, onClose, children, title }: ModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CopyInput({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={value}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
    </div>
  )
}

export function ServerDashboard({ servers, token }: { servers: Server[]; token: string }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [newHostname, setNewHostname] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [resetHostname, setResetHostname] = useState('')
  const [resetKey, setResetKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const API_BASE = '/api/servers'

  const handleAddServer = async () => {
    if (!newHostname.trim()) return
    if (!token) {
      setError('未授权，请重新登录')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}?path=add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ hostname: newHostname.trim() }),
      })
      const data = await res.json()
      console.log('Add server response:', data)
      if (res.ok) {
        setGeneratedKey(data.api_key)
        setShowKeyModal(true)
      } else {
        setError(data.error || 'Failed to add server')
      }
    } catch (err) {
      console.error('Add server error:', err)
      setError('Network error')
    } finally {
      setLoading(false)
      setNewHostname('')
    }
  }

  const handleResetKey = async () => {
    if (!resetHostname.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}?path=reset-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ hostname: resetHostname.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetKey(data.api_key)
        setShowResetModal(true)
      } else {
        setError(data.error || 'Failed to reset key')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const getTimeAgo = (timestamp: string): string => {
    const diff = (Date.now() - new Date(timestamp).getTime()) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return `${Math.floor(diff / 86400)}天前`
  }

  const getStatusColor = (timestamp: string): string => {
    const diff = (Date.now() - new Date(timestamp).getTime()) / 1000
    if (diff < 90) return 'bg-green-100 text-green-800'
    if (diff < 300) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">暂无服务器</h3>
        <p className="mt-2 text-gray-600 mb-6">添加第一台服务器开始监控</p>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加服务器
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">服务器列表</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加服务器
        </button>
      </div>

      <div className="space-y-4">
        {servers.map((server) => (
          <div key={server.id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-gray-900">{server.hostname}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(server.last_update)}`}>
                      {getTimeAgo(server.last_update)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    IP: {server.public_ip} · {server.os} · {server.platform}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Agent v{server.agent_version} · 创建于 {new Date(server.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setResetHostname(server.hostname)
                    setError('')
                    setShowResetModal(true)
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  重置密钥
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <Cpu className="h-5 w-5 text-gray-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">CPU</p>
                    <p className="text-xs text-gray-500">
                      {server.cpu.usage_percent.toFixed(1)}% · {server.cpu.cores} 核
                      {server.cpu.model_name && ` · ${server.cpu.model_name}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <MemoryStick className="h-5 w-5 text-gray-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">内存</p>
                    <p className="text-xs text-gray-500">
                      {server.memory.used_percent.toFixed(1)}% · {formatBytes(server.memory.used)} / {formatBytes(server.memory.total)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <HardDrive className="h-5 w-5 text-gray-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">磁盘</p>
                    <p className="text-xs text-gray-500">
                      {server.disk.length} 个分区
                      {server.disk.length > 0 && ` · 最大 ${Math.max(...server.disk.map(d => d.used_percent)).toFixed(0)}%`}
                    </p>
                  </div>
                </div>
              </div>

              {server.network.length > 0 && (
                <div className="mt-4 flex items-center">
                  <Network className="h-5 w-5 text-gray-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">网络</p>
                    <p className="text-xs text-gray-500">
                      {server.network.map(n => `${n.name}: ↑${formatBytes(n.bytes_sent)} ↓${formatBytes(n.bytes_recv)}`).join(' · ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Server Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="添加服务器">
        <p className="text-sm text-gray-600 mb-4">输入服务器的主机名，系统将自动生成唯一的 API 密钥。</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">主机名</label>
          <input
            type="text"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            placeholder="例如: server-alpha"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
          />
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleAddServer}
          disabled={loading || !newHostname.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '创建中...' : '创建服务器'}
        </button>
      </Modal>

      {/* Show Generated Key Modal */}
      <Modal isOpen={showKeyModal} onClose={() => { setShowKeyModal(false); setShowAddModal(false); }} title="服务器已创建">
        <p className="text-sm text-gray-600 mb-4">请复制以下 API 密钥并配置到你的 Agent。此密钥只显示一次！</p>
        <CopyInput value={generatedKey} label="API Key" />
        <p className="text-xs text-gray-500 mb-4">
          在 Agent 上设置环境变量：<br/>
          <code className="bg-gray-100 px-1 rounded">DDNS_API_KEY={generatedKey}</code>
        </p>
        <button
          onClick={() => { setShowKeyModal(false); setShowAddModal(false); }}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          知道了
        </button>
      </Modal>

      {/* Reset Key Modal */}
      <Modal isOpen={showResetModal} onClose={() => { setShowResetModal(false); }} title="重置 API 密钥">
        <p className="text-sm text-gray-600 mb-4">
          确认要重置 <strong>{resetHostname}</strong> 的 API 密钥吗？<br/>
          重置后旧密钥将立即失效，需要更新 Agent 配置。
        </p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleResetKey}
          disabled={loading}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? '重置中...' : '确认重置'}
        </button>
      </Modal>

      {/* Show Reset Key Result Modal */}
      <Modal isOpen={showResetModal && resetKey} onClose={() => { setShowResetModal(false); setResetKey(''); }} title="密钥已重置">
        <p className="text-sm text-gray-600 mb-4">新 API 密钥已生成，请复制并更新 Agent 配置：</p>
        <CopyInput value={resetKey} label="新 API Key" />
        <button
          onClick={() => { setShowResetModal(false); setResetKey(''); }}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          关闭
        </button>
      </Modal>
    </>
  )
}
