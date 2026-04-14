/**
 * Test data generator for JDWP integration tests
 * Provides test data for various JDWP value types and packet scenarios
 */

/**
 * JDWP value type test data
 */
export interface ValueTypeTestData {
  tag: number;
  value: unknown;
  description: string;
}

/**
 * Test data generator
 */
export const TestDataGenerator = {
  /**
   * Generate all JDWP value types for testing
   */
  generateAllValueTypes(): ValueTypeTestData[] {
    return [
      { tag: 0x42, value: 127, description: "byte" },
      { tag: 0x43, value: 0x4e2d, description: "char (中)" },
      { tag: 0x44, value: 3.14159, description: "double" },
      { tag: 0x46, value: 2.718, description: "float" },
      { tag: 0x49, value: 123456, description: "int" },
      { tag: 0x4a, value: 9007199254740991n, description: "long" },
      { tag: 0x53, value: 32767, description: "short" },
      { tag: 0x5a, value: true, description: "boolean true" },
      { tag: 0x5a, value: false, description: "boolean false" },
      { tag: 0x4c, value: "123", description: "object reference" },
      { tag: 0x5b, value: "456", description: "array reference" },
      { tag: 0x73, value: "test string", description: "string reference" },
      { tag: 0x74, value: "789", description: "thread reference" },
      { tag: 0x67, value: "101", description: "thread group reference" },
      { tag: 0x6c, value: "202", description: "class loader reference" },
      { tag: 0x63, value: "303", description: "class object reference" },
    ];
  },

  /**
   * Generate complex packet data for testing
   */
  generateComplexPackets(): Buffer[] {
    const packets: Buffer[] = [];

    // Packet 1: Version command
    const versionCmd = Buffer.alloc(11);
    versionCmd.writeUInt32BE(11, 0); // length
    versionCmd.writeInt32BE(1, 4); // id
    versionCmd.writeUInt8(0, 8); // flags (command)
    versionCmd.writeUInt8(1, 9); // command set (VirtualMachine)
    versionCmd.writeUInt8(1, 10); // command (Version)
    packets.push(versionCmd);

    // Packet 2: IDSizes command
    const idSizesCmd = Buffer.alloc(11);
    idSizesCmd.writeUInt32BE(11, 0);
    idSizesCmd.writeInt32BE(2, 4);
    idSizesCmd.writeUInt8(0, 8);
    idSizesCmd.writeUInt8(1, 9);
    idSizesCmd.writeUInt8(10, 10); // IDSizes
    packets.push(idSizesCmd);

    // Packet 3: AllThreads command
    const threadsCmd = Buffer.alloc(11);
    threadsCmd.writeUInt32BE(11, 0);
    threadsCmd.writeInt32BE(3, 4);
    threadsCmd.writeUInt8(0, 8);
    threadsCmd.writeUInt8(1, 9);
    threadsCmd.writeUInt8(4, 10); // AllThreads
    packets.push(threadsCmd);

    return packets;
  },

  /**
   * Generate malformed packets for error testing
   */
  generateMalformedPackets(): Buffer[] {
    const packets: Buffer[] = [];

    // Packet 1: Too short (missing data)
    packets.push(Buffer.from([0, 0, 0, 5])); // length=5 but no data

    // Packet 2: Invalid length
    packets.push(Buffer.from([0, 0, 0, 0])); // length=0

    // Packet 3: Invalid flags
    const invalidFlags = Buffer.alloc(11);
    invalidFlags.writeUInt32BE(11, 0);
    invalidFlags.writeInt32BE(1, 4);
    invalidFlags.writeUInt8(0xff, 8); // invalid flags
    invalidFlags.writeUInt8(1, 9);
    invalidFlags.writeUInt8(1, 10);
    packets.push(invalidFlags);

    // Packet 4: Invalid command set
    const invalidCmdSet = Buffer.alloc(11);
    invalidCmdSet.writeUInt32BE(11, 0);
    invalidCmdSet.writeInt32BE(1, 4);
    invalidCmdSet.writeUInt8(0, 8);
    invalidCmdSet.writeUInt8(255, 9); // invalid command set
    invalidCmdSet.writeUInt8(1, 10);
    packets.push(invalidCmdSet);

    return packets;
  },

  /**
   * Generate large packet for fragmentation testing
   */
  generateLargePacket(size: number = 65536): Buffer {
    const packet = Buffer.alloc(size);
    packet.writeUInt32BE(size, 0); // length
    packet.writeInt32BE(1, 4); // id
    packet.writeUInt8(0, 8); // flags
    packet.writeUInt8(1, 9); // command set
    packet.writeUInt8(1, 10); // command
    // Fill rest with data
    for (let i = 11; i < size; i++) {
      packet[i] = i % 256;
    }
    return packet;
  },

  /**
   * Generate multiple small packets for concatenation testing
   */
  generateSmallPackets(count: number = 10): Buffer[] {
    const packets: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      const packet = Buffer.alloc(11);
      packet.writeUInt32BE(11, 0);
      packet.writeInt32BE(i + 1, 4);
      packet.writeUInt8(0, 8);
      packet.writeUInt8(1, 9);
      packet.writeUInt8(1, 10);
      packets.push(packet);
    }
    return packets;
  },

  /**
   * Generate UTF-8 string test data
   */
  generateUTF8TestData(): Array<{ input: string; description: string }> {
    return [
      { input: "Hello World", description: "ASCII string" },
      { input: "你好世界", description: "Chinese characters" },
      { input: "こんにちは", description: "Japanese characters" },
      { input: "🎉🎊🎁", description: "Emoji characters" },
      { input: "Mixed: Hello 你好 こんにちは", description: "Mixed characters" },
      { input: "", description: "Empty string" },
      { input: " ", description: "Whitespace only" },
      { input: "\n\t\r", description: "Control characters" },
    ];
  },

  /**
   * Generate thread state test data
   */
  generateThreadStates(): Array<{ status: number; expected: string }> {
    return [
      { status: 1, expected: "zombie" },
      { status: 2, expected: "running" },
      { status: 3, expected: "sleeping" },
      { status: 4, expected: "waiting-for-monitor" },
      { status: 5, expected: "waiting" },
      { status: 6, expected: "not-started" },
      { status: 7, expected: "started" },
    ];
  },

  /**
   * Generate breakpoint test data
   */
  generateBreakpointTestData(): Array<{
    location: string;
    className: string;
    methodName: string;
    lineNumber: number;
  }> {
    return [
      {
        location: "com.example.Test.main:10",
        className: "com.example.Test",
        methodName: "main",
        lineNumber: 10,
      },
      {
        location: "MyClass.myMethod:42",
        className: "MyClass",
        methodName: "myMethod",
        lineNumber: 42,
      },
      {
        location: "java.lang.String.valueOf:100",
        className: "java.lang.String",
        methodName: "valueOf",
        lineNumber: 100,
      },
    ];
  },

  /**
   * Generate mock thread info
   */
  generateMockThreads(count: number = 3): Array<{
    id: string;
    name: string;
    status: number;
    suspendStatus: number;
  }> {
    const threads = [];
    for (let i = 1; i <= count; i++) {
      threads.push({
        id: `${i}`,
        name: i === 1 ? "main" : `Thread-${i}`,
        status: i === 1 ? 2 : 4, // main is running, others are waiting
        suspendStatus: 0,
      });
    }
    return threads;
  },

  /**
   * Generate mock class info
   */
  generateMockClasses(): Map<string, { refID: string; methods: string[] }> {
    const classes = new Map();
    classes.set("com.example.Test", {
      refID: "1001",
      methods: ["main", "test", "helper"],
    });
    classes.set("java.lang.String", {
      refID: "1002",
      methods: ["valueOf", "toString", "length"],
    });
    classes.set("MyClass", {
      refID: "1003",
      methods: ["myMethod", "anotherMethod"],
    });
    return classes;
  },
};
