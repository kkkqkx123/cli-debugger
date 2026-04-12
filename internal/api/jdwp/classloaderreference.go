package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
)

// ClassLoaderReference Command Set Implementation
// ClassLoaderReference command constants are already defined in protocol.go

// VisibleClasses Get visible classes
func (c *Client) VisibleClasses(classLoaderID string) ([]*ClassInfo, error) {
	data := encodeID(classLoaderID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(classLoaderCommandSet, classLoaderCommandVisibleClasses, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get visible classes",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get visible classes",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get visible classes failed: %s", reply.Message),
		}
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
