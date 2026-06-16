import { NextResponse } from 'next/server'
import crypto from 'crypto'

interface Server {
  id: string
  hostname: string
  public_ip: string
  last_update: string
  os: string
  platform: string
  agent_version: string
  api_key_hash: string
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

interface AdminToken {
  username: string
  exp: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalStore = globalThis as any

if (!globalStore.ddnsStore) {
  globalStore.ddnsStore = {
    servers: {} as Record<string, Server>,
    apiKeys: new Map<string, string>(),
    adminWs: null as WebSocket | null,
  }
}

const store = globalStore.ddnsStore

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')

function verifyAgentToken(token: string, body: string, apiKey: string): boolean {
  const expected = crypto.createHmac('sha256', apiKey).update(body).digest('hex')
  return token === expected
}

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16)
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function generateJWT(payload: AdminToken): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url')
  return `${header}.${data}.${signature}`
}

function verifyJWT(token: string): AdminToken | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, data, signature] = parts
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url')
    if (signature !== expectedSig) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

function broadcastToAdmin(message: string) {
  if (store.adminWs && store.adminWs.readyState === WebSocket.OPEN) {
    store.adminWs.send(message)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''
  const token = searchParams.get('token') || ''

  if (path === 'ws') {
    // WebSocket upgrade
    const authError = requireAdminAuthByToken(token)
    if (authError) return authError

    store.adminWs = null as unknown as WebSocket

    const response = new NextResponse(null, { status: 101 })
    return response
  }

  if (path === 'health') {
    return NextResponse.json({ status: 'ok', time: new Date().toISOString() })
  }

  if (path === 'auth') {
    return NextResponse.json({ message: 'Use POST /api/servers?path=login' })
  }

  const authError = requireAdminAuth(request)
  if (authError) return authError

  if (path === 'list' || path === '') {
    const safeServers = Object.values(store.servers).map(({ api_key_hash, ...rest }) => rest)
    return NextResponse.json(safeServers)
  }

  if (path.startsWith('servers/')) {
    const serverId = path.replace('servers/', '')
    const server = store.servers[serverId]
    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    const { api_key_hash, ...safeServer } = server
    return NextResponse.json(safeServer)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''

  if (path === 'login') return await handleLogin(request)
  if (path === 'add') {
    const authError = requireAdminAuth(request)
    if (authError) return authError
    return await handleAddServer(request)
  }
  if (path === 'report') return await handleReport(request)
  if (path === 'reset-key') {
    const authError = requireAdminAuth(request)
    if (authError) return authError
    return await handleResetKey(request)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function handleLogin(request: Request) {
  const { username, password } = await request.json()
  if (username !== ADMIN_USERNAME || hashPassword(password) !== hashPassword(ADMIN_PASSWORD)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  const token = generateJWT({ username, exp: Date.now() + 24 * 60 * 60 * 1000 })
  return NextResponse.json({ status: 'ok', token, username, message: 'Login successful' })
}

async function handleAddServer(request: Request) {
  const { hostname } = await request.json()
  if (!hostname) return NextResponse.json({ error: 'Hostname is required' }, { status: 400 })

  const existingServer = Object.values(store.servers).find((s) => s.hostname === hostname)
  if (existingServer) return NextResponse.json({ error: 'Server already exists' }, { status: 409 })

  const apiKey = generateApiKey()
  const apiKeyHash = hashApiKey(apiKey)
  const serverId = `${hostname}-manual`

  store.servers[serverId] = {
    id: serverId,
    hostname,
    public_ip: 'manual',
    last_update: new Date().toISOString(),
    os: 'manual',
    platform: 'manual',
    agent_version: 'manual',
    api_key_hash: apiKeyHash,
    created_at: new Date().toISOString(),
    cpu: { usage_percent: 0, cores: 0, model_name: '' },
    memory: { total: 0, used: 0, used_percent: 0 },
    disk: [],
    network: [],
  }

  store.apiKeys.set(hostname, apiKey)

  const safeServer = { ...store.servers[serverId], api_key_hash: undefined }
  broadcastToAdmin(JSON.stringify({ type: 'server_added', data: safeServer }))

  return NextResponse.json({ status: 'created', hostname, api_key: apiKey, message: 'Server added successfully.' })
}

async function handleReport(request: Request) {
  const authHeader = request.headers.get('Authorization') || ''
  const serverId = request.headers.get('X-Server-ID') || ''
  const token = authHeader.replace('Bearer ', '')

  if (!token || !serverId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.text()
  const report = JSON.parse(body)

  const apiKey = store.apiKeys.get(serverId)
  if (!apiKey) return NextResponse.json({ error: 'Unknown server' }, { status: 401 })
  if (!verifyAgentToken(token, body, apiKey)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const server = createServerFromReport(report, apiKey)
  store.servers[server.id] = server

  const safeServer = { ...server, api_key_hash: undefined }
  broadcastToAdmin(JSON.stringify({ type: 'server_update', data: safeServer }))

  return NextResponse.json({ status: 'accepted', server: server.id, updated: server.last_update })
}

async function handleResetKey(request: Request) {
  const { hostname } = await request.json()
  if (!hostname) return NextResponse.json({ error: 'Hostname is required' }, { status: 400 })

  const existingKey = store.apiKeys.get(hostname)
  if (!existingKey) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  const newApiKey = generateApiKey()
  const apiKeyHash = hashApiKey(newApiKey)
  store.apiKeys.set(hostname, newApiKey)

  for (const [id, server] of Object.entries(store.servers)) {
    if (server.hostname === hostname) {
      server.api_key_hash = apiKeyHash
      store.servers[id] = server
      break
    }
  }

  return NextResponse.json({ hostname, api_key: newApiKey, message: 'API key reset successfully.' })
}

function requireAdminAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get('Authorization') || ''
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const decoded = verifyJWT(token)
  if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  return null
}

function requireAdminAuthByToken(token: string): NextResponse | null {
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 401 })
  const decoded = verifyJWT(token)
  if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  return null
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
    api_key_hash: hashApiKey(apiKey),
    created_at: store.servers[id]?.created_at || new Date().toISOString(),
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
