package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// Server represents a connected DDNS agent server
type Server struct {
	ID         string    `json:"id"`
	Hostname   string    `json:"hostname"`
	PublicIP   string    `json:"public_ip"`
	LastUpdate time.Time `json:"last_update"`
	OS         string    `json:"os"`
	Platform   string    `json:"platform"`
	CPU        CPUInfo   `json:"cpu"`
	Memory     MemoryInfo `json:"memory"`
	Disk       []DiskInfo `json:"disk"`
	Network    []NetworkInfo `json:"network"`
	AgentVersion string  `json:"agent_version"`
}

type CPUInfo struct {
	UsagePercent float64 `json:"usage_percent"`
	Cores        int     `json:"cores"`
	ModelName    string  `json:"model_name"`
}

type MemoryInfo struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type DiskInfo struct {
	Mountpoint  string  `json:"mountpoint"`
	Label       string  `json:"label"`
	UsedPercent float64 `json:"used_percent"`
	FSType      string  `json:"fs_type"`
}

type NetworkInfo struct {
	Index       int     `json:"index"`
	Name        string  `json:"name"`
	BytesSent   uint64  `json:"bytes_sent"`
	BytesRecv   uint64  `json:"bytes_recv"`
	PacketsSent int64   `json:"packets_sent"`
	PacketsRecv int64   `json:"packets_recv"`
}

type ServerStore struct {
	mu      sync.RWMutex
	servers map[string]*Server
}

var store = &ServerStore{
	servers: make(map[string]*Server),
}

func main() {
	log.Println("DDNS Backend starting on :4000")

	http.HandleFunc("/api/health", healthHandler)
	http.HandleFunc("/api/report", reportHandler)
	http.HandleFunc("/api/servers", serversHandler)
	http.HandleFunc("/api/servers/", serverDetailHandler)

	log.Fatal(http.ListenAndServe(":4000", nil))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func reportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var report map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	server := &Server{}
	server.ID = getServerID(report)
	server.Hostname = getStringField(report, "hostname")
	server.PublicIP = getStringField(report, "public_ip")
	server.OS = getStringField(report, "os")
	server.Platform = getStringField(report, "platform")
	server.AgentVersion = getStringField(report, "agent_version")
	server.LastUpdate = time.Now()

	if cpu, ok := report["cpu"].(map[string]interface{}); ok {
		server.CPU = CPUInfo{
			UsagePercent: getFloatField(cpu, "usage_percent"),
			Cores:        getIntField(cpu, "cores"),
			ModelName:    getStringField(cpu, "model_name"),
		}
	}

	if mem, ok := report["memory"].(map[string]interface{}); ok {
		server.Memory = MemoryInfo{
			Total:       getUintField(mem, "total"),
			Used:        getUintField(mem, "used"),
			UsedPercent: getFloatField(mem, "used_percent"),
		}
	}

	if disks, ok := report["disk"].([]interface{}); ok {
		for _, d := range disks {
			if disk, ok := d.(map[string]interface{}); ok {
				server.Disk = append(server.Disk, DiskInfo{
					Mountpoint:  getStringField(disk, "mountpoint"),
					Label:       getStringField(disk, "label"),
					UsedPercent: getFloatField(disk, "used_percent"),
					FSType:      getStringField(disk, "fs_type"),
				})
			}
		}
	}

	if networks, ok := report["network"].([]interface{}); ok {
		for _, n := range networks {
			if net, ok := n.(map[string]interface{}); ok {
				server.Network = append(server.Network, NetworkInfo{
					Index:       getIntField(net, "index"),
					Name:        getStringField(net, "name"),
					BytesSent:   getUintField(net, "bytes_sent"),
					BytesRecv:   getUintField(net, "bytes_recv"),
					PacketsSent: getInt64Field(net, "packets_sent"),
					PacketsRecv: getInt64Field(net, "packets_recv"),
				})
			}
		}
	}

	store.mu.Lock()
	store.servers[server.ID] = server
	store.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "accepted",
		"server":  server.ID,
		"updated": server.LastUpdate.Format(time.RFC3339),
	})
}

func serversHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	store.mu.RLock()
	defer store.mu.RUnlock()

	servers := make([]Server, 0, len(store.servers))
	for _, server := range store.servers {
		servers = append(servers, *server)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(servers)
}

func serverDetailHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	serverID := r.URL.Path[len("/api/servers/"):]

	store.mu.RLock()
	server, exists := store.servers[serverID]
	store.mu.RUnlock()

	if !exists {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(server)
}

func getServerID(report map[string]interface{}) string {
	hostname := getStringField(report, "hostname")
	ip := getStringField(report, "public_ip")
	return fmt.Sprintf("%s-%s", hostname, ip)
}

func getStringField(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getFloatField(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

func getIntField(m map[string]interface{}, key string) int {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return 0
}

func getInt64Field(m map[string]interface{}, key string) int64 {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return int64(f)
		}
	}
	return 0
}

func getUintField(m map[string]interface{}, key string) uint64 {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return uint64(f)
		}
	}
	return 0
}
