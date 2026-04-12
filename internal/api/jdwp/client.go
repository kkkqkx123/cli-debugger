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
	// 获取帧数
	frameCount, err := c.GetThreadFrameCount(ctx, threadID)
	if err != nil {
		return nil, err
	}

	if frameCount == 0 {
		return []*types.StackFrame{}, nil
	}

	// 获取所有栈帧
	frames, err := c.GetStackFrames(ctx, threadID, 0, frameCount)
	if err != nil {
		return nil, err
	}

	return frames, nil
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
	return c.suspendThreadInternal(ctx, threadID)
}

// ResumeThread Resumes the specified thread.
func (c *Client) ResumeThread(ctx context.Context, threadID string) error {
	return c.resumeThreadInternal(ctx, threadID)
}

// StepInto Single StepInto
func (c *Client) StepInto(ctx context.Context, threadID string) error {
	// 设置单步进入事件
	requestID, err := c.SetStepRequest(ctx, threadID, StepInto, SuspendAll)
	if err != nil {
		return err
	}

	// 恢复 VM 执行
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// 等待事件
	_, err = c.WaitForEvent(ctx, 30*time.Second)
	
	// 清理事件请求
	c.ClearBreakpointRequest(ctx, requestID)
	
	return err
}

// StepOver Single-step skip
func (c *Client) StepOver(ctx context.Context, threadID string) error {
	// 设置单步跳过事件
	requestID, err := c.SetStepRequest(ctx, threadID, StepOver, SuspendAll)
	if err != nil {
		return err
	}

	// 恢复 VM 执行
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// 等待事件
	_, err = c.WaitForEvent(ctx, 30*time.Second)
	
	// 清理事件请求
	c.ClearBreakpointRequest(ctx, requestID)
	
	return err
}

// StepOut
func (c *Client) StepOut(ctx context.Context, threadID string) error {
	// 设置单步跳出事件
	requestID, err := c.SetStepRequest(ctx, threadID, StepOut, SuspendAll)
	if err != nil {
		return err
	}

	// 恢复 VM 执行
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// 等待事件
	_, err = c.WaitForEvent(ctx, 30*time.Second)
	
	// 清理事件请求
	c.ClearBreakpointRequest(ctx, requestID)
	
	return err
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
	// 首先获取栈帧
	frames, err := c.GetStackFrames(ctx, threadID, frameIndex, 1)
	if err != nil {
		return nil, err
	}

	if len(frames) == 0 {
		return []*types.Variable{}, nil
	}

	// 获取局部变量 (委托给 stackframe.go 中的实现)
	return c.GetLocalVariablesFromFrame(ctx, threadID, frames[0].ID)
}

// GetLocalVariablesFromFrame 从指定帧获取局部变量
func (c *Client) GetLocalVariablesFromFrame(ctx context.Context, threadID string, frameID string) ([]*types.Variable, error) {
	// 构造请求数据
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Frame ID
	frameIDBytes := encodeID(frameID, c.idsizes.FrameIDSize)
	data = append(data, frameIDBytes...)

	// 变量数量 (这里假设获取所有变量,实际应该从方法信息中获取)
	// 简化处理,发送一个合理的最大值
	varCount := int32(10)
	varCountBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(varCountBytes, uint32(varCount))
	data = append(data, varCountBytes...)

	// 发送 StackFrame.GetValues 命令 (Command Set = 15, Command = 1)
	packet := createCommandPacketWithData(stackFrameCommandSet, stackFrameCommandGetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get local variables",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get local variables",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get local variables failed: %s", reply.Message),
		}
	}

	// 解析响应
	reader := newPacketReader(reply.Data)
	valueCount := reader.readInt()

	variables := make([]*types.Variable, 0, valueCount)
	for i := 0; i < valueCount; i++ {
		// 读取值标签
		tag := reader.readByte()

		// 获取值
		value, err := reader.readValue(tag)
		if err != nil {
			continue
		}

		variables = append(variables, &types.Variable{
			Name:        fmt.Sprintf("var_%d", i),
			Type:        string(tag),
			Value:       value,
			IsPrimitive: isPrimitiveTag(tag),
			IsNull:      value == nil,
		})
	}

	return variables, nil
}

// GetFields Get object fields
func (c *Client) GetFields(ctx context.Context, objectID string) ([]*types.Variable, error) {
	// TODO: 实现 ReferenceType.Fields 命令
	return []*types.Variable{}, nil
}

// WaitForEvent Wait for debug event
func (c *Client) WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error) {
	// 设置读取超时
	if err := c.conn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to set read deadline",
			Cause:   err,
		}
	}

	// 读取事件数据
	lenBuf := make([]byte, 4)
	if _, err := c.conn.Read(lenBuf); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to read event",
			Cause:   err,
		}
	}

	length := bytesToUint32(lenBuf)
	data := make([]byte, length-4)
	if _, err := c.conn.Read(data); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to read event data",
			Cause:   err,
		}
	}

	// 解析事件包
	reader := newPacketReader(data)
	reader.readUint32() // ID
	flags := reader.readByte()

	// 检查是否是事件包 (flags should be 0x80 for reply, or event set)
	if flags != replyFlag {
		// 这是 VM 发送的事件包
		return c.parseEvent(reader)
	}

	return nil, nil
}

// parseEvent 解析 JDWP 事件
func (c *Client) parseEvent(reader *PacketReader) (*types.DebugEvent, error) {
	// 读取事件集 ID
	eventSetID := reader.readByte()
	
	// 读取事件数量
	eventCount := reader.readInt()

	if eventCount == 0 {
		return nil, nil
	}

	// 读取挂起策略
	suspendPolicy := reader.readByte()

	// 读取第一个事件 (简化处理)
	eventKind := reader.readByte()
	requestID := reader.readUint32()
	threadID := reader.readID(c.idsizes.ObjectIDSize)

	// 根据事件类型解析
	var eventType string
	switch eventKind {
	case EventKindBreakpoint:
		eventType = "breakpoint"
	case EventKindSingleStep:
		eventType = "step"
	case EventKindException:
		eventType = "exception"
	case EventKindThreadStart:
		eventType = "thread_start"
	case EventKindThreadDeath:
		eventType = "thread_death"
	default:
		eventType = fmt.Sprintf("unknown(%d)", eventKind)
	}

	return &types.DebugEvent{
		Type:      eventType,
		ThreadID:  threadID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"event_kind":    eventKind,
			"request_id":    requestID,
			"suspend_policy": suspendPolicy,
		},
	}, nil
}