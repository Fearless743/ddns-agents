import { setupWebSocketServer } from './src/lib/websocket'
import { createServer } from 'http'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const PORT = parseInt(process.env.PORT || '3000') + 1

app.prepare().then(() => {
  const server = createServer(handle)
  
  setupWebSocketServer(server)
  
  server.listen(PORT, () => {
    console.log(`> DDNS WS Server running on http://localhost:${PORT}`)
    console.log(`> WebSocket endpoint: ws://localhost:${PORT}/api/ws`)
  })
})
