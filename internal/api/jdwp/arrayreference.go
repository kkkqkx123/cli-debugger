package jdwp

import (
	"context"
	"encoding/binary"
	"fmt"

	"cli-debugger/internal/api"
)

// ArrayReference Command Set Implementation
// ArrayReference command constants are already defined in protocol.go

// Length Get array length
func (c *Client) Length(arrayID string) (int, error) {
	data := encodeID(arrayID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(arrayReferenceCommandSet, arrayReferenceCommandLength, data)
	if err := c.sendPacket(packet); err != nil {
		return 0, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get array length",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return 0, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get array length",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return 0, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get array length failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	arrayLength := reader.readInt()

	return arrayLength, nil
}

// GetValues Get array values
func (c *Client) GetValues(arrayID string, startIndex int, length int) ([]interface{}, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(arrayID, c.idsizes.ObjectIDSize)...)

	startIndexBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(startIndexBytes, uint32(startIndex))
	data = append(data, startIndexBytes...)

	lengthBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(lengthBytes, uint32(length))
	data = append(data, lengthBytes...)

	packet := createCommandPacketWithData(arrayReferenceCommandSet, arrayReferenceCommandGetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get array values",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get array values",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get array values failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	values := make([]interface{}, 0, length)
	for i := 0; i < length; i++ {
		tag := reader.readByte()
		value, _ := reader.readValue(tag)
		values = append(values, value)
	}

	return values, nil
}

// SetValues Set array values
func (c *Client) SetValues(arrayID string, startIndex int, values []interface{}) error {
	data := make([]byte, 0)

	data = append(data, encodeID(arrayID, c.idsizes.ObjectIDSize)...)

	startIndexBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(startIndexBytes, uint32(startIndex))
	data = append(data, startIndexBytes...)

	for _, value := range values {
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

	packet := createCommandPacketWithData(arrayReferenceCommandSet, arrayReferenceCommandSetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to set array values",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to set array values",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Set array values failed: %s", reply.Message),
		}
	}

	return nil
}
