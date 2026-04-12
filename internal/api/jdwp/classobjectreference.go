package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
)

// ClassObjectReference Command Set Implementation
// ClassObjectReference command constants are already defined in protocol.go

// ReflectedType Get reflected type
func (c *Client) ReflectedType(classObjectID string) (string, error) {
	data := encodeID(classObjectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(classObjectCommandSet, classObjectCommandReflectedType, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get reflected type",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get reflected type",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get reflected type failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	refTypeID := reader.readID(c.idsizes.ReferenceTypeIDSize)

	return fmt.Sprintf("%c:%s", tag, refTypeID), nil
}
