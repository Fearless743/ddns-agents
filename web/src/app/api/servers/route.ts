import { NextResponse } from 'next/server'

interface Server {
  id: string
  hostname: string
  public_ip: string
  last_update: string
  os: string
  platform: string
  agent_version: string
  api_key_hash?: string
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
  apiKeys: Map<string, string>
}

const store: ServerStore = {
  servers: {},
  apiKeys: new Map(),
}

// HMAC-like token validation using SHA256
function verifyToken(token: string, body: string, apiKey: string): boolean {
  const crypto = require('crypto')
  const expected = crypto.createHmac('sha256', apiKey).update(body).digest('hex')
  return token === expected
}

// Generate a random API key
export function generateApiKey(): string {
  const crypto = require('crypto')
  return crypto.randomBytes(32).toString('hex')
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
    // Return servers without sensitive data
    const safeServers = Object.values(store.servers).map(({ api_key_hash, ...rest }) => rest)
    return NextResponse.json(safeServers)
  }

  if (path.startsWith('servers/')) {
    const serverId = path.replace('servers/', '')
    const server = store.servers[serverId]

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    const { api_key_hash, ...safeServer } = server
    return NextResponse.json(safeServer)
  }

  if (path === 'api-keys') {
    const keys = Array.from(store.apiKeys.entries()).map(([hostname, key]) => ({
      hostname,
      api_key: key,
    }))
    return NextResponse.json(keys)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''

  if (path === 'generate-key') {
    const { hostname } = await request.json()
    const apiKey = generateApiKey()
    store.apiKeys.set(hostname, apiKey)

    return NextResponse.json({
      hostname,
      api_key: apiKey,
      message: 'API key generated successfully',
    })
  }

  if (path !== 'report') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const authHeader = request.headers.get('Authorization') || ''
  const serverId = request.headers.get('X-Server-ID') || ''
  const token = authHeader.replace('Bearer ', '')

  // Validate authentication
  if (!token || !serverId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Read raw body for token verification
  const body = await request.text()
  const report = JSON.parse(body)

  // Find the API key for this server
  const apiKey = store.apiKeys.get(serverId)
  if (!apiKey) {
    return NextResponse.json({ error: 'Unknown server' }, { status: 401 })
  }

  // Verify token
  if (!verifyToken(token, body, apiKey)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Process the report
  const server = createServerFromReport(report, apiKey)
  store.servers[server.id] = server

  return NextResponse.json({
    status: 'accepted',
    server: server.id,
    updated: server.last_update,
  })
}

function createServerFromReport(report: Record<string, unknown>, apiKey: string): Server {
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
    api_key_hash: apiKey.substring(0, 16) + '...',
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
