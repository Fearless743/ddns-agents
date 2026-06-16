package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// ServerInfo represents the server information collected from the agent
type ServerInfo struct {
	Hostname     string             `json:"hostname"`
	OS           string             `json:"os"`
	Platform     string             `json:"platform"`
	CPU          CPUInfo            `json:"cpu"`
	Memory       MemoryInfo         `json:"memory"`
	Disk         []DiskInfo         `json:"disk"`
	Network      []NetworkInfo      `json:"network"`
	PublicIP     string             `json:"public_ip"`
	LastUpdate   time.Time          `json:"last_update"`
	AgentVersion string             `json:"agent_version"`
}

type CPUInfo struct {
	UsagePercent float64 `json:"usage_percent"`
	Cores        int     `json:"cores"`
	ModelName    string  `json:"model_name"`
}

type MemoryInfo struct {
	Total        uint64  `json:"total"`
	Used         uint64  `json:"used"`
	UsedPercent  float64 `json:"used_percent"`
}

type DiskInfo struct {
	Mountpoint  string  `json:"mountpoint"`
	UsedPercent float64 `json:"used_percent"`
	FSType      string  `json:"fs_type"`
}

type NetworkInfo struct {
	Name        string  `json:"name"`
	BytesSent   uint64  `json:"bytes_sent"`
	BytesRecv   uint64  `json:"bytes_recv"`
	PacketsSent uint64  `json:"packets_sent"`
	PacketsRecv uint64  `json:"packets_recv"`
}

// IPUpdate represents an IP update report
type IPUpdate struct {
	Hostname  string `json:"hostname"`
	IPType    string `json:"ip_type"`
	OldIP     string `json:"old_ip"`
	NewIP     string `json:"new_ip"`
	Timestamp string `json:"timestamp"`
}

var agentVersion = "1.0.0"
var backendURL = "http://localhost:3000/api"
var updateInterval = 30 * time.Second

func main() {
	log.Printf("DDNS Agent v%s starting...", agentVersion)

	// Get backend URL from environment
	if url := os.Getenv("DDNS_BACKEND_URL"); url != "" {
		backendURL = url
	}
	if interval := os.Getenv("DDNS_UPDATE_INTERVAL"); interval != "" {
		if d, err := time.ParseDuration(interval); err == nil {
			updateInterval = d
		}
	}

	// Collect initial system info
	info := collectServerInfo()
	
	// Send initial report
	sendReport(info)

	// Setup signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start periodic updates
	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()

	log.Printf("Reporting to %s every %v", backendURL, updateInterval)

	for {
		select {
		case <-ticker.C:
			info := collectServerInfo()
			sendReport(info)
		case sig := <-sigChan:
			log.Printf("Received signal %v, shutting down...", sig)
			return
		}
	}
}

func collectServerInfo() *ServerInfo {
	info := &ServerInfo{
		AgentVersion: agentVersion,
		LastUpdate:   time.Now(),
	}

	// Host info
	hostInfo, err := host.Info()
	if err == nil {
		info.Hostname = hostInfo.Hostname
		info.OS = hostInfo.Platform + " " + hostInfo.PlatformVersion
		info.Platform = hostInfo.KernelArch
	} else {
		info.Hostname = getHostname()
	}

	// Public IP
	info.PublicIP = getPublicIP()

	// CPU info
	cpuInfo, _ := cpu.Info()
	if len(cpuInfo) > 0 {
		info.CPU.ModelName = cpuInfo[0].ModelName
		info.CPU.Cores = int(cpuInfo[0].Cores)
	}
	cpuPercent, _ := cpu.Percent(0, false)
	if len(cpuPercent) > 0 {
		info.CPU.UsagePercent = cpuPercent[0]
	}

	// Memory info
	memInfo, _ := mem.VirtualMemory()
	info.Memory = MemoryInfo{
		Total:       memInfo.Total,
		Used:        memInfo.Used,
		UsedPercent: memInfo.UsedPercent,
	}

	// Disk info
	diskParts, _ := disk.Partitions(false)
	for _, part := range diskParts {
		usage, _ := disk.Usage(part.Mountpoint)
		info.Disk = append(info.Disk, DiskInfo{
			Mountpoint:  part.Mountpoint,
			UsedPercent: usage.UsedPercent,
			FSType:      part.Fstype,
		})
	}

	// Network info
	ioStats, _ := net.IOCounters(false)
	for _, io := range ioStats {
		info.Network = append(info.Network, NetworkInfo{
			Name:        io.Name,
			BytesSent:   io.BytesSent,
			BytesRecv:   io.BytesRecv,
			PacketsSent: io.PacketsSent,
			PacketsRecv: io.PacketsRecv,
		})
	}

	return info
}

func getPublicIP() string {
	// Try multiple services for reliability
	services := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}

	client := &http.Client{Timeout: 5 * time.Second}

	for _, service := range services {
		resp, err := client.Get(service)
		if err == nil {
			defer resp.Body.Close()
			buf := new(bytes.Buffer)
			buf.ReadFrom(resp.Body)
			ip := buf.String()
			if ip != "" {
				return ip
			}
		}
	}

	return "unknown"
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func sendReport(info *ServerInfo) {
	client := &http.Client{Timeout: 10 * time.Second}

	// Send server info report
	reportData, err := json.Marshal(info)
	if err != nil {
		log.Printf("Error marshaling report: %v", err)
		return
	}

	resp, err := client.Post(backendURL+"/api/servers/report", "application/json", bytes.NewBuffer(reportData))
	if err != nil {
		log.Printf("Error sending report: %v", err)
		return
	}
	defer resp.Body.Close()

	log.Printf("Report sent successfully (HTTP %d)", resp.StatusCode)
}
