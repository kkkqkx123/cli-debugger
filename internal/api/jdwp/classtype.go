package jdwp

import (
	"encoding/binary"
	"fmt"

	"cli-debugger/pkg/errors"
)

// ClassType Command Set Implementation
// ClassType command constants are already defined in protocol.go

// InvokeResult Method invocation result
type InvokeResult struct {
	ReturnValue interface{}
	Exception   string
}

// Superclass Get superclass
func (c *Client) Superclass(classID string) (string, error) {
	data := encodeID(classID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(classTypeCommandSet, classTypeCommandSuperclass, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get superclass")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get superclass")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get superclass failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	superclassID := reader.readID(c.idsizes.ReferenceTypeIDSize)

	return superclassID, nil
}

// SetValues Set static field values
func (c *Client) SetValues(classID string, fieldValues map[string]interface{}) error {
	data := make([]byte, 0)

	data = append(data, encodeID(classID, c.idsizes.ReferenceTypeIDSize)...)

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

	packet := createCommandPacketWithData(classTypeCommandSet, classTypeCommandSetValues, data)
	if err := c.sendPacket(packet); err != nil {
		return errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to set static field values")
	}

	reply, err := c.readReply()
	if err != nil {
		return errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to set static field values")
	}

	if reply.ErrorCode != 0 {
		return errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Set static field values failed: %s", reply.Message))
	}

	return nil
}

// InvokeMethod Invoke static method
func (c *Client) InvokeMethod(classID string, threadID string, methodID string, args []interface{}, options int) (*InvokeResult, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(classID, c.idsizes.ReferenceTypeIDSize)...)
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

	packet := createCommandPacketWithData(classTypeCommandSet, classTypeCommandInvokeMethod, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to invoke static method")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to invoke static method")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Invoke static method failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	returnValue, _ := reader.readValue(tag)
	exception := reader.readID(c.idsizes.ObjectIDSize)

	return &InvokeResult{
		ReturnValue: returnValue,
		Exception:   exception,
	}, nil
}

// NewInstance Create new instance
func (c *Client) NewInstance(classID string, threadID string, methodID string, args []interface{}, options int) (string, string, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(classID, c.idsizes.ReferenceTypeIDSize)...)
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

	packet := createCommandPacketWithData(classTypeCommandSet, classTypeCommandNewInstance, data)
	if err := c.sendPacket(packet); err != nil {
		return "", "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to create new instance")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to create new instance")
	}

	if reply.ErrorCode != 0 {
		return "", "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Create new instance failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	tag := reader.readByte()
	newInstance := reader.readID(c.idsizes.ObjectIDSize)
	exception := reader.readID(c.idsizes.ObjectIDSize)

	return fmt.Sprintf("%c:%s", tag, newInstance), exception, nil
}
