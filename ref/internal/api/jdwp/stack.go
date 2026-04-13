package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// GetLocalVariables Get the local variables of the stack frame.
func (c *Client) GetLocalVariables(ctx context.Context, threadID string, frameIndex int) ([]*types.Variable, error) {
	// Constructing request data
	data := make([]byte, 0)

	// Thread ID
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Frame ID (need to get frame list first)
	// TODO: Implement complete frame ID retrieval logic
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
