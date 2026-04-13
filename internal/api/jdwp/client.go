package jdwp

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// Client JDWP Client
type Client struct {
	conn       net.Conn
	host       string
	port       int
	timeout    time.Duration
	connected  bool
	mu         sync.Mutex
	idsizes    *IDSizes
	breakpoints map[string]*BreakpointInfo
	eventMutex sync.Mutex

	// Event streaming support
	eventStream *EventStream
	wsServer    *WebSocketServer
	wsPort      int
}

// BreakpointInfo Internal breakpoint information
type BreakpointInfo struct {
	ID        string
	RequestID uint32
	Location  string
	Enabled   bool
	HitCount  int
}

// IDSizes JDWP ID Size Information
type IDSizes struct {
	FieldIDSize    int
	MethodIDSize   int
	ObjectIDSize   int
	ReferenceTypeIDSize int
	FrameIDSize    int
}

// NewClient Creates a new JDWP client.
func NewClient() *Client {
	return &Client{
		port:        5005,
		timeout:     30 * time.Second,
		breakpoints: make(map[string]*BreakpointInfo),
		wsPort:      8080,
	}
}

// SetConfig Sets the client configuration
func (c *Client) SetConfig(host string, port int, timeout int) {
	c.host = host
	c.port = port
	if timeout > 0 {
		c.timeout = time.Duration(timeout) * time.Second
	}
}

// Connect establishes a connection
func (c *Client) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	// Establishing a TCP connection
	address := fmt.Sprintf("%s:%d", c.host, c.port)
	conn, err := net.DialTimeout("tcp", address, c.timeout)
	if err != nil {
		return &api.APIError{
			Type:    api.ConnectionError,
			Message: fmt.Sprintf("Unable to connect to %s", address),
			Cause:   err,
		}
	}

	c.conn = conn

	// Perform a handshake
	if err := c.performHandshake(ctx); err != nil {
		conn.Close()
		c.conn = nil
		return err
	}

	// Get ID Size
	if err := c.getIDSizesInternal(ctx); err != nil {
		conn.Close()
		c.conn = nil
		return err
	}

	c.connected = true
	return nil
}

// Close closes the connection
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return nil
	}

	// Stop event streaming if active
	if c.eventStream != nil {
		c.eventStream.Stop()
	}

	err := c.conn.Close()
	c.connected = false
	c.conn = nil
	return err
}

// IsConnected Checks the connection status
func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}

// sendPacket Send packet
func (c *Client) sendPacket(packet []byte) error {
	_, err := c.conn.Write(packet)
	return err
}

// readReply Read response packet
func (c *Client) readReply() (*ReplyPacket, error) {
	// Read length (4 bytes)
	lenBuf := make([]byte, 4)
	if _, err := c.conn.Read(lenBuf); err != nil {
		return nil, err
	}

	length := bytesToUint32(lenBuf)

	// Read remaining data
	data := make([]byte, length-4)
	if _, err := c.conn.Read(data); err != nil {
		return nil, err
	}

	return decodeReplyPacket(data)
}

// bytesToUint32 bytes array to uint32
func bytesToUint32(b []byte) uint32 {
	var v uint32
	for i := 0; i < 4; i++ {
		v = v<<8 + uint32(b[i])
	}
	return v
}

// encodeID Encoding ID
func encodeID(id string, size int) []byte {
	var idVal uint64
	fmt.Sscanf(id, "%d", &idVal)

	buf := make([]byte, size)
	for i := 0; i < size; i++ {
		shift := (size - 1 - i) * 8
		buf[i] = byte((idVal >> uint(shift)) & 0xFF)
	}
	return buf
}

// EnableStreaming enables event streaming with WebSocket support
func (c *Client) EnableStreaming() error {
	c.eventStream = NewEventStream(c)
	if err := c.eventStream.Start(); err != nil {
		return err
	}

	c.wsServer = NewWebSocketServer(c.wsPort, c.eventStream)
	go func() {
		if err := c.wsServer.Start(); err != nil {
			fmt.Printf("WebSocket server error: %v\n", err)
		}
	}()

	return nil
}

// ProtocolName Get protocol name
func (c *Client) ProtocolName() string {
	return "jdwp"
}

// SupportedLanguages Get a list of supported languages.
func (c *Client) SupportedLanguages() []string {
	return []string{"java", "kotlin", "scala"}
}

// Capabilities Get the set of features supported by the plugin
func (c *Client) Capabilities(ctx context.Context) (*types.Capabilities, error) {
	return &types.Capabilities{
		SupportsVersion:      true,
		SupportsThreads:      true,
		SupportsStack:        true,
		SupportsLocals:       true,
		SupportsBreakpoints:  true,
		SupportsSuspend:      true,
		SupportsResume:       true,
		SupportsStep:         true,
		SupportsCont:         true,
		SupportsNext:         true,
		SupportsFinish:       true,
		SupportsEvents:       true,
		SupportsWatchMode:    true,
		SupportsStreaming:    true,
	}, nil
}

// Suspend Suspends the entire VM or a specified thread.
func (c *Client) Suspend(ctx context.Context, threadID string) error {
	if threadID == "" {
		return c.SuspendVM(ctx)
	}
	return c.SuspendThread(ctx, threadID)
}

// Resume Resume execution
func (c *Client) Resume(ctx context.Context, threadID string) error {
	if threadID == "" {
		return c.ResumeVM(ctx)
	}
	return c.ResumeThread(ctx, threadID)
}

// init Register JDWP plugin
func init() {
	api.RegisterPlugin("jdwp", func() api.DebugProtocol {
		return NewClient()
	})
}
