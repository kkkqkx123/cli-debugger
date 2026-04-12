package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// VirtualMachine Command Set Implementation

// GetVersion Get JVM version information
func (c *Client) GetVersion(ctx context.Context) (*types.VersionInfo, error) {
	return c.Version(ctx)
}

// GetAllClasses Get all loaded classes.
func (c *Client) GetAllClasses(ctx context.Context) ([]*ClassInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandAllClasses)
	if err := c.sendPacket(packet); err != nil {
		return nil, err
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, err
	}

	reader := newPacketReader(reply.Data)
	classCount := reader.readInt()

	classes := make([]*ClassInfo, 0, classCount)
	for i := 0; i < classCount; i++ {
		tag := reader.readByte()
		refType := reader.readID(c.idsizes.ReferenceTypeIDSize)
		status := reader.readInt()

		classes = append(classes, &ClassInfo{
			Tag:    tag,
			RefID:  refType,
			Status: status,
		})
	}

	return classes, nil
}

// GetAllThreads Get all threads (aliases)
func (c *Client) GetAllThreads(ctx context.Context) ([]string, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandAllThreads)
	if err := c.sendPacket(packet); err != nil {
		return nil, err
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, err
	}

	reader := newPacketReader(reply.Data)
	threadCount := reader.readInt()

	threads := make([]string, 0, threadCount)
	for i := 0; i < threadCount; i++ {
		threadID := reader.readID(c.idsizes.ObjectIDSize)
		threads = append(threads, threadID)
	}

	return threads, nil
}

// SuspendVM Hangs the entire virtual machine.
func (c *Client) SuspendVM(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandSuspend)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to hang VM",
			Cause:   err,
		}
	}
	return nil
}

// ResumeVM Resume virtual machine execution
func (c *Client) ResumeVM(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandResume)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Recovery VM Failed",
			Cause:   err,
		}
	}
	return nil
}

// ClassByName Finds a class by name
func (c *Client) ClassByName(ctx context.Context, className string) (*ClassInfo, error) {
	data := EncodeString(className)
	packet := createCommandPacketWithData(vmCommandSet, vmCommandClassByName, data)
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
			Message: fmt.Sprintf("Failed to find class: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	refID := reader.readID(c.idsizes.ReferenceTypeIDSize)
	status := reader.readInt()

	return &ClassInfo{
		Tag:    tag,
		RefID:  refID,
		Status: status,
	}, nil
}

// Dispose destroys the debugging connection
func (c *Client) Dispose(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandDispose)
	if err := c.sendPacket(packet); err != nil {
		return err
	}
	return c.Close()
}

// ClassInfo Class Information
type ClassInfo struct {
	Tag    byte
	RefID  string
	Status int
}

// GetIDSizes Get ID sizes (internal use)
func (c *Client) GetIDSizes(ctx context.Context) (*IDSizes, error) {
	return c.idsizes, nil
}