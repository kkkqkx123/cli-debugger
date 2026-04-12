package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
)

// ModuleReference Command Set Implementation
// ModuleReference command constants are already defined in protocol.go

// Name Get module name
func (c *Client) ModuleName(moduleID string) (string, error) {
	data := encodeID(moduleID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(18, 1, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get module name")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get module name")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get module name failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	moduleName, err := reader.readString()
	if err != nil {
		return "", errors.WrapProtocolError(err, errors.ErrInvalidResponse, "Failed to read module name")
	}

	return moduleName, nil
}

// ClassLoader Get module class loader
func (c *Client) ModuleClassLoader(moduleID string) (string, error) {
	data := encodeID(moduleID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(18, 2, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get module class loader")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get module class loader")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get module class loader failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	classLoaderID := reader.readID(c.idsizes.ObjectIDSize)

	return classLoaderID, nil
}
