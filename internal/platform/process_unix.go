//go:build linux || darwin

package platform

import (
	"fmt"
	"strconv"
	"strings"
)

// NewProcessDiscoverer creates a process discoverer for Unix-like systems
func NewProcessDiscoverer() ProcessDiscoverer {
	return &unixProcessDiscoverer{}
}

// unixProcessDiscoverer implements ProcessDiscoverer for Unix-like systems (Linux, macOS)
type unixProcessDiscoverer struct{}

// FindProcesses returns all running processes on Unix-like systems
func (u *unixProcessDiscoverer) FindProcesses() ([]ProcessInfo, error) {
	// Use ps to list all processes with PID, command name, and arguments
	output, err := runCommand("ps", "-eo", "pid,comm,args")
	if err != nil {
		return nil, fmt.Errorf("failed to list processes: %w", err)
	}

	var processes []ProcessInfo
	lines := strings.Split(output, "\n")

	// Skip header line
	for i, line := range lines {
		if i == 0 {
			continue
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse ps output: PID COMMAND    ARGS
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		pid := parsePID(fields[0])
		if pid == 0 {
			continue
		}

		name := fields[1]

		processes = append(processes, ProcessInfo{
			PID:  pid,
			Name: name,
		})
	}

	return processes, nil
}

// FindProcessByPort finds the process listening on a specific port on Unix-like systems
func (u *unixProcessDiscoverer) FindProcessByPort(port int) (*ProcessInfo, error) {
	// First check if port is in use
	if !checkPort(port) {
		return nil, nil
	}

	// Use lsof to find the process listening on the port
	output, err := runCommand("lsof", "-i", ":"+strconv.Itoa(port), "-P", "-n")
	if err != nil {
		return nil, fmt.Errorf("failed to run lsof: %w", err)
	}

	lines := strings.Split(output, "\n")

	// Skip header line
	for i, line := range lines {
		if i == 0 {
			continue
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse lsof output: COMMAND   PID   USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		pid := parsePID(fields[1])
		if pid == 0 {
			continue
		}

		name := fields[0]
		return &ProcessInfo{
			PID:  pid,
			Name: name,
		}, nil
	}

	return nil, fmt.Errorf("no process found listening on port %d", port)
}

// FindProcessByName finds processes by name on Unix-like systems
func (u *unixProcessDiscoverer) FindProcessByName(name string) ([]ProcessInfo, error) {
	// Use pgrep to find processes by name
	output, err := runCommand("pgrep", "-lf", name)
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

		// Parse pgrep output: PID ARGS
		fields := strings.SplitN(line, " ", 2)
		if len(fields) < 2 {
			continue
		}

		pid := parsePID(fields[0])
		if pid == 0 {
			continue
		}

		args := fields[1]
		// Extract the base name from args
		nameParts := strings.Fields(args)
		if len(nameParts) > 0 {
			name = nameParts[0]
		}

		processes = append(processes, ProcessInfo{
			PID:  pid,
			Name: name,
		})
	}

	if len(processes) == 0 {
		return nil, fmt.Errorf("no process found with name %s", name)
	}

	return processes, nil
}
