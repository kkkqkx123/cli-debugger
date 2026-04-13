package api

import (
	"errors"
	"fmt"
	"strings"
	"sync"

	"cli-debugger/internal/platform"

	"github.com/spf13/viper"
)

var (
	// registry plugin registry
	registry = make(map[string]PluginFactory)
	// registryMutex Mutual exclusion lock that protects the registry.
	registryMutex sync.RWMutex
)

// RegisterPlugin RegisterPlugin
func RegisterPlugin(name string, factory PluginFactory) error {
	if name == "" {
		return errors.New("Plugin name cannot be null")
	}
	if factory == nil {
		return errors.New("The plugin factory function cannot be null")
	}

	registryMutex.Lock()
	defer registryMutex.Unlock()

	if _, exists := registry[name]; exists {
		return fmt.Errorf("Plug-in '%s' is registered", name)
	}

	registry[name] = factory
	return nil
}

// CreateClient Creates a debugging client
func CreateClient(protocolName string) (DebugProtocol, error) {
	if protocolName == "" {
		// Trying to auto-detect
		protocolName = AutoDetect()
		if protocolName == "" {
			return nil, errors.New("Protocol not specified and not automatically detected")
		}
	}

	registryMutex.RLock()
	factory, exists := registry[protocolName]
	registryMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("Agreement '%s' is not registered", protocolName)
	}

	return factory(), nil
}

// AutoDetect Automatically detects protocols
func AutoDetect() string {
	// Get port from configuration
	port := viper.GetInt("port")

	// If port is specified, try to find the process listening on it
	if port > 0 {
		discoverer := platform.NewProcessDiscoverer()
		proc, err := discoverer.FindProcessByPort(port)
		if err == nil && proc != nil {
			// Detect protocol based on process name
			if contains(proc.Name, "java") {
				return "jdwp"
			}
			// Future protocols can be added here
			// e.g., if contains(proc.Name, "node") { return "dap" }
		}
	}

	// Fallback to simple port inspection policy
	// 5005 is a common port for Java JDWP
	if port == 5005 {
		return "jdwp"
	}

	// The default return is the empty string, which means it cannot be detected
	return ""
}

// contains checks if a string contains a substring case-insensitively
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// GetRegisteredProtocols Get the list of registered protocols
func GetRegisteredProtocols() []string {
	registryMutex.RLock()
	defer registryMutex.RUnlock()

	protocols := make([]string, 0, len(registry))
	for name := range registry {
		protocols = append(protocols, name)
	}
	return protocols
}

// HasProtocol Checks if the protocol is registered
func HasProtocol(protocolName string) bool {
	registryMutex.RLock()
	_, exists := registry[protocolName]
	registryMutex.RUnlock()
	return exists
}