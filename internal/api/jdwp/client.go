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
	if err := c.getIDSizes(ctx); err != nil {
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

// performHandshake executes the JDWP handshake.
func (c *Client) performHandshake(ctx context.Context) error {
	// JDWP Handshake Protocol: JVM sends "JDWP-Handshake", client writes back same string
	handshakeString := "JDWP-Handshake\x00"

	// Read the handshake string sent by the JVM
	buf := make([]byte, len(handshakeString))
	if _, err := c.conn.Read(buf); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake failure: unable to read JVM response",
			Cause:   err,
		}
	}

	// Verify Handshake String
	if string(buf) != handshakeString {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake Failure: Invalid JVM Response",
		}
	}

	// Write back the handshake string
	if _, err := c.conn.Write([]byte(handshakeString)); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake failure: response could not be sent",
			Cause:   err,
		}
	}

	return nil
}

// getIDSizes Get ID sizes information
func (c *Client) getIDSizes(ctx context.Context) error {
	// Send the VirtualMachine.IDSizes command
	packet := createCommandPacket(vmCommandSet, vmCommandIDSizes)
	if err := c.sendPacket(packet); err != nil {
		return err
	}

	reply, err := c.readReply()
	if err != nil {
		return err
	}

	// parse the response
	if len(reply.Data) < 20 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "IDSizes Response data is too short",
		}
	}

	c.idsizes = &IDSizes{
		FieldIDSize:    int(reply.Data[0]),
		MethodIDSize:   int(reply.Data[4]),
		ObjectIDSize:   int(reply.Data[8]),
		ReferenceTypeIDSize: int(reply.Data[12]),
		FrameIDSize:    int(reply.Data[16]),
	}

	return nil
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

// Version Get version information
func (c *Client) Version(ctx context.Context) (*types.VersionInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandVersion)
	if err := c.sendPacket(packet); err != nil {
		return nil, err
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, err
	}

	// Parsing version information
	reader := newPacketReader(reply.Data)

	jvmVersion, _ := reader.readString()
	jvmName, _ := reader.readString()
	jvmSpecVersion, _ := reader.readString()
	jvmSpecName, _ := reader.readString()
	jdwpVersion, _ := reader.readString()

	return &types.VersionInfo{
		ProtocolVersion: jdwpVersion,
		RuntimeVersion:  jvmVersion,
		RuntimeName:     jvmName,
		Description:     fmt.Sprintf("%s (%s)", jvmSpecName, jvmSpecVersion),
	}, nil
}

// GetThreads Get all threads
func (c *Client) GetThreads(ctx context.Context) ([]*types.ThreadInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandAllThreads)
	if err := c.sendPacket(packet); err != nil {
		return nil, err
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, err
	}

	reader := newPacketReader(reply.Data)
	threadCount := reader.readInt()

	threads := make([]*types.ThreadInfo, 0, threadCount)
	for i := 0; i < threadCount; i++ {
		threadID := reader.readID(c.idsizes.ObjectIDSize)
		name, _ := reader.readString()

		// Get thread status
		state, _ := c.getThreadStateInternal(threadID)

		threads = append(threads, &types.ThreadInfo{
			ID:          threadID,
			Name:        name,
			State:       state,
			Priority:    5, // Default Priority
			IsDaemon:    false,
			CreatedAt:   time.Now(),
		})
	}

	return threads, nil
}

// getThreadStateInternal Get thread state (internal method)
func (c *Client) getThreadStateInternal(threadID string) (string, error) {
	// TODO: 实现 ThreadReference.Status 命令
	return "running", nil
}

// GetThreadStack Get Thread Call Stack
func (c *Client) GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error) {
	// TODO: 实现 StackFrame.GetFrames 命令
	return []*types.StackFrame{}, nil
}

// GetThreadState Get Thread State
func (c *Client) GetThreadState(ctx context.Context, threadID string) (string, error) {
	return c.getThreadStateInternal(threadID)
}

// SuspendVM Hangs the entire VM.
func (c *Client) SuspendVM(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandSuspend)
	return c.sendPacket(packet)
}

// ResumeVM Recover VM
func (c *Client) ResumeVM(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandResume)
	return c.sendPacket(packet)
}

// SuspendThread Suspends the specified thread.
func (c *Client) SuspendThread(ctx context.Context, threadID string) error {
	// TODO: 实现 ThreadReference.Suspend 命令
	return nil
}

// ResumeThread Resumes the specified thread.
func (c *Client) ResumeThread(ctx context.Context, threadID string) error {
	// TODO: 实现 ThreadReference.Resume 命令
	return nil
}

// StepInto Single StepInto
func (c *Client) StepInto(ctx context.Context, threadID string) error {
	// TODO: 实现事件请求和等待
	return nil
}

// StepOver Single-step skip
func (c *Client) StepOver(ctx context.Context, threadID string) error {
	// TODO: 实现事件请求和等待
	return nil
}

// StepOut
func (c *Client) StepOut(ctx context.Context, threadID string) error {
	// TODO: 实现事件请求和等待
	return nil
}

// SetBreakpoint sets a breakpoint.
func (c *Client) SetBreakpoint(ctx context.Context, location string, condition string) (string, error) {
	// TODO: 实现 EventRequest.Set 命令
	bpID := fmt.Sprintf("bp_%d", len(c.breakpoints)+1)
	c.breakpoints[bpID] = &BreakpointInfo{
		ID:       bpID,
		Location: location,
		Enabled:  true,
	}
	return bpID, nil
}

// RemoveBreakpoint Removes a breakpoint.
func (c *Client) RemoveBreakpoint(ctx context.Context, breakpointID string) error {
	delete(c.breakpoints, breakpointID)
	return nil
}

// ClearBreakpoints Clears all breakpoints.
func (c *Client) ClearBreakpoints(ctx context.Context) error {
	c.breakpoints = make(map[string]*BreakpointInfo)
	return nil
}

// GetBreakpoints Get all breakpoints.
func (c *Client) GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error) {
	result := make([]*types.BreakpointInfo, 0, len(c.breakpoints))
	for _, bp := range c.breakpoints{
		result = append(result, &types.BreakpointInfo{
			ID:       bp.ID,
			Location: bp.Location,
			Enabled:  bp.Enabled,
			HitCount: bp.HitCount,
		})
	}
	return result, nil
}

// GetLocalVariables Get Local Variables
func (c *Client) GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error) {
	// TODO: 实现 StackFrame.GetValues 命令
	return []*types.Variable{}, nil
}

// GetFields Get object fields
func (c *Client) GetFields(ctx context.Context, objectID string) ([]*types.Variable, error) {
	// TODO: 实现 ReferenceType.Fields 命令
	return []*types.Variable{}, nil
}

// WaitForEvent Wait for debug event
func (c *Client) WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error) {
	// TODO: 实现事件循环
	return nil, nil
}