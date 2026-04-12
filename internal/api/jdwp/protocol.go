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
	// Reply Packet Flag
	replyFlag byte = 0x80

	// Command Sets (from JDWP spec)
	// VirtualMachine Command Set
	vmCommandSet byte = 1
	// ReferenceType Command Set
	referenceTypeCommandSet byte = 2
	// ClassType Command Set
	classTypeCommandSet byte = 3
	// ArrayType Command Set
	arrayTypeCommandSet byte = 4
	// Method Command Set
	methodCommandSet byte = 5
	// Field Command Set
	fieldCommandSet byte = 6
	// ObjectReference Command Set
	objectReferenceCommandSet byte = 7
	// StringReference Command Set
	stringReferenceCommandSet byte = 8
	// ThreadReference Command Set
	threadCommandSet byte = 10
	// ThreadGroupReference Command Set
	threadGroupCommandSet byte = 11
	// ArrayReference Command Set
	arrayReferenceCommandSet byte = 12
	// ClassLoaderReference Command Set
	classLoaderCommandSet byte = 13
	// EventRequest Command Set
	eventRequestCommandSet byte = 14
	// StackFrame Command Set
	stackFrameCommandSet byte = 15
	// ClassObjectReference Command Set
	classObjectCommandSet byte = 16
	// Event Command Set (VM to debugger)
	eventCommandSet byte = 64

	// VM Commands (VirtualMachine Command Set = 1)
	vmCommandVersion    byte = 1
	vmCommandClassesBySignature byte = 2
	vmCommandAllClasses byte = 3
	vmCommandAllThreads byte = 4
	vmCommandTopLevelThreadGroups byte = 5
	vmCommandDispose    byte = 6
	vmCommandIDSizes    byte = 7
	vmCommandSuspend    byte = 8
	vmCommandResume     byte = 9
	vmCommandExit       byte = 10
	vmCommandCreateString byte = 11
	vmCommandCapabilities byte = 12
	vmCommandClassPaths byte = 13
	vmCommandHoldEvents byte = 15
	vmCommandReleaseEvents byte = 16
	vmCommandRedefineClasses byte = 18
	vmCommandSetDefaultStratum byte = 19
	vmCommandAllClassesWithGeneric byte = 20

	// ThreadReference Commands (Command Set = 10)
	threadCommandName byte = 1
	threadCommandSuspend byte = 2
	threadCommandResume byte = 3
	threadCommandStatus byte = 4
	threadCommandThreadGroup byte = 5
	threadCommandFrames byte = 6
	threadCommandFrameCount byte = 7
	threadCommandOwnedMonitors byte = 8
	threadCommandCurrentContendedMonitor byte = 9
	threadCommandStop byte = 10
	threadCommandInterrupt byte = 11
	threadCommandSuspendCount byte = 12

	// StackFrame Commands (Command Set = 15)
	stackFrameCommandGetValues byte = 1
	stackFrameCommandSetValues byte = 2
	stackFrameCommandThisObject byte = 3
	stackFrameCommandPopFrames byte = 4

	// EventRequest Commands (Command Set = 14)
	eventRequestCommand byte = 1
	eventRequestCommandClear byte = 2
	eventRequestCommandClearAllBreakpoints byte = 3

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

// JDWPError JDWP Error Code (from JDWP spec)
type JDWPError uint16

const (
	ErrNone                JDWPError = 0
	ErrInvalidThread       JDWPError = 10
	ErrInvalidMethodID     JDWPError = 13
	ErrInvalidLocation     JDWPError = 20
	ErrInvalidFieldID      JDWPError = 21
	ErrInvalidClass        JDWPError = 22
	ErrClassNotPrepared    JDWPError = 23
	ErrInvalidObject       JDWPError = 24
	ErrInvalidFrameID      JDWPError = 25
	ErrOutOfMemory         JDWPError = 112
	ErrNotImplemented      JDWPError = 99
	ErrNullObject          JDWPError = 101
	ErrInvalidTag          JDWPError = 102
	ErrAlreadyInvoking     JDWPError = 103
	ErrInvalidIndex        JDWPError = 104
	ErrInvalidLength       JDWPError = 105
	ErrInvalidString       JDWPError = 106
	ErrInvalidClassLoader  JDWPError = 107
	ErrInvalidArray        JDWPError = 108
	ErrTransportLoad       JDWPError = 109
	ErrTransportStart      JDWPError = 110
	ErrNativeMethod        JDWPError = 111
	ErrInvalidCount        JDWPError = 113
	ErrInvalidMonitor      JDWPError = 50
	ErrNotSuspended        JDWPError = 51
	ErrInvalidTypestate    JDWPError = 52
	ErrHierarchyChange     JDWPError = 53
	ErrDeletedMethod       JDWPError = 54
	ErrInvalidSlot         JDWPError = 55
	ErrDuplicate           JDWPError = 56
	ErrBusy                JDWPError = 11
	ErrThreadNotExist      JDWPError = 12
)

var errorMessages = map[JDWPError]string{
	ErrNone:               "successes",
	ErrInvalidThread:      "Invalid thread ID",
	ErrInvalidMethodID:    "Invalid Method ID",
	ErrInvalidLocation:    "void",
	ErrInvalidFieldID:     "Invalid Field ID",
	ErrInvalidClass:       "void class",
	ErrClassNotPrepared:   "Class not ready",
	ErrInvalidObject:      "null object",
	ErrInvalidFrameID:     "Invalid Frame ID",
	ErrOutOfMemory:        "lack of memory",
	ErrNotImplemented:     "unrealized",
	ErrNullObject:         "empty object",
	ErrInvalidTag:         "Invalid labels",
	ErrAlreadyInvoking:    "Already in call",
	ErrInvalidIndex:       "Invalid Index",
	ErrInvalidLength:      "Invalid length",
	ErrInvalidString:      "Invalid String",
	ErrInvalidCount:       "invalid count",
	ErrNotSuspended:       "Thread not hung",
	ErrBusy:               "VM is busy.",
	ErrThreadNotExist:     "Thread does not exist",
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

func (r *PacketReader) readUint64() uint64 {
	if r.pos+8 > len(r.data) {
		return 0
	}
	val := binary.BigEndian.Uint64(r.data[r.pos : r.pos+8])
	r.pos += 8
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