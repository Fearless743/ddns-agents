import { ServerCard } from '@/components/ServerCard'

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

export function ServerList({ servers }: { servers: any[] }) {
  if (servers.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">No servers connected</h3>
        <p className="mt-2 text-gray-600">Start your DDNS agent to see server information here</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {servers.map((server: Server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  )
}
