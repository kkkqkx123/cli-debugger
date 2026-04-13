package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

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

	// Send StackFrame.GetValues command
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
