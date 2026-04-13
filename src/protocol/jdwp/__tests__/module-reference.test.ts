import { describe, it, expect, vi } from "vitest";
import * as codec from "../codec.js";
import * as moduleReference from "../module-reference.js";

vi.mock("../codec.js");

describe("ModuleReference", () => {
  it("should get module name", async () => {
    const mockExecutor: moduleReference.JDWPCommandExecutor = {
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
      data: Buffer.from([0, 0, 0, 6, 0x6d, 0x6f, 0x64, 0x75, 0x6c, 0x65]),
    });

    const result = await moduleReference.getModuleName(mockExecutor, "123");

    expect(result).toBe("module");
  });

  it("should get module class loader", async () => {
    const mockExecutor: moduleReference.JDWPCommandExecutor = {
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
      data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
    });

    const result = await moduleReference.getModuleClassLoader(mockExecutor, "123");

    expect(result).toBe("1");
  });
});
