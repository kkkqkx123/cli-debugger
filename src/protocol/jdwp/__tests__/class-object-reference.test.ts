import { describe, it, expect, vi } from "vitest";
import * as codec from "../codec.js";
import * as classObjectReference from "../class-object-reference.js";

vi.mock("../codec.js");

describe("ClassObjectReference", () => {
  it("should get reflected type", async () => {
    const mockExecutor: classObjectReference.JDWPCommandExecutor = {
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

    const result = await classObjectReference.getReflectedType(mockExecutor, "123");

    expect(result).toBe("1");
  });
});
