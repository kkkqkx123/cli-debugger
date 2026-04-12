package jdwp

import (
	"context"
	"fmt"
	"time"

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
	
	// Read reply to ensure command success
	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to hang VM",
			Cause:   err,
		}
	}
	
	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Suspend VM failed: %s", reply.Message),
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
	
	// Read reply to ensure command success
	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Recovery VM Failed",
			Cause:   err,
		}
	}
	
	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Resume VM failed: %s", reply.Message),
		}
	}
	
	return nil
}

// ClassByName Finds a class by name
func (c *Client) ClassByName(ctx context.Context, className string) (*ClassInfo, error) {
	data := EncodeString(className)
	packet := createCommandPacketWithData(vmCommandSet, vmCommandClassesBySignature, data)
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
	// ClassesBySignature returns an array
	count := reader.readInt()
	if count == 0 {
		return nil, nil
	}
	
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

// getIDSizesInternal: Gets the ID sizes (an internal method, called during the connection process)
func (c *Client) getIDSizesInternal(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandIDSizes)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get ID sizes",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get ID sizes",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get ID sizes failed: %s", reply.Message),
		}
	}

	// Parse ID sizes from response
	if len(reply.Data) < 40 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "IDSizes response too short",
		}
	}

	reader := newPacketReader(reply.Data)
	c.idsizes = &IDSizes{
		FieldIDSize:         int(reader.readInt()),
		MethodIDSize:        int(reader.readInt()),
		ObjectIDSize:        int(reader.readInt()),
		ReferenceTypeIDSize: int(reader.readInt()),
		FrameIDSize:         int(reader.readInt()),
	}

	return nil
}

// Get version information (implementing the DebugProtocol interface)
func (c *Client) Version(ctx context.Context) (*types.VersionInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandVersion)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get version",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get version",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get version failed: %s", reply.Message),
		}
	}

	// Parsing version information
	reader := newPacketReader(reply.Data)

	description, _ := reader.readString()
	jdwpMajor := reader.readInt()
	jdwpMinor := reader.readInt()
	vmVersion, _ := reader.readString()
	vmName, _ := reader.readString()

	return &types.VersionInfo{
		ProtocolVersion: fmt.Sprintf("%d.%d", jdwpMajor, jdwpMinor),
		RuntimeVersion:  vmVersion,
		RuntimeName:     vmName,
		Description:     description,
	}, nil
}

// GetThreads: Retrieves all threads (implementing the DebugProtocol interface)
func (c *Client) GetThreads(ctx context.Context) ([]*types.ThreadInfo, error) {
	// First, suspend the VM to obtain consistent thread information.
	if err := c.SuspendVM(ctx); err != nil {
		return nil, err
	}
	defer c.ResumeVM(ctx) // Ensure the VM is restored.

	packet := createCommandPacket(vmCommandSet, vmCommandAllThreads)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get threads",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get threads",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get threads failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	threadCount := reader.readInt()

	threads := make([]*types.ThreadInfo, 0, threadCount)
	for i := 0; i < threadCount; i++ {
		threadID := reader.readID(c.idsizes.ObjectIDSize)
		
		// Get the thread name (the ThreadReference.Name command needs to be sent)
		name, _ := c.GetThreadName(ctx, threadID)
		
		// Get thread status
		state, _, _ := c.GetThreadStatus(ctx, threadID)

		threads = append(threads, &types.ThreadInfo{
			ID:          threadID,
			Name:        name,
			State:       state,
			Priority:    5, // Default priority
			IsDaemon:    false,
			CreatedAt:   time.Now(),
		})
	}

	return threads, nil
}