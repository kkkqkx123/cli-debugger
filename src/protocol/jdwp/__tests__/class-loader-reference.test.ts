import { describe, it, expect, vi } from "vitest";
import * as codec from "../codec.js";
import * as classLoaderReference from "../class-loader-reference.js";

vi.mock("../codec.js");

describe("ClassLoaderReference", () => {
  it("should get visible classes", async () => {
    const mockExecutor: classLoaderReference.JDWPCommandExecutor = {
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
        0, 0, 0, 2, // classes count
        0x01, // typeTag
        0, 0, 0, 0, 0, 0, 0, 1, // refTypeID
        0, 0, 0, 1, // status
        0x02, // typeTag
        0, 0, 0, 0, 0, 0, 0, 2, // refTypeID
        0, 0, 0, 2, // status
      ]),
    });

    const result = await classLoaderReference.getVisibleClasses(mockExecutor, "123");

    expect(result).toEqual({
      classes: [
        {
          refTypeID: "1",
          typeTag: 0x01,
          status: 0x00000001,
        },
        {
          refTypeID: "2",
          typeTag: 0x02,
          status: 0x00000002,
        },
      ],
    });
  });
});
