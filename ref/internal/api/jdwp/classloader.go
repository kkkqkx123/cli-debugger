package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
)

// ClassLoaderReference Command Set Implementation
// ClassLoaderReference command constants are already defined in protocol.go

// VisibleClasses Get visible classes
func (c *Client) VisibleClasses(classLoaderID string) ([]*ClassInfo, error) {
	data := encodeID(classLoaderID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(classLoaderCommandSet, classLoaderCommandVisibleClasses, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get visible classes")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get visible classes")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get visible classes failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	classCount := reader.readInt()

	classes := make([]*ClassInfo, 0, classCount)
	for i := 0; i < classCount; i++ {
		tag := reader.readByte()
		refID := reader.readID(c.idsizes.ReferenceTypeIDSize)
		status := reader.readInt()

		classes = append(classes, &ClassInfo{
			Tag:    tag,
			RefID:  refID,
			Status: status,
		})
	}

	return classes, nil
}
