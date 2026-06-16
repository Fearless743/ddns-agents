# DDNS Agents

A distributed DDNS (Dynamic DNS) system with real-time server monitoring dashboard.

## Architecture

- **Agent**: Go-based daemon that collects system metrics and reports to the web dashboard
- **Web Dashboard**: Next.js application with built-in API that receives and displays agent reports
- **Single Port**: Frontend and backend share the same port (3000)

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Start the Application

```bash
cd web
npm run dev
```

This starts both the web dashboard AND the API server on port 3000.

### 3. Run Agent

```bash
cd agent
export DDNS_BACKEND_URL=http://localhost:3000
export DDNS_UPDATE_INTERVAL=30s
go run main.go
```

Or with default values (no env vars needed, defaults to localhost:3000):

```bash
cd agent
go run main.go
```

## Project Structure

```
├── agent/              # Go agent (system metrics collector)
│   ├── main.go         # Agent entry point
│   ├── go.mod          # Go module dependencies
│   └── .env.example    # Environment variables
├── backend/            # Legacy standalone backend (not needed anymore)
├── web/                # Next.js dashboard + API
│   ├── src/
│   │   ├── app/        # Frontend pages
│   │   ├── components/ # React components
│   │   └── pages/api/  # API routes (receives agent reports)
│   ├── package.json
│   └── .env.example
└── .github/workflows/  # CI/CD for multi-arch builds
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DDNS_BACKEND_URL` | Web dashboard URL | http://localhost:3000 |
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

- Single port deployment (frontend + API on same port)
- Real-time server monitoring
- CPU, Memory, Disk, Network metrics
- Public IP detection and reporting
- Automatic reconnection
- Multi-platform support
- Beautiful web dashboard

## License

MIT
