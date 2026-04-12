package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
)

// ClassObjectReference Command Set Implementation
// ClassObjectReference command constants are already defined in protocol.go

// ReflectedType Get reflected type
func (c *Client) ReflectedType(classObjectID string) (string, error) {
	data := encodeID(classObjectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(classObjectCommandSet, classObjectCommandReflectedType, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get reflected type")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get reflected type")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get reflected type failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	refTypeID := reader.readID(c.idsizes.ReferenceTypeIDSize)

	return fmt.Sprintf("%c:%s", tag, refTypeID), nil
}
