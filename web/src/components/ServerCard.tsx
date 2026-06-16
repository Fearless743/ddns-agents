import { Cpu, MemoryStick } from 'lucide-react'

interface ServerCardProps {
  server: {
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
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`
}

export function ServerCard({ server }: ServerCardProps) {
  const getLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const getStatusColor = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000
    
    if (diff < 90) return 'bg-green-100 text-green-800'
    if (diff < 300) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="text-lg font-medium text-gray-900">{server.hostname}</h3>
              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(server.last_update)}`}>
                {getLastUpdate(server.last_update)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">IP: {server.public_ip}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <Cpu className="h-5 w-5 text-gray-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">CPU</p>
              <p className="text-xs text-gray-500">
                {server.cpu.usage_percent.toFixed(1)}% · {server.cpu.cores} cores
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <MemoryStick className="h-5 w-5 text-gray-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Memory</p>
              <p className="text-xs text-gray-500">
                {server.memory.used_percent.toFixed(1)}% · {formatBytes(server.memory.used)} / {formatBytes(server.memory.total)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
