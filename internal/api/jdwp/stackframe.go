package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"

	"cli-debugger/pkg/errors"
	"cli-debugger/pkg/types"
)

// StackFrame Command Set Implementation
// StackFrame command constants are already defined in protocol.go

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
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Failed to get stack frame: %s", reply.Message))
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
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Failed to get local variables: %s", reply.Message))
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
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Failed to get this object: %s", reply.Message))
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
		return errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Failed to pop stack frame: %s", reply.Message))
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

// SetLocalVariableValues Set local variable values
func (c *Client) SetLocalVariableValues(threadID string, frameID string, slotValues map[int]interface{}) error {
	data := make([]byte, 0)

	data = append(data, encodeID(threadID, c.idsizes.ObjectIDSize)...)
	data = append(data, encodeID(frameID, c.idsizes.FrameIDSize)...)

	data = append(data, 0, 0, 0, byte(len(slotValues)))
	for slot, value := range slotValues {
		slotBytes := make([]byte, 4)
		binary.BigEndian.PutUint32(slotBytes, uint32(slot))
		data = append(data, slotBytes...)

		valueBytes := make([]byte, 0)
		switch val := value.(type) {
		case int8:
			valueBytes = append(valueBytes, 'B')
			valueBytes = append(valueBytes, byte(val))
		case int16:
			valueBytes = append(valueBytes, 'S')
			valueBytes = append(valueBytes, byte(val>>8), byte(val))
		case int32:
			valueBytes = append(valueBytes, 'I')
			valueBytes = append(valueBytes, byte(val>>24), byte(val>>16), byte(val>>8), byte(val))
		case int64:
			valueBytes = append(valueBytes, 'J')
			valueBytes = append(valueBytes, byte(val>>56), byte(val>>48), byte(val>>40), byte(val>>32), byte(val>>24), byte(val>>16), byte(val>>8), byte(val))
		case float32:
			valueBytes = append(valueBytes, 'F')
			bits := uint32(val)
			valueBytes = append(valueBytes, byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
		case float64:
			valueBytes = append(valueBytes, 'D')
			bits := uint64(val)
			valueBytes = append(valueBytes, byte(bits>>56), byte(bits>>48), byte(bits>>40), byte(bits>>32), byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
		case bool:
			valueBytes = append(valueBytes, 'Z')
			if val {
				valueBytes = append(valueBytes, 1)
			} else {
				valueBytes = append(valueBytes, 0)
			}
		case string:
			valueBytes = append(valueBytes, 'L')
			valueBytes = append(valueBytes, encodeID(val, c.idsizes.ObjectIDSize)...)
		case nil:
			valueBytes = append(valueBytes, 'L')
			valueBytes = append(valueBytes, 0, 0, 0, 0, 0, 0, 0, 0)
		default:
			valueBytes = append(valueBytes, 'L')
			valueBytes = append(valueBytes, 0, 0, 0, 0, 0, 0, 0, 0)
		}

		data = append(data, valueBytes...)
	}

	packet := createCommandPacketWithData(stackFrameCommandSet, stackFrameCommandSetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to set local variable values")
	}

	reply, err := c.readReply()
	if err != nil {
		return errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to set local variable values")
	}

	if reply.ErrorCode != 0 {
		return errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Set local variable values failed: %s", reply.Message))
	}

	return nil
}