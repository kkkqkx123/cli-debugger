package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// StackFrame Command Set Implementation

// StackFrame Command Constants
const (
	stackFrameCommandSet byte = 10
	stackFrameCommandGetValues byte = 1
	stackFrameCommandSetValues byte = 2
	stackFrameCommandThisObject byte = 3
	stackFrameCommandPopFrames byte = 4
)

// GetStackFrames Get a list of the thread's stack frames.
func (c *Client) GetStackFrames(ctx context.Context, threadID string, startFrame int, length int) ([]*types.StackFrame, error) {
	// Constructing request data
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Start frame index (4 bytes)
	startBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(startBytes, uint32(startFrame))
	data = append(data, startBytes...)

	// Number of frames (4 bytes)
	lengthBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(lengthBytes, uint32(length))
	data = append(data, lengthBytes...)

	// Send the ThreadReference.Frames command
	packet := createCommandPacketWithData(threadCommandSet, threadCommandFrames, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, err
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, err
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Failed to get stack frame: %s", reply.Message),
		}
	}

	// parse the response
	reader := newPacketReader(reply.Data)
	frameCount := reader.readInt()

	frames := make([]*types.StackFrame, 0, frameCount)
	for i := 0; i < frameCount; i++ {
		frameID := reader.readID(c.idsizes.FrameIDSize)

		// Retrieve location information
		tag := reader.readByte() // Class Type Label
		classID := reader.readID(c.idsizes.ReferenceTypeIDSize)
		methodID := reader.readID(c.idsizes.MethodIDSize)
		codeIndex := reader.readUint64()

		// Constructing stack frame information
		frames = append(frames, &types.StackFrame{
			ID:       frameID,
			Location: fmt.Sprintf("%s", classID),
			Method:   fmt.Sprintf("method_%s", methodID),
			Line:     int(codeIndex),
			IsNative: tag == 'N',
		})
	}

	return frames, nil
}

// GetLocalVariables Get the local variables of the stack frame.
func (c *Client) GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error) {
	// Constructing request data
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Frame ID (need to get frame list first)
	// TODO: 实现完整的帧 ID 获取逻辑
	frameID := fmt.Sprintf("frame_%d", frameIndex)
	frameIDBytes := encodeID(frameID, c.idsizes.FrameIDSize)
	data = append(data, frameIDBytes...)

	// Send StackFrame.GetValues command
	packet := createCommandPacketWithData(stackFrameCommandSet, stackFrameCommandGetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, err
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, err
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Failed to get local variables: %s", reply.Message),
		}
	}

	// parse the response
	reader := newPacketReader(reply.Data)
	valueCount := reader.readInt()

	variables := make([]*types.Variable, 0, valueCount)
	for i := 0; i < valueCount; i++ {
		// Read value tags
		tag := reader.readByte()

		// retrieve value
		value, err := reader.readValue(tag)
		if err != nil {
			// Skip invalid values
			continue
		}

		variables = append(variables, &types.Variable{
			Name:         fmt.Sprintf("var_%d", i),
			Type:         string(tag),
			Value:        value,
			IsPrimitive:  isPrimitiveTag(tag),
			IsNull:       value == nil,
		})
	}

	return variables, nil
}

// GetThisObject Get this object for the stack frame.
func (c *Client) GetThisObject(ctx context.Context, threadID string, frameID string) (string, error) {
	// Constructing request data
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Frame ID
	frameIDBytes := encodeID(frameID, c.idsizes.FrameIDSize)
	data = append(data, frameIDBytes...)

	// Send the StackFrame.ThisObject command
	packet := createCommandPacketWithData(stackFrameCommandSet, stackFrameCommandThisObject, data)
	if err := c.sendPacket(packet); err != nil {
		return "", err
	}

	reply, err := c.readReply()
	if err != nil {
		return "", err
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Failed to get this object: %s", reply.Message),
		}
	}

	// parse the response
	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	objectID := reader.readID(c.idsizes.ObjectIDSize)

	return fmt.Sprintf("%c:%s", tag, objectID), nil
}

// PopFrames Pop up stack frames
func (c *Client) PopFrames(ctx context.Context, threadID string, frameID string) error {
	// Constructing request data
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Frame ID
	frameIDBytes := encodeID(frameID, c.idsizes.FrameIDSize)
	data = append(data, frameIDBytes...)

	// Send StackFrame.PopFrames command
	packet := createCommandPacketWithData(stackFrameCommandSet, stackFrameCommandPopFrames, data)
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
			Message: fmt.Sprintf("Failed to pop stack frame: %s", reply.Message),
		}
	}

	return nil
}

// isPrimitiveTag checks if it is a primitive type tag
func isPrimitiveTag(tag byte) bool {
	primitiveTags := []byte{'B', 'C', 'D', 'F', 'I', 'J', 'S', 'Z'}
	for _, t := range primitiveTags {
		if t == tag {
			return true
		}
	}
	return false
}

// Thread command constants (for stack frame operations)
const (
	threadCommandSet byte = 2
	threadCommandFrames byte = 8
)

// readUint64 Reads a 64-bit unsigned integer.
func (r *PacketReader) readUint64() uint64 {
	if r.pos+8 > len(r.data) {
		return 0
	}
	val := binary.BigEndian.Uint64(r.data[r.pos : r.pos+8])
	r.pos += 8
	return val
}