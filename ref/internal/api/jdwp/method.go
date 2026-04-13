package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
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
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method line table")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method line table")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get method line table failed: %s", reply.Message))
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
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method variable table")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method variable table")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get method variable table failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	argCount := reader.readInt()
	slots := reader.readInt()

	variableInfos := make([]*VariableInfo, 0, slots)
	for i := 0; i < slots; i++ {
		codeIndex := reader.readInt64()
		name, _ := reader.readString()
		signature, _ := reader.readString()
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
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method bytecodes")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method bytecodes")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get method bytecodes failed: %s", reply.Message))
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
		return false, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to check if method is obsolete")
	}

	reply, err := c.readReply()
	if err != nil {
		return false, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to check if method is obsolete")
	}

	if reply.ErrorCode != 0 {
		return false, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Check if method is obsolete failed: %s", reply.Message))
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
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method variable table with generic")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get method variable table with generic")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get method variable table with generic failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	argCount := reader.readInt()
	slots := reader.readInt()

	variableInfos := make([]*VariableInfo, 0, slots)
	for i := 0; i < slots; i++ {
		codeIndex := reader.readInt64()
		name, _ := reader.readString()
		signature, _ := reader.readString()
		genericSignature, _ := reader.readString()
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
