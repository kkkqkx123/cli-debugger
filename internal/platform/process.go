package platform

// Process Discovery Interface
// To be realized in subsequent phases

type ProcessInfo struct {
	PID  int
	Name string
	Args []string
}

type ProcessDiscoverer interface {
	FindProcesses() ([]ProcessInfo, error)
	FindProcessByPort(port int) (*ProcessInfo, error)
	FindProcessByName(name string) ([]ProcessInfo, error)
}

func NewProcessDiscoverer() ProcessDiscoverer {
	// Platform-specific versions will be realized later
	return nil
}