package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"
	"time"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// EventRequest Command Set Implementation
// EventRequest command constants are already defined in protocol.go

// SuspendPolicy Hang up policy
const (
	SuspendNone byte = 0 // unlisted
	SuspendEventThread byte = 1 // Hanging event threads
	SuspendAll byte = 2 // Suspend all threads
)

// EventKind Event Type
const (
	EventKindSingleStep byte = 1
	EventKindBreakpoint byte = 2
	EventKindFramePop byte = 3
	EventKindException byte = 4
	EventKindUserDefined byte = 5
	EventKindThreadStart byte = 6
	EventKindThreadDeath byte = 7
	EventKindClassPrepare byte = 8
	EventKindClassUnload byte = 9
	EventKindClassLoad byte = 10
	EventKindFieldAccess byte = 11
	EventKindFieldModification byte = 12
	EventKindVMStart byte = 13
	EventKindVMDeath byte = 14
	EventKindVMDisconnected byte = 15
)

// SetBreakpointRequest set breakpoint request
func (c *Client) SetBreakpointRequest(ctx context.Context, classID string, methodID string, codeIndex uint64, suspendPolicy byte) (uint32, error) {
	// Constructing breakpoints to request data
	data := make([]byte, 0)

	// Event Type (1 byte)
	data = append(data, EventKindBreakpoint)

	// Suspend Policy (1 byte)
	data = append(data, suspendPolicy)

	// Number of filters (4 bytes)
	data = append(data, 0, 0, 0, 1) // 1 filter

	// Filter type: LocationOnly (1 byte)
	data = append(data, 7) // LocationOnly filter

	// Class ID (according to IDSizes)
	classIDBytes := encodeID(classID, c.idsizes.ReferenceTypeIDSize)
	data = append(data, classIDBytes...)

	// Method ID (according to IDSizes)
	methodIDBytes := encodeID(methodID, c.idsizes.MethodIDSize)
	data = append(data, methodIDBytes...)

	// Code Index (8 bytes)
	indexBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(indexBytes, codeIndex)
	data = append(data, indexBytes...)

	packet := createCommandPacketWithData(eventRequestCommandSet, eventRequestCommand, data)
	if err := c.sendPacket(packet); err != nil {
		return 0, err
	}

	reply, err := c.readReply()
	if err != nil {
		return 0, err
	}

	if reply.ErrorCode != 0 {
		return 0, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Failed to set breakpoint: %s", reply.Message),
		}
	}

	// Read Request ID
	reader := newPacketReader(reply.Data)
	requestID := reader.readUint32()

	return requestID, nil
}

// ClearBreakpointRequest clear breakpoint request
func (c *Client) ClearBreakpointRequest(ctx context.Context, requestID uint32) error {
	data := make([]byte, 8)

	// Event Type (1 byte)
	data[0] = EventKindBreakpoint

	// Request ID (4 bytes)
	binary.BigEndian.PutUint32(data[1:5], requestID)

	packet := createCommandPacketWithData(eventRequestCommandSet, eventRequestCommandClear, data[:5])
	if err := c.sendPacket(packet); err != nil {
		return err
	}

	reply, err := c.readReply()
	if err != nil {
		return err
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Failed to clear breakpoint: %s", reply.Message),
		}
	}

	return nil
}

// ClearAllBreakpoints Clears all breakpoints.
func (c *Client) ClearAllBreakpoints(ctx context.Context) error {
	packet := createCommandPacket(eventRequestCommandSet, eventRequestCommandClearAllBreakpoints)
	if err := c.sendPacket(packet); err != nil {
		return err
	}

	reply, err := c.readReply()
	if err != nil {
		return err
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Failed to clear all breakpoints: %s", reply.Message),
		}
	}

	return nil
}

// SetStepRequest Setting a single-step request
func (c *Client) SetStepRequest(ctx context.Context, threadID string, stepKind byte, suspendPolicy byte) (uint32, error) {
	// Constructing single-step request data
	data := make([]byte, 0)

	// Event Type (1 byte)
	data = append(data, EventKindSingleStep)

	// Suspend Policy (1 byte)
	data = append(data, suspendPolicy)

	// Number of filters (4 bytes)
	data = append(data, 0, 0, 0, 1) // 1 filter

	// Filter type: Step (1 byte)
	data = append(data, 1) // Step filter

	// Thread ID (according to IDSizes)
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Step Type (4 bytes)
	stepBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(stepBytes, uint32(stepKind))
	data = append(data, stepBytes...)

	packet := createCommandPacketWithData(eventRequestCommandSet, eventRequestCommand, data)
	if err := c.sendPacket(packet); err != nil {
		return 0, err
	}

	reply, err := c.readReply()
	if err != nil {
		return 0, err
	}

	if reply.ErrorCode != 0 {
		return 0, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Setting single-step request failed: %s", reply.Message),
		}
	}

	// Read Request ID
	reader := newPacketReader(reply.Data)
	requestID := reader.readUint32()

	return requestID, nil
}

// StepKind Single Step Type
const (
	StepInto byte = 0 // single-step entry
	StepOver byte = 1 // single-step skip
	StepOut byte = 2 // jump out with a single step
)

// WaitForEvent Wait for an event
func (c *Client) WaitForEvent(ctx context.Context, timeout time.Duration) (*types.DebugEvent, error) {
	// TODO: 实现事件循环
	// Need to listen to asynchronous event packages from the JVM
	return nil, nil
}

// encodeID Encoding ID
func encodeID(id string, size int) []byte {
	// Converting String IDs to Bytes
	// TODO: 实现正确的 ID 编码
	buf := make([]byte, size)
	for i := 0; i < size && i < len(id); i++ {
		buf[i] = id[i]
	}
	return buf
}