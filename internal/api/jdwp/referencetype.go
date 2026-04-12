package jdwp

import (
	"fmt"

	"cli-debugger/pkg/errors"
)

// ReferenceType Command Set Implementation
// ReferenceType command constants are already defined in protocol.go

// FieldInfo Field Information
type FieldInfo struct {
	FieldID   string
	Name      string
	Signature string
	Modifiers int
}

// MethodInfo Method Information
type MethodInfo struct {
	MethodID  string
	Name      string
	Signature string
	Modifiers int
}

// Signature Get class signature
func (c *Client) Signature(refTypeID string) (string, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, referenceTypeCommandSignature, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class signature")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class signature")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class signature failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	signature, err := reader.readString()
	if err != nil {
		return "", errors.WrapProtocolError(err, errors.ErrInvalidResponse, "Failed to read class signature")
	}

	return signature, nil
}

// Fields Get class fields
func (c *Client) Fields(refTypeID string) ([]*FieldInfo, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, referenceTypeCommandFields, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class fields")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class fields")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class fields failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	declared := reader.readInt()

	fields := make([]*FieldInfo, 0, declared)
	for i := 0; i < declared; i++ {
		fieldID := reader.readID(c.idsizes.FieldIDSize)
		name, _ := reader.readString()
		signature, _ := reader.readString()
		modifiers := reader.readInt()

		fields = append(fields, &FieldInfo{
			FieldID:   fieldID,
			Name:      name,
			Signature: signature,
			Modifiers: modifiers,
		})
	}

	return fields, nil
}

// Methods Get class methods
func (c *Client) Methods(refTypeID string) ([]*MethodInfo, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, referenceTypeCommandMethods, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class methods")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class methods")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class methods failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	declared := reader.readInt()

	methods := make([]*MethodInfo, 0, declared)
	for i := 0; i < declared; i++ {
		methodID := reader.readID(c.idsizes.MethodIDSize)
		name, _ := reader.readString()
		signature, _ := reader.readString()
		modifiers := reader.readInt()

		methods = append(methods, &MethodInfo{
			MethodID:  methodID,
			Name:      name,
			Signature: signature,
			Modifiers: modifiers,
		})
	}

	return methods, nil
}

// SourceFile Get source file name
func (c *Client) SourceFile(refTypeID string) (string, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, referenceTypeCommandSourceFile, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get source file")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get source file")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get source file failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	sourceFile, err := reader.readString()
	if err != nil {
		return "", errors.WrapProtocolError(err, errors.ErrInvalidResponse, "Failed to read source file")
	}

	return sourceFile, nil
}

// GetValues Get static field values
func (c *Client) GetValues(refTypeID string, fieldIDs []string) ([]interface{}, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)

	data = append(data, 0, 0, 0, byte(len(fieldIDs)))
	for _, fieldID := range fieldIDs {
		data = append(data, encodeID(fieldID, c.idsizes.FieldIDSize)...)
	}

	packet := createCommandPacketWithData(referenceTypeCommandSet, 6, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get static field values")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get static field values")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get static field values failed: %s", reply.Message))
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

// GetValuesWithTags Get static field values with tags
func (c *Client) GetValuesWithTags(refTypeID string, fieldIDs []string) ([]byte, []interface{}, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)

	data = append(data, 0, 0, 0, byte(len(fieldIDs)))
	for _, fieldID := range fieldIDs {
		data = append(data, encodeID(fieldID, c.idsizes.FieldIDSize)...)
	}

	packet := createCommandPacketWithData(referenceTypeCommandSet, 6, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get static field values")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get static field values")
	}

	if reply.ErrorCode != 0 {
		return nil, nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get static field values failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	tags := make([]byte, 0, len(fieldIDs))
	values := make([]interface{}, 0, len(fieldIDs))
	for i := 0; i < len(fieldIDs); i++ {
		tag := reader.readByte()
		tags = append(tags, tag)
		value, _ := reader.readValue(tag)
		values = append(values, value)
	}

	return tags, values, nil
}

// ClassFileVersion Get class file version
func (c *Client) ClassFileVersion(refTypeID string) (int, int, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, 17, data)
	if err := c.sendPacket(packet); err != nil {
		return 0, 0, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class file version")
	}

	reply, err := c.readReply()
	if err != nil {
		return 0, 0, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class file version")
	}

	if reply.ErrorCode != 0 {
		return 0, 0, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class file version failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	majorVersion := reader.readInt()
	minorVersion := reader.readInt()

	return majorVersion, minorVersion, nil
}

// ConstantPool Get class constant pool
func (c *Client) ConstantPool(refTypeID string) ([]byte, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, 18, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class constant pool")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class constant pool")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class constant pool failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	constantPoolCount := reader.readInt()

	constantPool := make([]byte, 0, constantPoolCount)
	for i := 0; i < constantPoolCount; i++ {
		b := reader.readByte()
		constantPool = append(constantPool, b)
	}

	return constantPool, nil
}

// Instances Get class instances
func (c *Client) Instances(refTypeID string, maxInstances int) ([]string, error) {
	data := make([]byte, 0)

	data = append(data, encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)...)

	maxInstancesBytes := make([]byte, 4)
	maxInstancesBytes[0] = byte(maxInstances >> 24)
	maxInstancesBytes[1] = byte(maxInstances >> 16)
	maxInstancesBytes[2] = byte(maxInstances >> 8)
	maxInstancesBytes[3] = byte(maxInstances)

	data = append(data, maxInstancesBytes...)

	packet := createCommandPacketWithData(referenceTypeCommandSet, 16, data)
	if err := c.sendPacket(packet); err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class instances")
	}

	reply, err := c.readReply()
	if err != nil {
		return nil, errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class instances")
	}

	if reply.ErrorCode != 0 {
		return nil, errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class instances failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	instances := make([]string, 0, maxInstances)
	instanceCount := reader.readInt()
	for i := 0; i < instanceCount; i++ {
		instance := reader.readID(c.idsizes.ObjectIDSize)
		instances = append(instances, instance)
	}

	return instances, nil
}

// ClassLoader Get class loader
func (c *Client) ClassLoader(refTypeID string) (string, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, 19, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class loader")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get class loader")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get class loader failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	classLoaderID := reader.readID(c.idsizes.ObjectIDSize)

	return classLoaderID, nil
}

// Module Get module
func (c *Client) Module(refTypeID string) (string, error) {
	data := encodeID(refTypeID, c.idsizes.ReferenceTypeIDSize)

	packet := createCommandPacketWithData(referenceTypeCommandSet, 20, data)
	if err := c.sendPacket(packet); err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get module")
	}

	reply, err := c.readReply()
	if err != nil {
		return "", errors.WrapCommandError(err, errors.ErrCommandFailed, "Failed to get module")
	}

	if reply.ErrorCode != 0 {
		return "", errors.NewProtocolError(errors.ErrProtocolError,
			fmt.Sprintf("Get module failed: %s", reply.Message))
	}

	reader := newPacketReader(reply.Data)
	moduleID := reader.readID(c.idsizes.ObjectIDSize)

	return moduleID, nil
}
