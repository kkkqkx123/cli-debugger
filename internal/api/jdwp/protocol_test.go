package jdwp

import (
	"encoding/binary"
	"testing"
)

func TestJDWPError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      JDWPError
		expected string
	}{
		{"ErrNone", ErrNone, "error-free"},
		{"ErrInvalidThread", ErrInvalidThread, "Invalid thread ID"},
		{"ErrInvalidMethodID", ErrInvalidMethodID, "Invalid Method ID"},
		{"ErrInvalidLocation", ErrInvalidLocation, "void"},
		{"ErrInvalidFieldID", ErrInvalidFieldID, "Invalid Field ID"},
		{"ErrInvalidClass", ErrInvalidClass, "void class"},
		{"ErrClassNotPrepared", ErrClassNotPrepared, "Class not ready"},
		{"ErrInvalidObject", ErrInvalidObject, "null object"},
		{"ErrInvalidFrameID", ErrInvalidFrameID, "Invalid Frame ID"},
		{"ErrOutOfMemory", ErrOutOfMemory, "lack of memory"},
		{"ErrNotImplemented", ErrNotImplemented, "unrealized"},
		{"ErrNullObject", ErrNullObject, "empty object"},
		{"ErrInvalidTag", ErrInvalidTag, "Invalid labels"},
		{"ErrAlreadyInvoking", ErrAlreadyInvoking, "Already in call"},
		{"ErrInvalidIndex", ErrInvalidIndex, "Invalid Index"},
		{"ErrInvalidLength", ErrInvalidLength, "Invalid length"},
		{"ErrInvalidString", ErrInvalidString, "Invalid String"},
		{"ErrInvalidCount", ErrInvalidCount, "invalid count"},
		{"ErrNotSuspended", ErrNotSuspended, "Thread not hung"},
		{"ErrBusy", ErrBusy, "VM is busy."},
		{"ErrThreadNotExist", ErrThreadNotExist, "Thread does not exist"},
		{"UnknownError", 999, "Unknown error (999)"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.expected {
				t.Errorf("JDWPError.Error() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestEncodeCommandPacket(t *testing.T) {
	tests := []struct {
		name        string
		id          uint32
		commandSet  byte
		command     byte
		data        []byte
		wantLength  int
	}{
		{
			name:       "Basic packet without data",
			id:         1,
			commandSet: vmCommandSet,
			command:    vmCommandVersion,
			data:       nil,
			wantLength: 11,
		},
		{
			name:       "Packet with data",
			id:         2,
			commandSet: threadCommandSet,
			command:    threadCommandName,
			data:       []byte{0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00},
			wantLength: 19,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := encodeCommandPacket(tt.id, tt.commandSet, tt.command, tt.data)

			// Check length
			if len(got) != tt.wantLength {
				t.Errorf("encodeCommandPacket() length = %v, want %v", len(got), tt.wantLength)
			}

			// Check length field (first 4 bytes, big endian)
			length := binary.BigEndian.Uint32(got[0:4])
			if length != uint32(tt.wantLength) {
				t.Errorf("encodeCommandPacket() length field = %v, want %v", length, tt.wantLength)
			}

			// Check ID (bytes 4-8, big endian)
			id := binary.BigEndian.Uint32(got[4:8])
			if id != tt.id {
				t.Errorf("encodeCommandPacket() ID = %v, want %v", id, tt.id)
			}

			// Check flag (byte 8)
			if got[8] != cmdFlag {
				t.Errorf("encodeCommandPacket() flag = %v, want %v", got[8], cmdFlag)
			}

			// Check command set (byte 9)
			if got[9] != tt.commandSet {
				t.Errorf("encodeCommandPacket() commandSet = %v, want %v", got[9], tt.commandSet)
			}

			// Check command (byte 10)
			if got[10] != tt.command {
				t.Errorf("encodeCommandPacket() command = %v, want %v", got[10], tt.command)
			}

			// Check data (bytes 11+)
			if tt.data != nil {
				if len(got) < 11 {
					t.Errorf("encodeCommandPacket() packet too short to contain data")
				}
				data := got[11:]
				for i, b := range tt.data {
					if data[i] != b {
						t.Errorf("encodeCommandPacket() data[%d] = %v, want %v", i, data[i], b)
					}
				}
			}
		})
	}
}

func TestDecodeReplyPacket(t *testing.T) {
	tests := []struct {
		name       string
		data       []byte
		wantErr    bool
		wantID     uint32
		wantFlags  byte
		wantCode   uint16
		wantMsg    string
		wantData   []byte
	}{
		{
			name:    "Packet too short",
			data:    []byte{0x00, 0x00, 0x00, 0x01, replyFlag},
			wantErr: true,
		},
		{
			name:     "Invalid flag",
			data:     []byte{0x00, 0x00, 0x00, 0x01, cmdFlag, 0x00, 0x00},
			wantErr:  true,
		},
		{
			name:      "Success packet",
			data:      []byte{0x00, 0x00, 0x00, 0x01, replyFlag, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00},
			wantErr:   false,
			wantID:    1,
			wantFlags: replyFlag,
			wantCode:  0,
		},
		{
			name:      "Error packet",
			data:      []byte{0x00, 0x00, 0x00, 0x01, replyFlag, 0x00, 0x0A, 0x00, 0x00, 0x00, 0x00},
			wantErr:   false,
			wantID:    1,
			wantFlags: replyFlag,
			wantCode:  10,
			wantMsg:   "Invalid thread ID",
		},
		{
			name:      "Packet with data",
			data:      []byte{0x00, 0x00, 0x00, 0x01, replyFlag, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04},
			wantErr:   false,
			wantID:    1,
			wantFlags: replyFlag,
			wantCode:  0,
			wantData:  []byte{0x01, 0x02, 0x03, 0x04},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := decodeReplyPacket(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("decodeReplyPacket() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil {
				return
			}

			if got.ID != tt.wantID {
				t.Errorf("decodeReplyPacket() ID = %v, want %v", got.ID, tt.wantID)
			}
			if got.Flags != tt.wantFlags {
				t.Errorf("decodeReplyPacket() Flags = %v, want %v", got.Flags, tt.wantFlags)
			}
			if got.ErrorCode != tt.wantCode {
				t.Errorf("decodeReplyPacket() ErrorCode = %v, want %v", got.ErrorCode, tt.wantCode)
			}
			if got.Message != tt.wantMsg {
				t.Errorf("decodeReplyPacket() Message = %v, want %v", got.Message, tt.wantMsg)
			}
			if tt.wantData != nil {
				for i, b := range tt.wantData {
					if got.Data[i] != b {
						t.Errorf("decodeReplyPacket() Data[%d] = %v, want %v", i, got.Data[i], b)
					}
				}
			}
		})
	}
}

func TestGetNextPacketID(t *testing.T) {
	tests := []struct {
		name  string
		setup func()
		want  uint32
	}{
		{
			name:  "First ID",
			setup: func() { packetIDCounter = 1 },
			want:  1,
		},
		{
			name:  "Second ID",
			setup: func() { packetIDCounter = 2 },
			want:  2,
		},
		{
			name:  "Wrap around",
			setup: func() { packetIDCounter = 0xFFFFFFFF },
			want:  0xFFFFFFFF,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			if got := getNextPacketID(); got != tt.want {
				t.Errorf("getNextPacketID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCreateCommandPacket(t *testing.T) {
	tests := []struct {
		name       string
		setup      func()
		commandSet byte
		command    byte
		data       []byte
		wantID     uint32
	}{
		{
			name:       "Without data",
			setup:      func() { packetIDCounter = 1 },
			commandSet: vmCommandSet,
			command:    vmCommandVersion,
			data:       nil,
			wantID:     1,
		},
		{
			name:       "With data",
			setup:      func() { packetIDCounter = 2 },
			commandSet: threadCommandSet,
			command:    threadCommandName,
			data:       []byte{0x01},
			wantID:     2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			var got []byte
			if tt.data == nil {
				got = createCommandPacket(tt.commandSet, tt.command)
			} else {
				got = createCommandPacketWithData(tt.commandSet, tt.command, tt.data)
			}

			id := binary.BigEndian.Uint32(got[4:8])
			if id != tt.wantID {
				t.Errorf("createCommandPacket() ID = %v, want %v", id, tt.wantID)
			}
		})
	}
}

func TestPacketReader_ReadByte(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected []byte
	}{
		{
			name:     "Read bytes",
			data:     []byte{0x01, 0x02, 0x03},
			expected: []byte{0x01, 0x02, 0x03},
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x01},
			expected: []byte{0x01, 0x00, 0x00},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			for _, exp := range tt.expected {
				if got := r.readByte(); got != exp {
					t.Errorf("PacketReader.readByte() = %v, want %v", got, exp)
				}
			}
		})
	}
}

func TestPacketReader_ReadInt(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected []int
	}{
		{
			name:     "Read ints",
			data:     []byte{0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02},
			expected: []int{1, 2},
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			expected: []int{1, 0},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			for _, exp := range tt.expected {
				if got := r.readInt(); got != exp {
					t.Errorf("PacketReader.readInt() = %v, want %v", got, exp)
				}
			}
		})
	}
}

func TestPacketReader_ReadUint32(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected []uint32
	}{
		{
			name:     "Read uint32s",
			data:     []byte{0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02},
			expected: []uint32{1, 2},
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			expected: []uint32{1, 0},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			for _, exp := range tt.expected {
				if got := r.readUint32(); got != exp {
					t.Errorf("PacketReader.readUint32() = %v, want %v", got, exp)
				}
			}
		})
	}
}

func TestPacketReader_ReadUint64(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected []uint64
	}{
		{
			name:     "Read uint64s",
			data:     []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02},
			expected: []uint64{1, 2},
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01},
			expected: []uint64{1, 0},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			for _, exp := range tt.expected {
				if got := r.readUint64(); got != exp {
					t.Errorf("PacketReader.readUint64() = %v, want %v", got, exp)
				}
			}
		})
	}
}

func TestPacketReader_ReadID(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		size     int
		expected string
	}{
		{
			name:     "Read 4-byte ID",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			size:     4,
			expected: "1",
		},
		{
			name:     "Read 8-byte ID",
			data:     []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01},
			size:     8,
			expected: "1",
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			size:     8,
			expected: "",
		},
		{
			name:     "Invalid size",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			size:     5,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			if got := r.readID(tt.size); got != tt.expected {
				t.Errorf("PacketReader.readID() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestPacketReader_ReadString(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected string
		wantErr  bool
	}{
		{
			name:     "Read string",
			data:     []byte{0x00, 0x00, 0x00, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F},
			expected: "hello",
		},
		{
			name:     "Read empty string",
			data:     []byte{0x00, 0x00, 0x00, 0x00},
			expected: "",
		},
		{
			name:    "Invalid length",
			data:    []byte{0xFF, 0xFF, 0xFF, 0xFF, 0x68, 0x65},
			wantErr: true,
		},
		{
			name:    "Insufficient data",
			data:    []byte{0x00, 0x00, 0x00, 0x05, 0x68, 0x65},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			got, err := r.readString()
			if (err != nil) != tt.wantErr {
				t.Errorf("PacketReader.readString() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.expected {
				t.Errorf("PacketReader.readString() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestPacketReader_ReadValue(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		tag      byte
		expected interface{}
		wantErr  bool
	}{
		{
			name:     "Read byte",
			data:     []byte{0x01},
			tag:      'B',
			expected: int8(0x01),
		},
		{
			name:     "Read char",
			data:     []byte{0x00, 0x00, 0x00, 0x41},
			tag:      'C',
			expected: rune('A'),
		},
		{
			name:     "Read int",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			tag:      'I',
			expected: 1,
		},
		{
			name:     "Read long",
			data:     []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01},
			tag:      'J',
			expected: int64(1),
		},
		{
			name:     "Read short",
			data:     []byte{0x00, 0x01},
			tag:      'S',
			expected: 1,
		},
		{
			name:     "Read boolean true",
			data:     []byte{0x01},
			tag:      'Z',
			expected: true,
		},
		{
			name:     "Read boolean false",
			data:     []byte{0x00},
			tag:      'Z',
			expected: false,
		},
		{
			name:     "Read void",
			data:     []byte{},
			tag:      'V',
			expected: nil,
		},
		{
			name:     "Read object",
			data:     []byte{0x4C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01},
			tag:      'L',
			expected: "L:1",
		},
		{
			name:     "Insufficient double data",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			tag:      'D',
			expected: 0,
			wantErr:  true,
		},
		{
			name:     "Insufficient float data",
			data:     []byte{0x00, 0x01},
			tag:      'F',
			expected: 0,
			wantErr:  true,
		},
		{
			name:     "Insufficient long data",
			data:     []byte{0x00, 0x00, 0x00, 0x01},
			tag:      'J',
			expected: 0,
			wantErr:  true,
		},
		{
			name:     "Insufficient short data",
			data:     []byte{0x00},
			tag:      'S',
			expected: 0,
			wantErr:  true,
		},
		{
			name:     "Unknown tag",
			data:     []byte{},
			tag:      'X',
			expected: "unknown(X)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			got, err := r.readValue(tt.tag)
			if (err != nil) != tt.wantErr {
				t.Errorf("PacketReader.readValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.expected {
				t.Errorf("PacketReader.readValue() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestPacketReader_ReadBytes(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected []byte
	}{
		{
			name:     "Read bytes",
			data:     []byte{0x00, 0x00, 0x00, 0x02, 0x01, 0x02},
			expected: []byte{0x01, 0x02},
		},
		{
			name:     "Read empty bytes",
			data:     []byte{0x00, 0x00, 0x00, 0x00},
			expected: []byte{},
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x00, 0x00, 0x00, 0x02, 0x01},
			expected: nil,
		},
		{
			name:     "Invalid length",
			data:     []byte{0xFF, 0xFF, 0xFF, 0xFF, 0x01},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			got := r.readBytes()
			if len(got) != len(tt.expected) {
				t.Errorf("PacketReader.readBytes() length = %v, want %v", len(got), len(tt.expected))
			}
			for i, b := range tt.expected {
				if got[i] != b {
					t.Errorf("PacketReader.readBytes()[%d] = %v, want %v", i, got[i], b)
				}
			}
		})
	}
}

func TestPacketReader_ReadInt64(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected []int64
	}{
		{
			name:     "Read int64s",
			data:     []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02},
			expected: []int64{1, 2},
		},
		{
			name:     "Read beyond data",
			data:     []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01},
			expected: []int64{1, 0},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newPacketReader(tt.data)
			for _, exp := range tt.expected {
				if got := r.readInt64(); got != exp {
					t.Errorf("PacketReader.readInt64() = %v, want %v", got, exp)
				}
			}
		})
	}
}


