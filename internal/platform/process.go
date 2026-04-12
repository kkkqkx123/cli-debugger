package platform

// 进程发现接口
// 将在后续阶段实现

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
	// 将在后续实现平台特定版本
	return nil
}