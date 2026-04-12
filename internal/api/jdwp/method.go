package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
)

// Method Command Set Implementation
// Method command constants are already defined in protocol.go

// LineLocation Line location information
type LineLocation struct {
	LineCodeIndex int64
	LineNumber    int
}

// VariableInfo Variable information
type VariableInfo struct {
	Slot      int
	Name      string
	Signature string
	CodeIndex int64
}

// LineTable Get method line table
func (c *Client) LineTable(refTypeID string, methodID string) ([]*LineLocation, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)
	data = append(data, encodeID(methodID, c.idsizes.MethodIDSize)...)

	packet := createCommandPacketWithData(methodCommandSet, methodCommandLineTable, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method line table",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method line table",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get method line table failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	start := reader.readInt64()
	end := reader.readInt64()
	lines := reader.readInt()

	lineLocations := make([]*LineLocation, 0, lines)
	for i := 0; i < lines; i++ {
		lineCodeIndex := reader.readInt64()
		lineNumber := reader.readInt()

		lineLocations = append(lineLocations, &LineLocation{
			LineCodeIndex: lineCodeIndex,
			LineNumber:    lineNumber,
		})
	}

	_ = start
	_ = end

	return lineLocations, nil
}

// VariableTable Get method variable table
func (c *Client) VariableTable(refTypeID string, methodID string) ([]*VariableInfo, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)
	data = append(data, encodeID(methodID, c.idsizes.MethodIDSize)...)

	packet := createCommandPacketWithData(methodCommandSet, methodCommandVariableTable, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method variable table",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method variable table",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get method variable table failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	argCount := reader.readInt()
	slots := reader.readInt()

	variableInfos := make([]*VariableInfo, 0, slots)
	for i := 0; i < slots; i++ {
		codeIndex := reader.readInt64()
		name := reader.readString()
		signature := reader.readString()
		slot := reader.readInt()
		length := reader.readInt()

		variableInfos = append(variableInfos, &VariableInfo{
			Slot:      slot,
			Name:      name,
			Signature: signature,
			CodeIndex: codeIndex,
		})

		_ = length
	}

	_ = argCount

	return variableInfos, nil
}

// Bytecodes Get method bytecodes
func (c *Client) Bytecodes(refTypeID string, methodID string) ([]byte, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)
	data = append(data, encodeID(methodID, c.idsizes.MethodIDSize)...)

	packet := createCommandPacketWithData(methodCommandSet, methodCommandBytecodes, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method bytecodes",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method bytecodes",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get method bytecodes failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	bytecodes := reader.readBytes()

	return bytecodes, nil
}

// IsObsolete Check if method is obsolete
func (c *Client) IsObsolete(refTypeID string, methodID string) (bool, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)
	data = append(data, encodeID(methodID, c.idsizes.MethodIDSize)...)

	packet := createCommandPacketWithData(methodCommandSet, methodCommandIsObsolete, data)
	if err := c.sendPacket(packet); err != nil {
		return false, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to check if method is obsolete",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return false, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to check if method is obsolete",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return false, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Check if method is obsolete failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	isObsolete := reader.readByte() != 0

	return isObsolete, nil
}

// VariableTableWithGeneric Get method variable table with generic signature
func (c *Client) VariableTableWithGeneric(refTypeID string, methodID string) ([]*VariableInfo, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)
	data = append(data, encodeID(methodID, c.idsizes.MethodIDSize)...)

	packet := createCommandPacketWithData(methodCommandSet, methodCommandVariableTableWithGeneric, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method variable table with generic",
			Cause:   err,
		}
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, &api.APIError{
			Type:    api.CommandError,
			Message: "Failed to get method variable table with generic",
			Cause:   err,
		}
	}

	if reply.ErrorCode != 0 {
		return nil, &api.APIError{
			Type:    api.ProtocolError,
			Code:    int(reply.ErrorCode),
			Message: fmt.Sprintf("Get method variable table with generic failed: %s", reply.Message),
		}
	}

	reader := newPacketReader(reply.Data)
	argCount := reader.readInt()
	slots := reader.readInt()

	variableInfos := make([]*VariableInfo, 0, slots)
	for i := 0; i < slots; i++ {
		codeIndex := reader.readInt64()
		name := reader.readString()
		signature := reader.readString()
		genericSignature := reader.readString()
		slot := reader.readInt()
		length := reader.readInt()

		variableInfos = append(variableInfos, &VariableInfo{
			Slot:      slot,
			Name:      name,
			Signature: signature,
			CodeIndex: codeIndex,
		})

		_ = genericSignature
		_ = length
	}

	_ = argCount

	return variableInfos, nil
}
