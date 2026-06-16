# DDNS Agents

A distributed DDNS (Dynamic DNS) system with real-time server monitoring dashboard.

## Architecture

- **Agent**: Go-based daemon that collects system metrics and reports to backend
- **Backend**: HTTP API server that receives and stores agent reports
- **Web Dashboard**: Next.js application for visualizing server status

## Quick Start

### 1. Start Backend Server

```bash
cd backend
go mod tidy
go run main.go
```

### 2. Start Web Dashboard

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 to view the dashboard.

### 3. Run Agent

```bash
cd agent
export DDNS_BACKEND_URL=http://localhost:4000
export DDNS_UPDATE_INTERVAL=30s
go mod tidy
go run main.go
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DDNS_BACKEND_URL` | Backend API URL | http://localhost:4000 |
| `DDNS_UPDATE_INTERVAL` | Report interval | 30s |

## Building Agent for Multiple Architectures

```bash
# Linux AMD64
GOOS=linux GOARCH=amd64 go build -o ddns-agent-amd64

# Linux ARM64
GOOS=linux GOARCH=arm64 go build -o ddns-agent-arm64

# Linux ARM v7
GOOS=linux GOARCH=arm GOARM=7 go build -o ddns-agent-armv7
```

## GitHub Actions

The project includes automated CI/CD pipeline that:
- Builds agent binaries for amd64, arm64, and armv7
- Runs tests on push/PR
- Publishes release artifacts

## Features

- Real-time server monitoring
- CPU, Memory, Disk, Network metrics
- Public IP detection and reporting
- Automatic reconnection
- Multi-platform support
- Beautiful web dashboard

## License

MIT
