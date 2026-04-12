package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
)

// StringReference Command Set Implementation
// StringReference command constants are already defined in protocol.go

// Value Get string value
func (c *Client) Value(stringID string) (string, error) {
	data := encodeID(stringID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(stringReferenceCommandSet, stringReferenceCommandValue, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get string value",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get string value",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get string value failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	value, err := reader.readString()
	if err != nil {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Message: "Failed to read string value",
			Cause:   err,
		}
	}

	return value, nil
}
