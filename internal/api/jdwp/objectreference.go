package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"

	"cli-debugger/internal/api"
)

// ObjectReference Command Set Implementation
// ObjectReference command constants are already defined in protocol.go

// MonitorInfo Monitor information
type MonitorInfo struct {
	Owner        string
	EntryCount   int
	Waiters      []string
	WaitersCount int
}

// ReferenceType Get object type
func (c *Client) ReferenceType(objectID string) (string, error) {
	data := encodeID(objectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandReferenceType, data)
	if err := c.sendPacket(packet); err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get object type",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get object type",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get object type failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	refTypeID := reader.readID(c.idsizes.ReferenceTypeIDSize)

	return fmt.Sprintf("%c:%s", tag, refTypeID), nil
}

// GetValues Get instance field values
func (c *Client) GetValues(objectID string, fieldIDs []string) ([]interface{}, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(objectID, c.idsizes.ObjectIDSize)...)

	data = append(data, 0, 0, 0, byte(len(fieldIDs)))
	for _, fieldID := range fieldIDs {
		data = append(data, encodeID(fieldID, c.idsizes.FieldIDSize)...)
	}

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandGetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get instance field values",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get instance field values",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get instance field values failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	values := make([]interface{}, 0, len(fieldIDs))
	for i := 0; i < len(fieldIDs); i++ {
		tag := reader.readByte()
		value, _ := reader.readValue(tag)
		values = append(values, value)
	}

	return values, nil
}

// SetValues Set instance field values
func (c *Client) SetValues(objectID string, fieldValues map[string]interface{}) error {
	data := make([]byte, 0)

	data = append(data, encodeID(objectID, c.idsizes.ObjectIDSize)...)

	data = append(data, 0, 0, 0, byte(len(fieldValues)))
	for fieldID, value := range fieldValues {
		data = append(data, encodeID(fieldID, c.idsizes.FieldIDSize)...)

		valueBytes := make([]byte, 0)
		switch val := value.(type) {
		case int8:
			valueBytes = append(valueBytes, 'B')
			valueBytes = append(valueBytes, byte(val))
		case int16:
			valueBytes = append(valueBytes, 'S')
			valueBytes = append(valueBytes, byte(val>>8), byte(val))
		case int32:
			valueBytes = append(valueBytes, 'I')
			valueBytes = append(valueBytes, byte(val>>24), byte(val>>16), byte(val>>8), byte(val))
		case int64:
			valueBytes = append(valueBytes, 'J')
			valueBytes = append(valueBytes, byte(val>>56), byte(val>>48), byte(val>>40), byte(val>>32), byte(val>>24), byte(val>>16), byte(val>>8), byte(val))
		case float32:
			valueBytes = append(valueBytes, 'F')
			bits := uint32(val)
			valueBytes = append(valueBytes, byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
		case float64:
			valueBytes = append(valueBytes, 'D')
			bits := uint64(val)
			valueBytes = append(valueBytes, byte(bits>>56), byte(bits>>48), byte(bits>>40), byte(bits>>32), byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
		case bool:
			valueBytes = append(valueBytes, 'Z')
			if val {
				valueBytes = append(valueBytes, 1)
			} else {
				valueBytes = append(valueBytes, 0)
			}
		case string:
			valueBytes = append(valueBytes, 'L')
			valueBytes = append(valueBytes, encodeID(val, c.idsizes.ObjectIDSize)...)
		case nil:
			valueBytes = append(valueBytes, 'L')
			valueBytes = append(valueBytes, 0, 0, 0, 0, 0, 0, 0, 0)
		default:
			valueBytes = append(valueBytes, 'L')
			valueBytes = append(valueBytes, 0, 0, 0, 0, 0, 0, 0, 0)
		}

		data = append(data, valueBytes...)
	}

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandSetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to set instance field values",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to set instance field values",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Set instance field values failed: %s", reply.Message),
		}
	}

	return nil
}

// MonitorInfo Get object monitor info
func (c *Client) MonitorInfo(objectID string) (*MonitorInfo, error) {
	data := encodeID(objectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandMonitorInfo, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get object monitor info",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get object monitor info",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get object monitor info failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	owner := reader.readID(c.idsizes.ObjectIDSize)
	entryCount := reader.readInt()
	waitersCount := reader.readInt()

	waiters := make([]string, 0, waitersCount)
	for i := 0; i < waitersCount; i++ {
		waiter := reader.readID(c.idsizes.ObjectIDSize)
		waiters = append(waiters, waiter)
	}

	return &MonitorInfo{
		Owner:        owner,
		EntryCount:   entryCount,
		Waiters:      waiters,
		WaitersCount: waitersCount,
	}, nil
}

// InvokeMethod Invoke instance method
func (c *Client) InvokeMethod(objectID string, threadID string, methodID string, args []interface{}, options int) (interface{}, string, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(objectID, c.idsizes.ObjectIDSize)...)
	data = append(data, encodeID(threadID, c.idsizes.ObjectIDSize)...)
	data = append(data, encodeID(methodID, c.idsizes.MethodIDSize)...)

	data = append(data, 0, 0, 0, byte(len(args)))
	for _, arg := range args {
		argBytes := make([]byte, 0)
		switch val := arg.(type) {
		case int8:
			argBytes = append(argBytes, 'B')
			argBytes = append(argBytes, byte(val))
		case int16:
			argBytes = append(argBytes, 'S')
			argBytes = append(argBytes, byte(val>>8), byte(val))
		case int32:
			argBytes = append(argBytes, 'I')
			argBytes = append(argBytes, byte(val>>24), byte(val>>16), byte(val>>8), byte(val))
		case int64:
			argBytes = append(argBytes, 'J')
			argBytes = append(argBytes, byte(val>>56), byte(val>>48), byte(val>>40), byte(val>>32), byte(val>>24), byte(val>>16), byte(val>>8), byte(val))
		case float32:
			argBytes = append(argBytes, 'F')
			bits := uint32(val)
			argBytes = append(argBytes, byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
		case float64:
			argBytes = append(argBytes, 'D')
			bits := uint64(val)
			argBytes = append(argBytes, byte(bits>>56), byte(bits>>48), byte(bits>>40), byte(bits>>32), byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
		case bool:
			argBytes = append(argBytes, 'Z')
			if val {
				argBytes = append(argBytes, 1)
			} else {
				argBytes = append(argBytes, 0)
			}
		case string:
			argBytes = append(argBytes, 'L')
			argBytes = append(argBytes, encodeID(val, c.idsizes.ObjectIDSize)...)
		case nil:
			argBytes = append(argBytes, 'L')
			argBytes = append(argBytes, 0, 0, 0, 0, 0, 0, 0, 0)
		default:
			argBytes = append(argBytes, 'L')
			argBytes = append(argBytes, 0, 0, 0, 0, 0, 0, 0, 0)
		}

		data = append(data, argBytes...)
	}

	optionsBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(optionsBytes, uint32(options))
	data = append(data, optionsBytes...)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandInvokeMethod, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to invoke instance method",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, "", &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to invoke instance method",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, "", &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Invoke instance method failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	returnValue := reader.readValue(reader.readByte())
	exception := reader.readID(c.idsizes.ObjectIDSize)

	return returnValue, exception, nil
}

// DisableCollection Disable object garbage collection
func (c *Client) DisableCollection(objectID string) error {
	data := encodeID(objectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandDisableCollection, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to disable object garbage collection",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to disable object garbage collection",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Disable object garbage collection failed: %s", reply.Message),
		}
	}

	return nil
}

// EnableCollection Enable object garbage collection
func (c *Client) EnableCollection(objectID string) error {
	data := encodeID(objectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandEnableCollection, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to enable object garbage collection",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to enable object garbage collection",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Enable object garbage collection failed: %s", reply.Message),
		}
	}

	return nil
}

// IsCollected Check if object is collected
func (c *Client) IsCollected(objectID string) (bool, error) {
	data := encodeID(objectID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandIsCollected, data)
	if err := c.sendPacket(packet); err != nil {
		return false, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to check if object is collected",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return false, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to check if object is collected",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return false, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Check if object is collected failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	isCollected := reader.readByte() != 0

	return isCollected, nil
}

// ReferringObjects Get objects referring to this object
func (c *Client) ReferringObjects(objectID string, maxReferrers int) ([]string, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(objectID, c.idsizes.ObjectIDSize)...)

	maxReferrersBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(maxReferrersBytes, uint32(maxReferrers))
	data = append(data, maxReferrersBytes...)

	packet := createCommandPacketWithData(objectReferenceCommandSet, objectReferenceCommandReferringObjects, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get referring objects",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get referring objects",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get referring objects failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	referringCount := reader.readInt()

	referringObjects := make([]string, 0, referringCount)
	for i := 0; i < referringCount; i++ {
		instance := reader.readID(c.idsizes.ObjectIDSize)
		referringObjects = append(referringObjects, instance)
	}

	return referringObjects, nil
}
