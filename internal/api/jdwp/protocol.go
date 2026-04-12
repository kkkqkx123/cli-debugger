package jdwp

import (
	"encoding/binary"
	"errors"
	"fmt"
)

// Constant Definition
const (
	// Command Packet Flag
	cmdFlag byte = 0x00
	// response kitemarker
	replyFlag byte = 0x80

	// VM Command Set
	vmCommandSet byte = 1
	// Thread Instructions
	threadCommandSet byte = 2
	// ClassType command set
	classTypeCommandSet byte = 3
	// Method Instruction Collection
	methodCommandSet byte = 4
	// Field command set
	fieldCommandSet byte = 5
	// ReferenceType Command Set
	referenceTypeCommandSet byte = 6
	// ArrayType Instructions
	arrayTypeCommandSet byte = 7
	// VirtualMachine Instruction Collection
	virtualMachineCommandSet byte = 8
	// EventRequest command set
	eventRequestCommandSet byte = 9
	// StackFrame Command Set
	stackFrameCommandSet byte = 10
	// ObjectReference command set
	objectReferenceCommandSet byte = 11
	// ReferenceType Command set (repeat)
	referenceTypeCommandSet2 byte = 12

	// VM Commands
	vmCommandVersion byte = 1
	vmCommandAllClasses byte = 2
	vmCommandAllThreads byte = 3
	vmCommandSuspend byte = 4
	vmCommandResume byte = 5
	vmCommandIDSizes byte = 6
	vmCommandClassByName byte = 7
	vmCommandDispose byte = 8

	// Event Type
	eventTypeSingleStep byte = 1
	eventTypeBreakpoint byte = 2
	eventTypeFramePop byte = 3
	eventTypeException byte = 4
	eventTypeUserDefined byte = 5
	eventTypeThreadStart byte = 6
	eventTypeThreadDeath byte = 7
	eventTypeClassPrepare byte = 8
	eventTypeClassUnload byte = 9
	eventTypeClassLoad byte = 10
	eventTypeFieldAccess byte = 11
	eventTypeFieldModification byte = 12
	eventTypeVMStart byte = 13
)

// CommandPacket Command Packet
type CommandPacket struct {
	ID        uint32
	Flags     byte
	CommandSet byte
	Command   byte
	Data      []byte
}

// ReplyPacket Response Packet
type ReplyPacket struct {
	ID         uint32
	Flags      byte
	ErrorCode  uint16
	Message    string
	Data       []byte
}

// JDWPError JDWP Error Code
type JDWPError uint16

const (
	ErrNone                      JDWPError = 0
	ErrInvalidID                 JDWPError = 1
	ErrInvalidInstance           JDWPError = 10
	ErrInvalidObject             JDWPError = 10
	ErrInvalidClass              JDWPError = 20
	ErrClassNotPrepared          JDWPError = 21
	ErrInvalidMethodID           JDWPError = 30
	ErrInvalidLocation           JDWPError = 40
	ErrInvalidFieldID            JDWPError = 50
	ErrInvalidFrameID            JDWPError = 60
	ErrInvalidThread             JDWPError = 70
	ErrInvalidEventRequest       JDWPError = 80
	ErrInvalidCaptureThread      JDWPError = 90
	ErrInvalidTag                JDWPError = 100
	ErrOutOfMemory               JDWPError = 110
	ErrInvalidAddress            JDWPError = 120
	ErrInvalidString             JDWPError = 130
	ErrInvalidLength             JDWPError = 140
	ErrInvalidGroup              JDWPError = 150
	ErrInvalidMonitor            JDWPError = 160
	ErrInvalidCount              JDWPError = 170
	ErrNotImplemented          JDWPError = 999
)

var errorMessages = map[JDWPError]string{
	ErrNone:                "error-free",
	ErrInvalidID:           "Invalid ID",
	ErrInvalidInstance:     "Examples of invalid",
	ErrInvalidObject:       "null object",
	ErrInvalidClass:        "void class",
	ErrClassNotPrepared:    "unprepared",
	ErrInvalidMethodID:     "Invalid Method ID",
	ErrInvalidLocation:     "void",
	ErrInvalidFieldID:      "Invalid Field ID",
	ErrInvalidFrameID:      "Invalid Frame ID",
	ErrInvalidThread:       "Invalid threads",
	ErrInvalidEventRequest: "Invalid event requests",
	ErrOutOfMemory:         "lack of memory",
	ErrNotImplemented:      "unrealized",
}

// Error Returns an error message
func (e JDWPError) Error() string {
	if msg, ok := errorMessages[e]; ok {
		return msg
	}
	return fmt.Sprintf("Unknown error (%d)", e)
}

// encodeCommandPacket encodeCommandPacket
func encodeCommandPacket(id uint32, commandSet byte, command byte, data []byte) []byte {
	// 总长度 = 4(长度) + 4(ID) + 1(标志) + 1(命令集) + 1(命令) + 数据长度
	length := 11 + len(data)
	packet := make([]byte, length)

	// Write length (big end sequence)
	binary.BigEndian.PutUint32(packet[0:4], uint32(length))

	// Write ID (Big Endian)
	binary.BigEndian.PutUint32(packet[4:8], id)

	// Write flag
	packet[8] = cmdFlag

	// Write command sets and commands
	packet[9] = commandSet
	packet[10] = command

	// write data
	copy(packet[11:], data)

	return packet
}

// decodeReplyPacket decodeReplyPacket
func decodeReplyPacket(data []byte) (*ReplyPacket, error) {
	if len(data) < 11 {
		return nil, errors.New("Packets too short")
	}

	packet := &ReplyPacket{}

	// Read ID
	packet.ID = binary.BigEndian.Uint32(data[0:4])

	// readout sign
	packet.Flags = data[4]

	// check mark
	if packet.Flags != replyFlag {
		return nil, errors.New("Invalid Answer Packet Flag")
	}

	// Read error code
	packet.ErrorCode = binary.BigEndian.Uint16(data[5:7])

	// Getting Error Messages
	if packet.ErrorCode != 0 {
		packet.Message = JDWPError(packet.ErrorCode).Error()
	}

	// Read data section
	if len(data) > 7 {
		packet.Data = data[7:]
	}

	return packet, nil
}

// createCommandPacket Creates a command packet (using a global counter).
var packetIDCounter uint32 = 1

func createCommandPacket(commandSet byte, command byte) []byte {
	id := getNextPacketID()
	return encodeCommandPacket(id, commandSet, command, nil)
}

func createCommandPacketWithData(commandSet byte, command byte, data []byte) []byte {
	id := getNextPacketID()
	return encodeCommandPacket(id, commandSet, command, data)
}

func getNextPacketID() uint32 {
	id := packetIDCounter
	packetIDCounter++
	if packetIDCounter == 0 {
		packetIDCounter = 1
	}
	return id
}

// PacketReader Packet Reader
type PacketReader struct {
	data []byte
	pos  int
}

func newPacketReader(data []byte) *PacketReader {
	return &PacketReader{data: data, pos: 0}
}

func (r *PacketReader) readByte() byte {
	if r.pos >= len(r.data) {
		return 0
	}
	b := r.data[r.pos]
	r.pos++
	return b
}

func (r *PacketReader) readInt() int {
	if r.pos+4 > len(r.data) {
		return 0
	}
	val := int(binary.BigEndian.Uint32(r.data[r.pos : r.pos+4]))
	r.pos += 4
	return val
}

func (r *PacketReader) readUint32() uint32 {
	if r.pos+4 > len(r.data) {
		return 0
	}
	val := binary.BigEndian.Uint32(r.data[r.pos : r.pos+4])
	r.pos += 4
	return val
}

func (r *PacketReader) readID(size int) string {
	if r.pos+size > len(r.data) {
		return ""
	}
	var id uint64
	switch size {
	case 4:
		id = uint64(binary.BigEndian.Uint32(r.data[r.pos : r.pos+4]))
	case 8:
		id = binary.BigEndian.Uint64(r.data[r.pos : r.pos+8])
	default:
		return ""
	}
	r.pos += size
	return fmt.Sprintf("%d", id)
}

func (r *PacketReader) readString() (string, error) {
	length := r.readInt()
	if length < 0 || r.pos+length > len(r.data) {
		return "", errors.New("Invalid string length")
	}
	str := string(r.data[r.pos : r.pos+length])
	r.pos += length
	return str, nil
}

func (r *PacketReader) readValue(tag byte) (interface{}, error) {
	switch tag {
	case 'B': // byte
		return int8(r.readByte()), nil
	case 'C': // char
		return rune(r.readUint32()), nil
	case 'D': // double
		if r.pos+8 > len(r.data) {
			return 0, errors.New("double Insufficient data")
		}
		val := binary.BigEndian.Uint64(r.data[r.pos : r.pos+8])
		r.pos += 8
		return float64(val), nil
	case 'F': // float
		if r.pos+4 > len(r.data) {
			return 0, errors.New("Insufficient float data")
		}
		val := binary.BigEndian.Uint32(r.data[r.pos : r.pos+4])
		r.pos += 4
		return float32(val), nil
	case 'I': // int
		return r.readInt(), nil
	case 'J': // long
		if r.pos+8 > len(r.data) {
			return 0, errors.New("long Insufficient data")
		}
		val := binary.BigEndian.Uint64(r.data[r.pos : r.pos+8])
		r.pos += 8
		return int64(val), nil
	case 'L': // object
		tag := r.readByte()
		id := r.readID(8)
		return fmt.Sprintf("%c:%s", tag, id), nil
	case 'S': // short
		if r.pos+2 > len(r.data) {
			return 0, errors.New("short Insufficient data")
		}
		val := int16(binary.BigEndian.Uint16(r.data[r.pos : r.pos+2]))
		r.pos += 2
		return int(val), nil
	case 'Z': // boolean
		return r.readByte() != 0, nil
	case 'V': // void
		return nil, nil
	default:
		return fmt.Sprintf("unknown(%c)", tag), nil
	}
}

// bytesToUint32 bytes array to uint32
func bytesToUint32(b []byte) uint32 {
	return binary.BigEndian.Uint32(b)
}

// uint32ToBytes uint32 to bytes array
func uint32ToBytes(v uint32) []byte {
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, v)
	return buf
}

// EncodeString
func EncodeString(s string) []byte {
	lenBuf := make([]byte, 4)
	binary.BigEndian.PutUint32(lenBuf, uint32(len(s)))
	return append(lenBuf, []byte(s)...)
}

// DecodeString
func DecodeString(data []byte) (string, []byte, error) {
	if len(data) < 4 {
		return "", nil, errors.New("String data too short")
	}

	length := binary.BigEndian.Uint32(data[0:4])
	if uint32(len(data)) < 4+length {
		return "", nil, errors.New("Insufficient data")
	}

	str := string(data[4 : 4+length])
	return str, data[4+length:], nil
}