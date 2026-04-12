package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
)

// StringReference Command Set Implementation
// StringReference command constants are already defined in protocol.go

// Value Get string value
func (c *Client) Value(stringID string) (string, error) {
	data := encodeID(stringID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(stringReferenceCommandSet, stringReferenceCommandValue, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get string value")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get string value")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get string value failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	value, err := reader.readString()
	if err != nil {
		return "", errors.WrapProtocolError(err, errors.ErrInvalidResponse, "Failed to read string value")
	}

	return value, nil
}
