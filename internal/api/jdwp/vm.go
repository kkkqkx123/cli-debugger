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

// CapabilitiesInfo VM capabilities information
type CapabilitiesInfo struct {
	CanWatchFieldModification bool
	CanWatchFieldAccess       bool
	CanGetBytecodes           bool
	CanGetSyntheticAttribute  bool
	CanGetOwnedMonitorInfo    bool
	CanGetCurrentContendedMonitor bool
	CanGetMonitorInfo         bool
	CanRedefineClasses        bool
	CanAddMethod              bool
	CanUnrestrictedlyRedefineClasses bool
	CanPopFrames              bool
	CanUseInstanceFilters     bool
	CanGetSourceDebugExtension bool
	CanRequestVMDeathEvent    bool
	CanSetDefaultStratum      bool
	CanGetInstanceInfo        bool
	CanRequestMonitorEvents   bool
	CanGetMonitorFrameInfo    bool
	CanGetConstantPool        bool
	CanSetNativeMethodPrefix  bool
	CanRedefineClassesWhenMismatched bool
}

// ClassPathsInfo Class paths information
type ClassPathsInfo struct {
	Classpath     []string
	BootClasspath []string
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

// Capabilities Get VM capabilities
func (c *Client) Capabilities(ctx context.Context) (*CapabilitiesInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandCapabilities)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get VM capabilities",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get VM capabilities",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get VM capabilities failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	capabilities := &CapabilitiesInfo{
		CanWatchFieldModification: reader.readByte() != 0,
		CanWatchFieldAccess:       reader.readByte() != 0,
		CanGetBytecodes:           reader.readByte() != 0,
		CanGetSyntheticAttribute:  reader.readByte() != 0,
		CanGetOwnedMonitorInfo:    reader.readByte() != 0,
		CanGetCurrentContendedMonitor: reader.readByte() != 0,
		CanGetMonitorInfo:         reader.readByte() != 0,
		CanRedefineClasses:        reader.readByte() != 0,
		CanAddMethod:              reader.readByte() != 0,
		CanUnrestrictedlyRedefineClasses: reader.readByte() != 0,
		CanPopFrames:              reader.readByte() != 0,
		CanUseInstanceFilters:     reader.readByte() != 0,
		CanGetSourceDebugExtension: reader.readByte() != 0,
		CanRequestVMDeathEvent:    reader.readByte() != 0,
		CanSetDefaultStratum:      reader.readByte() != 0,
		CanGetInstanceInfo:        reader.readByte() != 0,
		CanRequestMonitorEvents:   reader.readByte() != 0,
		CanGetMonitorFrameInfo:    reader.readByte() != 0,
		CanGetConstantPool:        reader.readByte() != 0,
		CanSetNativeMethodPrefix:  reader.readByte() != 0,
		CanRedefineClassesWhenMismatched: reader.readByte() != 0,
	}

	return capabilities, nil
}

// ClassPaths Get class paths
func (c *Client) ClassPaths(ctx context.Context) (*ClassPathsInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandClassPaths)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get class paths",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get class paths",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get class paths failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	classpath := make([]string, 0)
	bootclasspath := make([]string, 0)

	classpathCount := reader.readInt()
	for i := 0; i < classpathCount; i++ {
		path, _ := reader.readString()
		classpath = append(classpath, path)
	}

	bootclasspathCount := reader.readInt()
	for i := 0; i < bootclasspathCount; i++ {
		path, _ := reader.readString()
		bootclasspath = append(bootclasspath, path)
	}

	return &ClassPathsInfo{
		Classpath:     classpath,
		BootClasspath: bootclasspath,
	}, nil
}

// Exit Exit the VM
func (c *Client) Exit(ctx context.Context, exitCode int) error {
	data := make([]byte, 4)
	binary.BigEndian.PutUint32(data, uint32(exitCode))

	packet := createCommandPacketWithData(vmCommandSet, vmCommandExit, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to exit VM",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to exit VM",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Exit VM failed: %s", reply.Message),
		}
	}

	return nil
}

// CreateString Create a string in the VM
func (c *Client) CreateString(ctx context.Context, str string) (string, error) {
	data := EncodeString(str)

	packet := createCommandPacketWithData(vmCommandSet, vmCommandCreateString, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to create string",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to create string",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Create string failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	stringID := reader.readID(c.idsizes.ObjectIDSize)

	return fmt.Sprintf("%c:%s", tag, stringID), nil
}

// HoldEvents Hold events
func (c *Client) HoldEvents(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandHoldEvents)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to hold events",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to hold events",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Hold events failed: %s", reply.Message),
		}
	}

	return nil
}

// ReleaseEvents Release events
func (c *Client) ReleaseEvents(ctx context.Context) error {
	packet := createCommandPacket(vmCommandSet, vmCommandReleaseEvents)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to release events",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to release events",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Release events failed: %s", reply.Message),
		}
	}

	return nil
}

// RedefineClasses Redefine classes
func (c *Client) RedefineClasses(ctx context.Context, classes []*ClassDef) error {
	data := make([]byte, 0)

	data = append(data, 0, 0, 0, byte(len(classes)))
	for _, class := range classes {
		data = append(data, encodeID(class.RefTypeID, c.idsizes.ReferenceTypeIDSize)...)
		classBytes := class.ClassBytes
		data = append(data, 0, 0, 0, byte(len(classBytes)))
		data = append(data, classBytes...)
	}

	packet := createCommandPacketWithData(vmCommandSet, vmCommandRedefineClasses, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to redefine classes",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to redefine classes",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Redefine classes failed: %s", reply.Message),
		}
	}

	return nil
}

// AllClassesWithGeneric Get all classes with generic signature
func (c *Client) AllClassesWithGeneric(ctx context.Context) ([]*ClassInfo, error) {
	packet := createCommandPacket(vmCommandSet, vmCommandAllClassesWithGeneric)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get all classes with generic",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get all classes with generic",
			Cause:   err,
		}
	}

	reader := newPacketReader(reply.Data)
	classCount := reader.readInt()

	classes := make([]*ClassInfo, 0, classCount)
	for i := 0; i < classCount; i++ {
		tag := reader.readByte()
		refID := reader.readID(c.idsizes.ReferenceTypeIDSize)
		signature, _ := reader.readString()
		genericSignature, _ := reader.readString()
		status := reader.readInt()

		_ = signature
		_ = genericSignature

		classes = append(classes, &ClassInfo{
			Tag:    tag,
			RefID:  refID,
			Status: status,
		})
	}

	return classes, nil
}

// ClassDef Class definition
type ClassDef struct {
	RefTypeID  string
	ClassBytes []byte
}