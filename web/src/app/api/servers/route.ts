import { NextResponse } from 'next/server'

interface Server {
  id: string
  hostname: string
  public_ip: string
  last_update: string
  os: string
  platform: string
  agent_version: string
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

interface ServerStore {
  servers: Record<string, Server>
}

const store: ServerStore = {
  servers: {},
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''

  if (path === 'health') {
    return NextResponse.json({
      status: 'ok',
      time: new Date().toISOString(),
    })
  }

  if (path === 'list' || path === '') {
    return NextResponse.json(Object.values(store.servers))
  }

  if (path.startsWith('servers/')) {
    const serverId = path.replace('servers/', '')
    const server = store.servers[serverId]

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    return NextResponse.json(server)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: Request) {
  const report = await request.json()
  const server = createServerFromReport(report)
  store.servers[server.id] = server

  return NextResponse.json({
    status: 'accepted',
    server: server.id,
    updated: server.last_update,
  })
}

function createServerFromReport(report: Record<string, unknown>): Server {
  const hostname = getStringField(report, 'hostname') || 'unknown'
  const ip = getStringField(report, 'public_ip') || 'unknown'
  const id = `${hostname}-${ip}`

  return {
    id,
    hostname,
    public_ip: ip,
    last_update: new Date().toISOString(),
    os: getStringField(report, 'os'),
    platform: getStringField(report, 'platform'),
    agent_version: getStringField(report, 'agent_version'),
    cpu: getCPUInfo(report['cpu'] as Record<string, unknown>),
    memory: getMemoryInfo(report['memory'] as Record<string, unknown>),
    disk: getDiskInfos(report['disk'] as Array<Record<string, unknown>>),
    network: getNetworkInfos(report['network'] as Array<Record<string, unknown>>),
  }
}

function getCPUInfo(cpu: Record<string, unknown> | undefined) {
  if (!cpu) return { usage_percent: 0, cores: 0, model_name: '' }
  return {
    usage_percent: getFloatField(cpu, 'usage_percent'),
    cores: getIntField(cpu, 'cores'),
    model_name: getStringField(cpu, 'model_name'),
  }
}

function getMemoryInfo(mem: Record<string, unknown> | undefined) {
  if (!mem) return { total: 0, used: 0, used_percent: 0 }
  return {
    total: getUintField(mem, 'total'),
    used: getUintField(mem, 'used'),
    used_percent: getFloatField(mem, 'used_percent'),
  }
}

function getDiskInfos(disks: Array<Record<string, unknown>> | undefined) {
  if (!disks) return []
  return disks.map((d) => ({
    mountpoint: getStringField(d, 'mountpoint'),
    used_percent: getFloatField(d, 'used_percent'),
    fs_type: getStringField(d, 'fs_type'),
  }))
}

function getNetworkInfos(networks: Array<Record<string, unknown>> | undefined) {
  if (!networks) return []
  return networks.map((n) => ({
    name: getStringField(n, 'name'),
    bytes_sent: getUintField(n, 'bytes_sent'),
    bytes_recv: getUintField(n, 'bytes_recv'),
    packets_sent: getUintField(n, 'packets_sent'),
    packets_recv: getUintField(n, 'packets_recv'),
  }))
}

function getStringField(m: Record<string, unknown> | undefined, key: string): string {
  if (!m) return ''
  const v = m[key]
  return typeof v === 'string' ? v : ''
}

function getFloatField(m: Record<string, unknown> | undefined, key: string): number {
  if (!m) return 0
  const v = m[key]
  return typeof v === 'number' ? v : 0
}

function getIntField(m: Record<string, unknown> | undefined, key: string): number {
  if (!m) return 0
  const v = m[key]
  return typeof v === 'number' ? Math.floor(v) : 0
}

function getUintField(m: Record<string, unknown> | undefined, key: string): number {
  if (!m) return 0
  const v = m[key]
  return typeof v === 'number' ? v : 0
}
