package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
)

// ThreadGroupReference Command Set Implementation
// ThreadGroupReference command constants are already defined in protocol.go

// Name Get thread group name
func (c *Client) ThreadGroupName(threadGroupID string) (string, error) {
	data := encodeID(threadGroupID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(threadGroupCommandSet, threadGroupCommandName, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get thread group name")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get thread group name")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get thread group name failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	name, err := reader.readString()
	if err != nil {
		return "", errors.WrapProtocolError(err, errors.ErrInvalidResponse, "Failed to read thread group name")
	}

	return name, nil
}

// Parent Get parent thread group
func (c *Client) Parent(threadGroupID string) (string, error) {
	data := encodeID(threadGroupID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(threadGroupCommandSet, threadGroupCommandParent, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get parent thread group")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get parent thread group")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get parent thread group failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	parentGroupID := reader.readID(c.idsizes.ObjectIDSize)

	return parentGroupID, nil
}

// Children Get children thread groups
func (c *Client) Children(threadGroupID string) ([]string, []string, error) {
	data := encodeID(threadGroupID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(threadGroupCommandSet, threadGroupCommandChildren, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get children thread groups")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get children thread groups")
	}

	if reply.ErrorCode != 0 {
		return nil, nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get children thread groups failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	childThreadCount := reader.readInt()
	childGroupCount := reader.readInt()

	childThreads := make([]string, 0, childThreadCount)
	for i := 0; i < childThreadCount; i++ {
		threadID := reader.readID(c.idsizes.ObjectIDSize)
		childThreads = append(childThreads, threadID)
	}

	childGroups := make([]string, 0, childGroupCount)
	for i := 0; i < childGroupCount; i++ {
		groupID := reader.readID(c.idsizes.ObjectIDSize)
		childGroups = append(childGroups, groupID)
	}

	return childThreads, childGroups, nil
}
