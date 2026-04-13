//go:build windows

package platform

import (
	"fmt"
	"strconv"
	"strings"
)

// windowsProcessDiscoverer implements ProcessDiscoverer for Windows
type windowsProcessDiscoverer struct{}

// FindProcesses returns all running processes on Windows
func (w *windowsProcessDiscoverer) FindProcesses() ([]ProcessInfo, error) {
	output, err := runCommand("tasklist", "/FO", "CSV", "/NH")
	if err != nil {
		return nil, fmt.Errorf("failed to list processes: %w", err)
	}

	var processes []ProcessInfo
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
		fields := strings.Split(line, "\",\"")
		if len(fields) < 2 {
			continue
		}

		name := strings.Trim(fields[0], "\"")
		pidStr := strings.Trim(fields[1], "\"")
		pid := parsePID(pidStr)

		if pid > 0 {
			processes = append(processes, ProcessInfo{
				PID:  pid,
				Name: name,
				Args: "",
			})
		}
	}

	return processes, nil
}

// FindProcessByPort finds the process listening on a specific port on Windows
func (w *windowsProcessDiscoverer) FindProcessByPort(port int) (*ProcessInfo, error) {
	// First check if port is in use
	if !checkPort(port) {
		return nil, fmt.Errorf("port %d is not in use", port)
	}

	// Use netstat to find the process listening on the port
	output, err := runCommand("netstat", "-ano")
	if err != nil {
		return nil, fmt.Errorf("failed to run netstat: %w", err)
	}

	lines := strings.Split(output, "\n")
	portStr := ":" + strconv.Itoa(port)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.Contains(line, portStr) {
			continue
		}

		// Look for LISTENING state
		if !strings.Contains(line, "LISTENING") {
			continue
		}

		// Parse netstat output: TCP    0.0.0.0:5005    0.0.0.0:0    LISTENING    12345
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		pid := parsePID(fields[4])
		if pid == 0 {
			continue
		}

		// Get process name using tasklist
		procOutput, err := runCommand("tasklist", "/FI", "PID eq "+strconv.Itoa(pid), "/FO", "CSV", "/NH")
		if err != nil {
			continue
		}

		procLines := strings.Split(procOutput, "\n")
		for _, procLine := range procLines {
			procLine = strings.TrimSpace(procLine)
			if procLine == "" {
				continue
			}

			procFields := strings.Split(procLine, "\",\"")
			if len(procFields) < 2 {
				continue
			}

			name := strings.Trim(procFields[0], "\"")
			return &ProcessInfo{
				PID:  pid,
				Name: name,
				Args: "",
			}, nil
		}
	}

	return nil, fmt.Errorf("no process found listening on port %d", port)
}

// FindProcessByName finds processes by name on Windows
func (w *windowsProcessDiscoverer) FindProcessByName(name string) ([]ProcessInfo, error) {
	output, err := runCommand("tasklist", "/FI", "IMAGENAME eq "+name, "/FO", "CSV", "/NH")
	if err != nil {
		return nil, fmt.Errorf("failed to find process by name: %w", err)
	}

	var processes []ProcessInfo
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
		fields := strings.Split(line, "\",\"")
		if len(fields) < 2 {
			continue
		}

		processName := strings.Trim(fields[0], "\"")
		pidStr := strings.Trim(fields[1], "\"")
		pid := parsePID(pidStr)

		if pid > 0 {
			processes = append(processes, ProcessInfo{
				PID:  pid,
				Name: processName,
				Args: "",
			})
		}
	}

	if len(processes) == 0 {
		return nil, fmt.Errorf("no process found with name %s", name)
	}

	return processes, nil
}
