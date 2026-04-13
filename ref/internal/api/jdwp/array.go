package jdwp

import (
	"encoding/binary"
	"fmt"

	"cli-debugger/pkg/errors"
)

// ArrayReference Command Set Implementation
// ArrayReference command constants are already defined in protocol.go

// Length Get array length
func (c *Client) Length(arrayID string) (int, error) {
	data := encodeID(arrayID, c.idsizes.ObjectIDSize)

	packet := createCommandPacketWithData(arrayReferenceCommandSet, arrayReferenceCommandLength, data)
	if err := c.sendPacket(packet); err != nil {
		return 0, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get array length")
	}

	reply, err := c.readReply()
	if err != nil {
		return 0, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get array length")
	}

	if reply.ErrorCode != 0 {
		return 0, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get array length failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	arrayLength := reader.readInt()

	return arrayLength, nil
}

// GetArrayValues Get array values
func (c *Client) GetArrayValues(arrayID string, startIndex int, length int) ([]interface{}, error) {
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
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get array values")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get array values")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get array values failed: %s", reply.Message))
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

// SetArrayValues Set array values
func (c *Client) SetArrayValues(arrayID string, startIndex int, values []interface{}) error {
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
		return errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to set array values")
	}

	reply, err := c.readReply()
	if err != nil {
		return errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to set array values")
	}

	if reply.ErrorCode != 0 {
		return errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Set array values failed: %s", reply.Message))
	}

	return nil
}
