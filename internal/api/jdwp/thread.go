package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"

	"cli-debugger/internal/api"
)

// ThreadReference Command Set Implementation
// Thread command constants are already defined in protocol.go

// GetThreadName Get the thread name.
func (c *Client) GetThreadName(ctx context.Context, threadID string) (string, error) {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.Name 命令 (Command Set = 10, Command = 1)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandName, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread name",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread name",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get thread name failed: %s", reply.Message),
		}
	}

	// 解析线程名称
	reader := newPacketReader(reply.Data)
	name, err := reader.readString()
	if err != nil {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Message: "Failed to read thread name",
			Cause:   err,
		}
	}

	return name, nil
}

// GetThreadStatus Get Thread Status
func (c *Client) GetThreadStatus(ctx context.Context, threadID string) (string, int, error) {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.Status 命令 (Command Set = 10, Command = 4)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandStatus, data)
	if err := c.sendPacket(packet); err != nil {
		return "", 0, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread status",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", 0, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread status",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", 0, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get thread status failed: %s", reply.Message),
		}
	}

	// 解析线程状态
	reader := newPacketReader(reply.Data)
	threadStatus := reader.readInt()
	suspendStatus := reader.readInt()

	// 将状态转换为字符串
	stateStr := GetThreadStateString(threadStatus)

	return stateStr, suspendStatus, nil
}

// SuspendThread Hangs the specified thread.
func (c *Client) SuspendThread(ctx context.Context, threadID string) error {
	return c.suspendThreadInternal(ctx, threadID)
}

// suspendThreadInternal 内部方法
func (c *Client) suspendThreadInternal(ctx context.Context, threadID string) error {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.Suspend 命令 (Command Set = 10, Command = 2)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandSuspend, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to suspend thread",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to suspend thread",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Suspend thread failed: %s", reply.Message),
		}
	}

	return nil
}

// ResumeThread Resumes the specified thread.
func (c *Client) ResumeThread(ctx context.Context, threadID string) error {
	return c.resumeThreadInternal(ctx, threadID)
}

// resumeThreadInternal 内部方法
func (c *Client) resumeThreadInternal(ctx context.Context, threadID string) error {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.Resume 命令 (Command Set = 10, Command = 3)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandResume, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to resume thread",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to resume thread",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Resume thread failed: %s", reply.Message),
		}
	}

	return nil
}

// GetThreadFrames Get Thread Call Stack Frames
func (c *Client) GetThreadFrames(ctx context.Context, threadID string, startFrame int, length int) ([]*StackFrameInfo, error) {
	// 构造请求数据
	data := make([]byte, 0)

	// Thread ID (根据 IDSizes)
	threadIDBytes := encodeID(threadID, c.idsizes.ObjectIDSize)
	data = append(data, threadIDBytes...)

	// Start frame index (4 bytes)
	startBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(startBytes, uint32(startFrame))
	data = append(data, startBytes...)

	// Number of frames (4 bytes)
	lengthBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(lengthBytes, uint32(length))
	data = append(data, lengthBytes...)

	// 发送 ThreadReference.Frames 命令 (Command Set = 10, Command = 6)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandFrames, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread frames",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread frames",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get thread frames failed: %s", reply.Message),
		}
	}

	// 解析响应
	reader := newPacketReader(reply.Data)
	frameCount := reader.readInt()

	frames := make([]*StackFrameInfo, 0, frameCount)
	for i := 0; i < frameCount; i++ {
		frameID := reader.readID(c.idsizes.FrameIDSize)

		// 读取位置信息
		tag := reader.readByte() // 类类型标签
		classID := reader.readID(c.idsizes.ReferenceTypeIDSize)
		methodID := reader.readID(c.idsizes.MethodIDSize)
		codeIndex := reader.readUint64()

		frames = append(frames, &StackFrameInfo{
			FrameID:  frameID,
			Location: fmt.Sprintf("%s", classID),
			Method:   fmt.Sprintf("method_%s", methodID),
		})
	}

	return frames, nil
}

// GetThreadFrameCount Get the number of stack frames for a thread
func (c *Client) GetThreadFrameCount(ctx context.Context, threadID string) (int, error) {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.FrameCount 命令 (Command Set = 10, Command = 7)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandFrameCount, data)
	if err := c.sendPacket(packet); err != nil {
		return 0, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread frame count",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return 0, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread frame count",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return 0, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get thread frame count failed: %s", reply.Message),
		}
	}

	// 解析响应
	reader := newPacketReader(reply.Data)
	frameCount := reader.readInt()

	return frameCount, nil
}

// GetThreadMonitors Get the monitors held by a thread.
func (c *Client) GetThreadMonitors(ctx context.Context, threadID string) ([]string, error) {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.OwnedMonitors 命令 (Command Set = 10, Command = 8)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandOwnedMonitors, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread monitors",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get thread monitors",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get thread monitors failed: %s", reply.Message),
		}
	}

	// 解析响应
	reader := newPacketReader(reply.Data)
	monitorCount := reader.readInt()

	monitors := make([]string, 0, monitorCount)
	for i := 0; i < monitorCount; i++ {
		objectID := reader.readID(c.idsizes.ObjectIDSize)
		monitors = append(monitors, objectID)
	}

	return monitors, nil
}

// GetCurrentContendedMonitor Get the current contended monitor
func (c *Client) GetCurrentContendedMonitor(ctx context.Context, threadID string) (string, error) {
	// 编码线程ID
	data := encodeID(threadID, c.idsizes.ObjectIDSize)
	
	// 发送 ThreadReference.CurrentContendedMonitor 命令 (Command Set = 10, Command = 9)
	packet := createCommandPacketWithData(threadCommandSet, threadCommandCurrentContendedMonitor, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get current contended monitor",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get current contended monitor",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get current contended monitor failed: %s", reply.Message),
		}
	}

	// 解析响应
	reader := newPacketReader(reply.Data)
	objectID := reader.readID(c.idsizes.ObjectIDSize)

	return objectID, nil
}

// Stop stops the thread (throws an exception)
func (c *Client) Stop(ctx context.Context, threadID string, exceptionID string) error {
	// TODO: 实现 ThreadReference.Stop 命令
	return nil
}

// Breakpoint Setting breakpoints in a thread
func (c *Client) Breakpoint(ctx context.Context, threadID string) error {
	// TODO: 实现 ThreadReference.Breakpoint 命令
	return nil
}

// StackFrameInfo Stack Frame Info
type StackFrameInfo struct {
	FrameID     string
	Location    string
	Method      string
	IsObsolete  bool
}

// ThreadState Thread state constant
const (
	ThreadStateZombie      = 1 // zombie thread
	ThreadStateRunning     = 2 // running
	ThreadStateSleeping    = 3 // asleep
	ThreadStateMonitor     = 4 // Waiting for the monitor
	ThreadStateWait        = 5 // wait for
	ThreadStateNotStarted  = 6 // inactive
	ThreadStateStarted     = 7 // activated
)

// GetThreadStateString Converts the thread state to a string.
func GetThreadStateString(state int) string {
	switch state {
	case ThreadStateZombie:
		return "zombie"
	case ThreadStateRunning:
		return "running"
	case ThreadStateSleeping:
		return "sleeping"
	case ThreadStateMonitor:
		return "waiting-for-monitor"
	case ThreadStateWait:
		return "waiting"
	case ThreadStateNotStarted:
		return "not-started"
	case ThreadStateStarted:
		return "started"
	default:
		return fmt.Sprintf("unknown(%d)", state)
	}
}