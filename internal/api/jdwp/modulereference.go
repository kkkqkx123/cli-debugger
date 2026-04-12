package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
)

// ModuleReference Command Set Implementation
// ModuleReference command constants are already defined in protocol.go

// Name Get module name
func (c *Client) ModuleName(moduleID string) (string, error) {
	data := encodeID(moduleID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(18, 1, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get module name",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get module name",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get module name failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	moduleName, err := reader.readString()
	if err != nil {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Message: "Failed to read module name",
			Cause:   err,
		}
	}

	return moduleName, nil
}

// ClassLoader Get module class loader
func (c *Client) ModuleClassLoader(moduleID string) (string, error) {
	data := encodeID(moduleID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(18, 2, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get module class loader",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get module class loader",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get module class loader failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	classLoaderID := reader.readID(c.idsizes.ObjectIDSize)

	return classLoaderID, nil
}
