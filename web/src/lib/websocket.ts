import WebSocket from 'ws'
import crypto from 'crypto'
import http from 'http'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalStore = globalThis as any

if (!globalStore.ddnsStore) {
  globalStore.ddnsStore = {
    servers: {} as Record<string, any>,
    apiKeys: new Map<string, string>(),
  }
}

const store = globalStore.ddnsStore
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')

function verifyJWT(token: string): { username: string; exp: number } | null {
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

const wss = new WebSocket.Server({ noServer: true })

wss.on('connection', (ws, request) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const token = url.searchParams.get('token') || ''
  const type = url.searchParams.get('type') || ''

  if (type === 'admin') {
    const decoded = verifyJWT(token)
    if (!decoded) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid admin token' }))
      ws.close()
      return
    }
    ws.send(JSON.stringify({ type: 'connected', clientType: 'admin' }))
  } else if (type === 'agent') {
    const apiKey = decodeURIComponent(token)
    let matchedHostname: string | undefined
    for (const [hostname, key] of store.apiKeys) {
      if (key === apiKey) {
        matchedHostname = hostname
        break
      }
    }
    if (!matchedHostname) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid API key' }))
      ws.close()
      return
    }
    ws.send(JSON.stringify({ type: 'connected', clientType: 'agent', hostname: matchedHostname }))
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Type required (admin or agent)' }))
    ws.close()
    return
  }

  ws.on('message', (data) => {
    try {
      const message = data.toString()
      const parsed = JSON.parse(message)

      if (type === 'agent' && parsed.hostname) {
        const apiKey = store.apiKeys.get(parsed.hostname) || ''
        const hostname = parsed.hostname
        const ip = parsed.public_ip || 'unknown'
        const id = `${hostname}-${ip}`

        const server = {
          id,
          hostname,
          public_ip: ip,
          last_update: new Date().toISOString(),
          os: parsed.os || 'unknown',
          platform: parsed.platform || 'unknown',
          agent_version: parsed.agent_version || 'unknown',
          api_key_hash: apiKey ? apiKey.substring(0, 16) + '...' : '',
          created_at: store.servers[id]?.created_at || new Date().toISOString(),
          cpu: parsed.cpu || { usage_percent: 0, cores: 0, model_name: '' },
          memory: parsed.memory || { total: 0, used: 0, used_percent: 0 },
          disk: parsed.disk || [],
          network: parsed.network || [],
        }

        store.servers[id] = server

        const safeServer = { ...server, api_key_hash: undefined }
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client !== ws) {
            client.send(JSON.stringify({ type: 'server_update', data: safeServer }))
          }
        })
      }
    } catch (err) {
      console.error('WS message error:', err)
    }
  })

  ws.on('close', () => {
    console.log('WS client disconnected')
  })

  ws.on('error', (err) => {
    console.error('WS error:', err.message)
  })
})

export function setupWebSocketServer(server: http.Server) {
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`)
    if (url.pathname === '/api/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
  })
}
