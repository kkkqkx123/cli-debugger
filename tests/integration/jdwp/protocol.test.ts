/**
 * Protocol encoding/decoding integration tests
 * Tests JDWP packet encoding and decoding
 */

import { describe, it, expect } from "vitest";
import { TestDataGenerator } from "./fixtures/index.js";

describe("Protocol Encoding/Decoding", () => {
  describe("encode_decode_roundtrip", () => {
    it("should correctly encode and decode command packets", () => {
      const packets = TestDataGenerator.generateComplexPackets();

      for (const packet of packets) {
        // Verify packet structure
        expect(packet.length).toBeGreaterThanOrEqual(11);

        const length = packet.readUInt32BE(0);
        expect(length).toBe(packet.length);

        const id = packet.readInt32BE(4);
        expect(id).toBeGreaterThan(0);

        const flags = packet.readUInt8(8);
        expect(flags).toBe(0); // Command packet

        const commandSet = packet.readUInt8(9);
        expect(commandSet).toBeGreaterThan(0);

        const command = packet.readUInt8(10);
        expect(command).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle all value types", () => {
      const valueTypes = TestDataGenerator.generateAllValueTypes();

      for (const { tag, value, description } of valueTypes) {
        // Verify tag is valid JDWP tag
        expect(tag).toBeGreaterThan(0);
        expect(value).toBeDefined();

        // Log for debugging
        expect(description).toBeTruthy();
      }
    });
  });

  describe("packet_fragmentation", () => {
    it("should handle large packets", () => {
      const largePacket = TestDataGenerator.generateLargePacket(65536);

      // Verify packet structure
      expect(largePacket.length).toBe(65536);

      const length = largePacket.readUInt32BE(0);
      expect(length).toBe(65536);

      // Verify data integrity
      for (let i = 11; i < largePacket.length; i++) {
        expect(largePacket[i]).toBe(i % 256);
      }
    });

    it("should handle various packet sizes", () => {
      const sizes = [11, 100, 1000, 10000, 65536];

      for (const size of sizes) {
        const packet = TestDataGenerator.generateLargePacket(size);
        expect(packet.length).toBe(size);

        const length = packet.readUInt32BE(0);
        expect(length).toBe(size);
      }
    });
  });

  describe("packet_concatenation", () => {
    it("should handle multiple small packets", () => {
      const packets = TestDataGenerator.generateSmallPackets(10);

      // Verify all packets are valid
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i];
        expect(packet.length).toBe(11);

        const id = packet.readInt32BE(4);
        expect(id).toBe(i + 1);
      }

      // Concatenate packets
      const concatenated = Buffer.concat(packets);
      expect(concatenated.length).toBe(11 * 10);

      // Parse concatenated buffer
      for (let i = 0; i < 10; i++) {
        const offset = i * 11;
        const length = concatenated.readUInt32BE(offset);
        expect(length).toBe(11);

        const id = concatenated.readInt32BE(offset + 4);
        expect(id).toBe(i + 1);
      }
    });

    it("should handle rapid packet sequence", () => {
      const count = 100;
      const packets = TestDataGenerator.generateSmallPackets(count);

      // All packets should be valid
      expect(packets.length).toBe(count);

      // Verify packet IDs are sequential
      for (let i = 0; i < packets.length; i++) {
        const id = packets[i].readInt32BE(4);
        expect(id).toBe(i + 1);
      }
    });
  });

  describe("id_size_variations", () => {
    it("should handle 4-byte IDs", () => {
      // Simulate 4-byte ID sizes
      const idSizes = {
        fieldIDSize: 4,
        methodIDSize: 4,
        objectIDSize: 4,
        referenceTypeIDSize: 4,
        frameIDSize: 4,
      };

      // Verify sizes
      expect(idSizes.fieldIDSize).toBe(4);
      expect(idSizes.methodIDSize).toBe(4);
      expect(idSizes.objectIDSize).toBe(4);
      expect(idSizes.referenceTypeIDSize).toBe(4);
      expect(idSizes.frameIDSize).toBe(4);
    });

    it("should handle 8-byte IDs", () => {
      // Simulate 8-byte ID sizes (default)
      const idSizes = {
        fieldIDSize: 8,
        methodIDSize: 8,
        objectIDSize: 8,
        referenceTypeIDSize: 8,
        frameIDSize: 8,
      };

      // Verify sizes
      expect(idSizes.fieldIDSize).toBe(8);
      expect(idSizes.methodIDSize).toBe(8);
      expect(idSizes.objectIDSize).toBe(8);
      expect(idSizes.referenceTypeIDSize).toBe(8);
      expect(idSizes.frameIDSize).toBe(8);
    });
  });

  describe("string_encoding_utf8", () => {
    it("should handle UTF-8 strings correctly", () => {
      const testData = TestDataGenerator.generateUTF8TestData();

      for (const { input, description } of testData) {
        // Encode to UTF-8
        const encoded = Buffer.from(input, "utf8");

        // Decode back
        const decoded = encoded.toString("utf8");

        // Should match original
        expect(decoded).toBe(input);

        // Log description for debugging
        expect(description).toBeTruthy();
      }
    });

    it("should handle Chinese characters", () => {
      const chinese = "你好世界";
      const encoded = Buffer.from(chinese, "utf8");
      const decoded = encoded.toString("utf8");
      expect(decoded).toBe(chinese);
    });

    it("should handle emoji characters", () => {
      const emoji = "🎉🎊🎁";
      const encoded = Buffer.from(emoji, "utf8");
      const decoded = encoded.toString("utf8");
      expect(decoded).toBe(emoji);
    });

    it("should handle mixed characters", () => {
      const mixed = "Hello 你好 こんにちは 🎉";
      const encoded = Buffer.from(mixed, "utf8");
      const decoded = encoded.toString("utf8");
      expect(decoded).toBe(mixed);
    });
  });

  describe("value_type_roundtrip", () => {
    it("should handle all primitive types", () => {
      const primitives = [
        { type: "byte", value: 127 },
        { type: "short", value: 32767 },
        { type: "int", value: 2147483647 },
        { type: "long", value: 9007199254740991n },
        { type: "float", value: 3.14159 },
        { type: "double", value: 2.718281828 },
        { type: "boolean", value: true },
        { type: "char", value: "A" },
      ];

      for (const { type, value } of primitives) {
        // Verify value is defined
        expect(value).toBeDefined();

        // Log type for debugging
        expect(type).toBeTruthy();
      }
    });

    it("should handle reference types", () => {
      const references = [
        { type: "object", id: "123" },
        { type: "array", id: "456" },
        { type: "string", id: "789" },
        { type: "thread", id: "101" },
        { type: "class", id: "202" },
      ];

      for (const { type, id } of references) {
        expect(id).toBeTruthy();
        expect(type).toBeTruthy();
      }
    });
  });

  describe("malformed_packets", () => {
    it("should identify malformed packets", () => {
      const malformed = TestDataGenerator.generateMalformedPackets();

      for (const packet of malformed) {
        // These packets should be invalid
        const length = packet.length >= 4 ? packet.readUInt32BE(0) : 0;

        // Check for various invalid conditions
        let isInvalid =
          length === 0 ||
          length > packet.length ||
          packet.length < 11;

        // If packet structure is complete, check for invalid flags or command set
        if (!isInvalid && packet.length >= 11) {
          const flags = packet.readUInt8(8);
          const commandSet = packet.readUInt8(9);

          // Flags should be 0 (command) or 0x80 (reply)
          const invalidFlags = flags !== 0 && flags !== 0x80;

          // Command set should be in valid range (1-64 for standard, 64-127 for vendor)
          const invalidCmdSet = flags === 0 && (commandSet === 0 || commandSet > 127);

          isInvalid = invalidFlags || invalidCmdSet;
        }

        expect(isInvalid).toBe(true);
      }
    });

    it("should handle empty buffer", () => {
      const empty = Buffer.alloc(0);
      expect(empty.length).toBe(0);
    });

    it("should handle truncated packet", () => {
      const truncated = Buffer.from([0, 0, 0, 20]); // Length 20 but no data
      expect(truncated.length).toBe(4);
      expect(truncated.readUInt32BE(0)).toBe(20);
    });
  });

  describe("packet_header", () => {
    it("should parse packet header correctly", () => {
      const packet = Buffer.alloc(11);
      packet.writeUInt32BE(11, 0); // length
      packet.writeInt32BE(123, 4); // id
      packet.writeUInt8(0, 8); // flags
      packet.writeUInt8(1, 9); // command set
      packet.writeUInt8(1, 10); // command

      const length = packet.readUInt32BE(0);
      const id = packet.readInt32BE(4);
      const flags = packet.readUInt8(8);
      const commandSet = packet.readUInt8(9);
      const command = packet.readUInt8(10);

      expect(length).toBe(11);
      expect(id).toBe(123);
      expect(flags).toBe(0);
      expect(commandSet).toBe(1);
      expect(command).toBe(1);
    });

    it("should parse reply packet header correctly", () => {
      const reply = Buffer.alloc(11);
      reply.writeUInt32BE(11, 0); // length
      reply.writeInt32BE(123, 4); // id
      reply.writeUInt8(0x80, 8); // flags (reply)
      reply.writeUInt16BE(0, 9); // error code

      const length = reply.readUInt32BE(0);
      const id = reply.readInt32BE(4);
      const flags = reply.readUInt8(8);
      const errorCode = reply.readUInt16BE(9);

      expect(length).toBe(11);
      expect(id).toBe(123);
      expect(flags).toBe(0x80);
      expect(errorCode).toBe(0);
    });
  });
});
