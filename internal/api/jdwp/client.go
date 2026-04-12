package jdwp

import (
	"context"
	"encoding/binary"
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

// getThreadStateInternal Get thread state (internal method)
func (c *Client) getThreadStateInternal(threadID string) (string, error) {
	// Encoded Thread ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)

	// 发送 ThreadReference.Status 命令 (Command Set = 10, Command = 4)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandStatus, data)
	if err := c.sendPacket(packet); err != nil {
		return "running", err
	}

	reply, err := c.readReply()
	if err != nil {
		return "running", err
	}

	if reply.ErrorCode != 0 {
		return "running", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get thread status failed: %s", reply.Message),
		}
	}

	// Parsing thread state
	reader := newPacketReader(reply.Data)
	threadStatus := reader.readInt()
	_ = reader.readInt() // suspendStatus, not used

	// Converting states to strings
	stateStr := GetThreadStateString(threadStatus)

	return stateStr, nil
}

// GetThreadStack Get Thread Call Stack
func (c *Client) GetThreadStack(ctx context.Context, threadID string) ([]*types.StackFrame, error) {
	// Get Frames
	frameCount, err := c.GetThreadFrameCount(ctx, threadID)
	if err != nil {
		return nil, err
	}

	if frameCount == 0 {
		return []*types.StackFrame{}, nil
	}

	// Get all stack frames
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

// StepInto Single StepInto
func (c *Client) StepInto(ctx context.Context, threadID string) error {
	// Setting up single-step entry events
	requestID, err := c.SetStepRequest(ctx, threadID, StepInto, SuspendAll)
	if err != nil {
		return err
	}

	// Resume VM execution
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// Waiting for events
	_, err = c.WaitForEvent(ctx, 30*time.Second)
	
	// Clear event requests
	c.ClearBreakpointRequest(ctx, requestID)
	
	return err
}

// StepOver Single-step skip
func (c *Client) StepOver(ctx context.Context, threadID string) error {
	// Setting up single-step skip events
	requestID, err := c.SetStepRequest(ctx, threadID, StepOver, SuspendAll)
	if err != nil {
		return err
	}

	// Resume VM execution
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// Waiting for events
	_, err = c.WaitForEvent(ctx, 30*time.Second)
	
	// Clear event requests
	c.ClearBreakpointRequest(ctx, requestID)
	
	return err
}

// StepOut
func (c *Client) StepOut(ctx context.Context, threadID string) error {
	// Setting up a single-step jump event
	requestID, err := c.SetStepRequest(ctx, threadID, StepOut, SuspendAll)
	if err != nil {
		return err
	}

	// Resume VM execution
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// Waiting for events
	_, err = c.WaitForEvent(ctx, 30*time.Second)
	
	// Clear event requests
	c.ClearBreakpointRequest(ctx, requestID)
	
	return err
}

// SetBreakpoint sets a breakpoint.
func (c *Client) SetBreakpoint(ctx context.Context, location string, condition string) (string, error) {
	className, methodName, lineNumber := parseLocation(location)

	classInfo, err := c.ClassByName(ctx, className)
	if err != nil {
		return "", err
	}

	methods, err := c.Methods(classInfo.RefID)
	if err != nil {
		return "", err
	}

	var methodID string
	for _, method := range methods {
		if method.Name == methodName {
			methodID = method.MethodID
			break
		}
	}

	if methodID == "" {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Method not found",
		}
	}

	lineTable, err := c.LineTable(classInfo.RefID, methodID)
	if err != nil {
		return "", err
	}

	var codeIndex int64 = -1
	for _, lineLocation := range lineTable {
		if lineLocation.LineNumber == lineNumber {
			codeIndex = lineLocation.LineCodeIndex
			break
		}
	}

	if codeIndex == -1 {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Line number not found in method",
		}
	}

	requestID, err := c.SetBreakpointRequest(ctx, classInfo.RefID, methodID, uint64(codeIndex), SuspendEventThread)
	if err != nil {
		return "", err
	}

	bpID := fmt.Sprintf("bp_%d", len(c.breakpoints)+1)
	c.breakpoints[bpID] = &BreakpointInfo{
		ID:        bpID,
		RequestID: requestID,
		Location:  location,
		Enabled:   true,
		HitCount:  0,
	}

	return bpID, nil
}

func parseLocation(location string) (string, string, int) {
	className := ""
	methodName := ""
	lineNumber := 0

	lastDot := -1
	lastColon := -1
	for i, ch := range location {
		if ch == '.' {
			lastDot = i
		} else if ch == ':' {
			lastColon = i
		}
	}

	if lastDot != -1 && lastColon != -1 && lastColon > lastDot {
		className = location[:lastDot]
		methodName = location[lastDot+1 : lastColon]
		lineStr := location[lastColon+1:]
		fmt.Sscanf(lineStr, "%d", &lineNumber)
	}

	return className, methodName, lineNumber
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

// GetLocalVariablesFromFrame Get local variables from the specified frame.
func (c *Client) GetLocalVariablesFromFrame(ctx context.Context, threadID string, frameID string) ([]*types.Variable, error) {
	// Constructing request data
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Frame ID
	frameIDBytes := encodeID(frameID, c.idsizes.FrameIDSize)
	data = append(data, frameIDBytes...)

	// Number of variables (this assumes that all variables are retrieved, but in reality they should be retrieved from the method information)
	// Simplify the process by sending a reasonable maximum value.
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

	// parse the response
	reader := newPacketReader(reply.Data)
	valueCount := reader.readInt()

	variables := make([]*types.Variable, 0, valueCount)
	for i := 0; i < valueCount; i++ {
		// Read value tags
		tag := reader.readByte()

		// get a value
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
	_ = byte('L')
	if len(objectID) > 0 && objectID[0] == '[' {
		_ = byte('[')
	}

	refTypeID := objectID[2:]
	fields, err := c.Fields(refTypeID)
	if err != nil {
		return nil, err
	}

	if len(fields) == 0 {
		return []*types.Variable{}, nil
	}

	fieldIDs := make([]string, 0, len(fields))
	for _, field := range fields {
		fieldIDs = append(fieldIDs, field.FieldID)
	}

	tags, values, err := c.GetValuesWithTags(objectID[2:], fieldIDs)
	if err != nil {
		return nil, err
	}

	variables := make([]*types.Variable, 0, len(fields))
	for i := 0; i < len(fields); i++ {
		variables = append(variables, &types.Variable{
			Name:        fields[i].Name,
			Type:        fields[i].Signature,
			Value:       values[i],
			IsPrimitive: isPrimitiveTag(tags[i]),
			IsNull:      values[i] == nil,
		})
	}

	return variables, nil
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

// parseEvent parsing JDWP case
func (c *Client) parseEvent(reader *PacketReader) (*types.DebugEvent, error) {
	// Read event set ID
	_ = reader.readByte()

	// Number of events read
	eventCount := reader.readInt()

	if eventCount == 0 {
		return nil, nil
	}

	// Read hang policy
	suspendPolicy := reader.readByte()

	// Read first event (simplifies processing)
	eventKind := reader.readByte()
	requestID := reader.readUint32()
	threadID := reader.readID(c.idsizes.ObjectIDSize)

	// Parsing by event type
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