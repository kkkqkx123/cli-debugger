//go:build !linux && !darwin && !windows

package platform

import (
	"fmt"
	"runtime"
)

// NewProcessDiscoverer creates a process discoverer for unsupported platforms
func NewProcessDiscoverer() ProcessDiscoverer {
	return &basicProcessDiscoverer{}
}

// basicProcessDiscoverer implements ProcessDiscoverer for unsupported platforms
type basicProcessDiscoverer struct{}

// FindProcesses returns an empty list on unsupported platforms
func (b *basicProcessDiscoverer) FindProcesses() ([]ProcessInfo, error) {
	return nil, fmt.Errorf("process discovery not supported on %s", runtime.GOOS)
}

// FindProcessByPort returns nil on unsupported platforms
func (b *basicProcessDiscoverer) FindProcessByPort(port int) (*ProcessInfo, error) {
	return nil, fmt.Errorf("process discovery not supported on %s", runtime.GOOS)
}

// FindProcessByName returns nil on unsupported platforms
func (b *basicProcessDiscoverer) FindProcessByName(name string) ([]ProcessInfo, error) {
	return nil, fmt.Errorf("process discovery not supported on %s", runtime.GOOS)
}
