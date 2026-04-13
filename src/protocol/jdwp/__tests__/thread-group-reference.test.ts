import { describe, it, expect, vi } from "vitest";
import * as codec from "../codec.js";
import * as threadGroupReference from "../thread-group-reference.js";

vi.mock("../codec.js");

describe("ThreadGroupReference", () => {
  it("should get thread group name", async () => {
    const mockExecutor: threadGroupReference.JDWPCommandExecutor = {
      sendPacket: vi.fn(),
      readReply: vi.fn(),
      idSizes: {
        fieldIDSize: 8,
        methodIDSize: 8,
        objectIDSize: 8,
        referenceTypeIDSize: 8,
        frameIDSize: 8,
      },
    };

    vi.spyOn(codec, "createCommandPacketWithData").mockReturnValue(
      Buffer.from([]),
    );
    vi.spyOn(mockExecutor, "readReply").mockResolvedValue({
      errorCode: 0,
      message: "",
      data: Buffer.from([0, 0, 0, 5, 0x6d, 0x61, 0x69, 0x6e, 0x30]),
    });

    const result = await threadGroupReference.getThreadGroupName(mockExecutor, "123");

    expect(result).toBe("main0");
  });

  it("should get parent thread group", async () => {
    const mockExecutor: threadGroupReference.JDWPCommandExecutor = {
      sendPacket: vi.fn(),
      readReply: vi.fn(),
      idSizes: {
        fieldIDSize: 8,
        methodIDSize: 8,
        objectIDSize: 8,
        referenceTypeIDSize: 8,
        frameIDSize: 8,
      },
    };

    vi.spyOn(codec, "createCommandPacketWithData").mockReturnValue(
      Buffer.from([]),
    );
    vi.spyOn(mockExecutor, "readReply").mockResolvedValue({
      errorCode: 0,
      message: "",
      data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
    });

    const result = await threadGroupReference.getParentThreadGroup(mockExecutor, "123");

    expect(result).toBe("2");
  });

  it("should get thread group children", async () => {
    const mockExecutor: threadGroupReference.JDWPCommandExecutor = {
      sendPacket: vi.fn(),
      readReply: vi.fn(),
      idSizes: {
        fieldIDSize: 8,
        methodIDSize: 8,
        objectIDSize: 8,
        referenceTypeIDSize: 8,
        frameIDSize: 8,
      },
    };

    vi.spyOn(codec, "createCommandPacketWithData").mockReturnValue(
      Buffer.from([]),
    );
    vi.spyOn(mockExecutor, "readReply").mockResolvedValue({
      errorCode: 0,
      message: "",
      data: Buffer.from([
        0, 0, 0, 2, // child groups count
        0, 0, 0, 0, 0, 0, 0, 3, // child group 1
        0, 0, 0, 0, 0, 0, 0, 4, // child group 2
        0, 0, 0, 2, // child threads count
        0, 0, 0, 0, 0, 0, 0, 5, // child thread 1
        0, 0, 0, 0, 0, 0, 0, 6, // child thread 2
      ]),
    });

    const result = await threadGroupReference.getThreadGroupChildren(mockExecutor, "123");

    expect(result).toEqual({
      childGroups: ["3", "4"],
      childThreads: ["5", "6"],
    });
  });
});
