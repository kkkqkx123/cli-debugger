/**
 * Unit tests for BaseDAPClient
 *
 * BaseDAPClient is the base class for all DAP-based protocol implementations
 * (py-debug, js-debug). These tests verify the DAP protocol implementation
 * using a mocked transport layer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DebugConfig } from "../../../types/config.js";
import { APIError } from "../../errors.js";

// Mock function for transport.sendRequest
const mockSendRequest = vi.fn();

// Event callbacks storage for mock transport
const eventCallbacks = new Map<string, Array<(...args: unknown[]) => void>>();

// Mock DAPTransport
vi.mock("../transport.js", () => ({
  DAPTransport: class MockDAPTransport {
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    isConnected = vi.fn().mockReturnValue(true);
    sendRequest = mockSendRequest;
    onEvent = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!eventCallbacks.has(event)) {
        eventCallbacks.set(event, []);
      }
      eventCallbacks.get(event)!.push(callback);
    });
    offEvent = vi.fn();
  },
}));

/** Helper to dispatch a DAP event to the mock transport */
function dispatchEvent(event: string, ...args: unknown[]) {
  const cbs = eventCallbacks.get(event);
  if (cbs) {
    cbs.forEach((cb) => cb(...args));
  }
}

// Import after mocking
import { BaseDAPClient, type DAPAdapterConfig } from "../client.js";

// ==================== Test Helpers ====================

/** Create a concrete subclass of BaseDAPClient for testing */
class TestDAPClient extends BaseDAPClient {
  constructor(config: DebugConfig) {
    const adapterConfig: DAPAdapterConfig = {
      name: "test-debug",
      languages: ["test"],
      runtimeName: "test-runtime",
      protocolVersion: "1.0.0",
      launchConfig: {},
    };
    super(config, adapterConfig);
  }
}

const createConfig = (overrides?: Partial<DebugConfig>): DebugConfig => ({
  protocol: "test-debug",
  host: "127.0.0.1",
  port: 9000,
  timeout: 1000,
  ...overrides,
});

// ==================== Tests ====================

describe("BaseDAPClient", () => {
  let client: TestDAPClient;

  beforeEach(() => {
    vi.clearAllMocks();
    eventCallbacks.clear();
    client = new TestDAPClient(createConfig());

    // Default mock responses for connect flow
    mockSendRequest.mockImplementation((command: string) => {
      switch (command) {
        case "initialize":
          return Promise.resolve({
            body: {
              adapterID: "test-debug",
              supportsConditionalBreakpoints: true,
              supportsSetVariable: true,
              supportsEvaluateForHovers: true,
              supportsFunctionBreakpoints: true,
            },
          });
        case "launch":
          // Some adapters defer the launch/attach response, so dispatch
          // the initialized event immediately to unblock connect().
          setImmediate(() => dispatchEvent("initialized"));
          return Promise.resolve({});
        case "configurationDone":
          return Promise.resolve({});
        default:
          return Promise.resolve({ body: {} });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Lifecycle ====================

  describe("lifecycle", () => {
    it("should connect successfully", async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should not reconnect if already connected", async () => {
      await client.connect();
      await client.connect();
      // initialize should only be called once
      expect(mockSendRequest).toHaveBeenCalledWith("initialize", expect.any(Object));
      expect(mockSendRequest).toHaveBeenCalledTimes(3); // initialize + launch + configurationDone
    });

    it("should close connection", async () => {
      await client.connect();
      await client.close();
      expect(client.isConnected()).toBe(false);
    });

    it("should return false for isConnected before connect", () => {
      expect(client.isConnected()).toBe(false);
    });

    it("should clean up state on close", async () => {
      await client.connect();
      await client.close();
      const bps = await client.breakpoints();
      expect(bps).toEqual([]);
    });
  });

  // ==================== Metadata ====================

  describe("metadata", () => {
    it("should return protocol name", () => {
      expect(client.protocolName()).toBe("test-debug");
    });

    it("should return supported languages", () => {
      expect(client.supportedLanguages()).toEqual(["test"]);
    });

    it("should return version info", async () => {
      const version = await client.version();
      expect(version).toEqual({
        protocolVersion: "1.0.0",
        runtimeVersion: "N/A",
        runtimeName: "test-runtime",
        description: "test-debug DAP adapter",
      });
    });

    it("should return capabilities", async () => {
      const caps = await client.capabilities();
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsBreakpoints).toBe(true);
      expect(caps.supportsStep).toBe(true);
      expect(caps.supportsWatchMode).toBe(false);
    });
  });

  // ==================== Thread Management ====================

  describe("threads", () => {
    it("should return threads from DAP threads request", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: { threads: [{ id: 1, name: "main" }, { id: 2, name: "worker" }] },
      });

      const threads = await client.threads();
      expect(threads).toHaveLength(2);
      expect(threads[0]!.id).toBe("1");
      expect(threads[0]!.name).toBe("main");
    });

    it("should return empty array when no threads", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({ body: { threads: [] } });

      const threads = await client.threads();
      expect(threads).toEqual([]);
    });
  });

  describe("stack", () => {
    it("should return stack frames from DAP stackTrace", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: {
          stackFrames: [
            { id: 1, name: "main", line: 10, column: 5, source: { path: "/src/main.ts" } },
          ],
        },
      });

      const frames = await client.stack("1");
      expect(frames).toHaveLength(1);
      expect(frames[0]!.method).toBe("main");
      expect(frames[0]!.line).toBe(10);
    });
  });

  // ==================== Execution Control ====================

  describe("execution control", () => {
    beforeEach(async () => {
      await client.connect();
    });

    it("should suspend", async () => {
      mockSendRequest.mockResolvedValueOnce({ body: { threads: [{ id: 1, name: "main" }] } });
      mockSendRequest.mockResolvedValueOnce({ body: {} });
      await expect(client.suspend("1")).resolves.not.toThrow();
    });

    it("should resume", async () => {
      mockSendRequest.mockResolvedValueOnce({ body: {} });
      await expect(client.resume("1")).resolves.not.toThrow();
    });

    it("should step into", async () => {
      mockSendRequest.mockResolvedValueOnce({ body: {} });
      await expect(client.stepInto("1")).resolves.not.toThrow();
    });

    it("should step over", async () => {
      mockSendRequest.mockResolvedValueOnce({ body: {} });
      await expect(client.stepOver("1")).resolves.not.toThrow();
    });

    it("should step out", async () => {
      mockSendRequest.mockResolvedValueOnce({ body: {} });
      await expect(client.stepOut("1")).resolves.not.toThrow();
    });
  });

  // ==================== Breakpoint Scenarios ====================

  describe("setBreakpoint", () => {
    beforeEach(async () => {
      await client.connect();
    });

    it("场景: 用户在源文件第10行设置行断点 — 应调用 DAP setBreakpoints", async () => {
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 100, verified: true, line: 10 }] },
      });

      const bpId = await client.setBreakpoint("/src/main.ts:10");

      expect(bpId).toMatch(/^bp_/);
      expect(mockSendRequest).toHaveBeenCalledWith("setBreakpoints", {
        source: { path: "/src/main.ts" },
        breakpoints: [{ line: 10 }],
      });
    });

    it("场景: 用户设置函数入口断点 — 应调用 DAP setFunctionBreakpoints", async () => {
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 200 }] },
      });

      const bpId = await client.setBreakpoint("main", undefined, "method-entry");

      expect(bpId).toMatch(/^function_bp_/);
      expect(mockSendRequest).toHaveBeenCalledWith("setFunctionBreakpoints", {
        breakpoints: [{ name: "main", condition: undefined }],
      });
    });

    it("场景: 用户设置异常断点 — 应调用 DAP setExceptionBreakpoints", async () => {
      mockSendRequest.mockResolvedValueOnce({ body: {} });

      const bpId = await client.setBreakpoint("caught", undefined, "exception");

      expect(bpId).toMatch(/^exception_bp_/);
      expect(mockSendRequest).toHaveBeenCalledWith("setExceptionBreakpoints", {
        filters: ["caught"],
        exceptionOptions: [],
      });
    });
  });

  describe("enableDisableBreakpoint", () => {
    beforeEach(async () => {
      await client.connect();
    });

    it("场景: 用户启用已禁用的断点 — 应更新本地状态并重新同步到 DAP", async () => {
      // 先设置断点
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 100, verified: true, line: 10 }] },
      });
      const bpId = await client.setBreakpoint("/src/main.ts:10");

      // 禁用断点
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 101, verified: true, line: 10 }] },
      });
      await client.disableBreakpoint(bpId);

      // 重新启用
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 102, verified: true, line: 10 }] },
      });
      await client.enableBreakpoint(bpId);

      // 验证断点再次启用
      const bpInfo = await client.getBreakpointInfo(bpId);
      expect(bpInfo.enabled).toBe(true);
    });

    it("场景: 用户禁用不存在的断点 — 应抛出错误", async () => {
      await expect(client.disableBreakpoint("nonexistent")).rejects.toThrow(APIError);
    });

    it("场景: 用户启用不存在的断点 — 应抛出错误", async () => {
      await expect(client.enableBreakpoint("nonexistent")).rejects.toThrow(APIError);
    });
  });

  describe("breakpoints", () => {
    it("场景: 用户查询所有断点列表 — 应返回本地缓存的所有断点信息", async () => {
      await client.connect();

      // 设置两个断点
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 100, verified: true, line: 10 }] },
      });
      await client.setBreakpoint("/src/main.ts:10");
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 101, verified: true, line: 20 }] },
      });
      await client.setBreakpoint("/src/main.ts:20");

      const bps = await client.breakpoints();
      expect(bps).toHaveLength(2);
      expect(bps[0]!.location).toBe("/src/main.ts:10");
      expect(bps[1]!.location).toBe("/src/main.ts:20");
    });
  });

  describe("getBreakpointInfo", () => {
    it("场景: 用户查看断点扩展信息 — 应返回完整的 ExtendedBreakpointInfo", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 100, verified: true, line: 10 }] },
      });

      const bpId = await client.setBreakpoint("/src/main.ts:10");
      const info = await client.getBreakpointInfo(bpId);

      expect(info).toHaveProperty("id", bpId);
      expect(info).toHaveProperty("enabled", true);
      expect(info).toHaveProperty("location");
      expect(info).toHaveProperty("hitCount");
      expect(info).toHaveProperty("ignoreCount");
      expect(info).toHaveProperty("condition");
    });
  });

  // ==================== Variable Scenarios ====================

  describe("locals", () => {
    it("场景: 调试器停在断点处，用户查看局部变量 — 应通过 scope → variables 链获取", async () => {
      await client.connect();

      // Step 1: stackTrace 获取 frameId
      mockSendRequest.mockResolvedValueOnce({
        body: { stackFrames: [{ id: 42 }] },
      });
      // Step 2: scopes 获取变量引用
      mockSendRequest.mockResolvedValueOnce({
        body: { scopes: [{ name: "Local", variablesReference: 100 }] },
      });
      // Step 3: variables 获取变量值
      mockSendRequest.mockResolvedValueOnce({
        body: {
          variables: [
            { name: "x", value: "42", type: "number", variablesReference: 0 },
            { name: "obj", value: "{...}", type: "object", variablesReference: 101 },
          ],
        },
      });

      const vars = await client.locals("1", 0);
      expect(vars).toHaveLength(2);
      expect(vars[0]!.name).toBe("x");
      expect(vars[0]!.value).toBe(42); // parsed as number
      expect(vars[0]!.isPrimitive).toBe(true);
      expect(vars[1]!.name).toBe("obj");
      expect(vars[1]!.isPrimitive).toBe(false);
    });
  });

  describe("eval", () => {
    it("场景: 用户在调试控制台执行表达式求值 — 应先获取 frameId 再调用 evaluate", async () => {
      await client.connect();

      // Step 1: stackTrace 获取帧 ID
      mockSendRequest.mockResolvedValueOnce({
        body: { stackFrames: [{ id: 42 }] },
      });
      // Step 2: evaluate 表达式
      mockSendRequest.mockResolvedValueOnce({
        body: { result: "42", type: "number" },
      });

      const result = await client.eval("x + 1", "1", 0);
      expect(result.value).toBe("42");
      expect(result.type).toBe("number");

      // 验证 evaluate 调用包含 frameId
      expect(mockSendRequest).toHaveBeenCalledWith("evaluate", {
        expression: "x + 1",
        frameId: 42,
        context: "repl",
      });
    });
  });

  // ==================== Extended Feature Scenarios ====================

  describe("getTargetMetadata", () => {
    it("场景: 用户查询调试目标元数据 — 应包含模块数信息", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: { modules: [{ name: "mod1" }, { name: "mod2" }, { name: "mod3" }] },
      });

      const meta = await client.getTargetMetadata();

      expect(meta.executable).toBe("test-debug");
      expect(meta.numModules).toBe(3);
      expect(meta.triple).toBe("unknown");
    });

    it("场景: DAP 适配器不支持 modules 请求 — 模块数默认为 0", async () => {
      await client.connect();
      mockSendRequest.mockRejectedValueOnce(new Error("not supported"));

      const meta = await client.getTargetMetadata();
      expect(meta.numModules).toBe(0);
    });
  });

  describe("getThreadBatchInfo", () => {
    it("场景: 用户批量获取线程堆栈信息 — 应返回所有帧的 function/file/line/address/module", async () => {
      await client.connect();

      // stackTrace 返回 3 帧，含 instructionPointerReference
      mockSendRequest.mockResolvedValueOnce({
        body: {
          stackFrames: [
            { name: "main", source: { path: "/src/main.ts" }, line: 10, instructionPointerReference: "0xdeadbeef" },
            { name: "foo", source: { path: "/src/foo.ts" }, line: 20, instructionPointerReference: "0xdeadbeef" },
            { name: "bar", source: { path: "/src/bar.ts" }, line: 30 },
          ],
        },
      });
      // modules 请求
      mockSendRequest.mockResolvedValueOnce({
        body: { modules: [{ name: "mainModule" }] },
      });

      const info = await client.getThreadBatchInfo("1");

      expect(info.functions).toEqual(["main", "foo", "bar"]);
      expect(info.files).toEqual(["/src/main.ts", "/src/foo.ts", "/src/bar.ts"]);
      expect(info.lines).toEqual([10, 20, 30]);
      // 第一帧有 instructionPointerReference
      expect(info.addresses[0]).toBe(BigInt(0xdeadbeef));
      // 第三帧无 instructionPointerReference，地址为 0
      expect(info.addresses[2]).toBe(BigInt(0));
      expect(info.modules).toEqual(["mainModule"]);
    });

    it("场景: DAP 适配器不支持 modules — 模块列表为空", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: { stackFrames: [{ name: "main", source: { path: "/src/main.ts" }, line: 10 }] },
      });
      mockSendRequest.mockRejectedValueOnce(new Error("modules not supported"));

      const info = await client.getThreadBatchInfo("1");
      expect(info.modules).toEqual([]);
    });
  });

  describe("getSymbol", () => {
    it("场景: 用户不传 symbolName 查询当前函数符号 — 从 stackTrace 获取函数名", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: { stackFrames: [{ name: "MyClass.myMethod" }] },
      });

      const symbol = await client.getSymbol("1", 0);
      expect(symbol.name).toBe("MyClass.myMethod");
      expect(symbol.type).toBe("code");
    });

    it("场景: 用户传入 symbolName 查询符号 — 在帧上下文中 evaluate", async () => {
      await client.connect();

      // Step 1: stackTrace 获取 frameId
      mockSendRequest.mockResolvedValueOnce({
        body: { stackFrames: [{ id: 42, instructionPointerReference: "0xdeadbeef" }] },
      });
      // Step 2: evaluate 获取符号值
      mockSendRequest.mockResolvedValueOnce({
        body: { result: "42", type: "number" },
      });

      const symbol = await client.getSymbol("1", 0, "myVar");

      expect(symbol.name).toBe("myVar");
      expect(symbol.type).toBe("data");
      // evaluate 需包含 frameId
      expect(mockSendRequest).toHaveBeenCalledWith("evaluate", {
        expression: "myVar",
        frameId: 42,
        context: "repl",
      });
    });

    it("场景: 查询不存在的符号 — 应抛出错误", async () => {
      await client.connect();
      // stackTrace 返回有效帧，但 evaluate 失败（如符号不存在）
      mockSendRequest.mockImplementationOnce(() =>
        Promise.resolve({
          body: { stackFrames: [{ id: 42 }] },
        }),
      );
      mockSendRequest.mockRejectedValueOnce(new Error("symbol not found"));

      await expect(client.getSymbol("1", 0, "nonExistent")).rejects.toThrow(APIError);
    });
  });

  describe("getTypeInfo", () => {
    it("场景: 用户查询类型信息 — 优先使用 typeof 获取类型字符串", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: { result: "object" },
      });

      const info = await client.getTypeInfo("MyClass");

      expect(info.name).toBe("MyClass");
      expect(info.isStruct).toBe(true); // "object" → isStruct
    });

    it("场景: 用户查询类型信息并包含字段 — 通过 typeof + evaluate 获取字段", async () => {
      await client.connect();

      // Step 1: typeof 获取类型
      mockSendRequest.mockResolvedValueOnce({
        body: { result: "object" },
      });
      // Step 2: evaluate 获取 variablesReference
      mockSendRequest.mockResolvedValueOnce({
        body: { result: "{...}", type: "object", variablesReference: 100 },
      });
      // Step 3: variables 获取字段
      mockSendRequest.mockResolvedValueOnce({
        body: {
          variables: [
            { name: "x", value: "42", type: "number", variablesReference: 0 },
            { name: "y", value: "hello", type: "string", variablesReference: 0 },
          ],
        },
      });

      const info = await client.getTypeInfo("myVar", true);

      expect(info.name).toBe("myVar");
      expect(info.fields).toHaveLength(2);
      expect(info.fields[0]!.name).toBe("x");
      expect(info.fields[1]!.name).toBe("y");
    });

    it("场景: typeof 失败时回退到直接 evaluate", async () => {
      await client.connect();
      // typeof 失败
      mockSendRequest.mockRejectedValueOnce(new Error("unknown"));
      // evaluate 成功
      mockSendRequest.mockResolvedValueOnce({
        body: { result: "42", type: "number", variablesReference: 0 },
      });

      const info = await client.getTypeInfo("myVar");
      expect(info.name).toBe("myVar");
      expect(info.isPointer).toBe(false);
    });
  });

  describe("expandVariable", () => {
    it("场景: 用户展开变量的子字段 — 调用 DAP variables 请求并传递 maxChildren", async () => {
      await client.connect();
      mockSendRequest.mockResolvedValueOnce({
        body: {
          variables: [
            { name: "x", value: "42", type: "number", variablesReference: 0 },
          ],
        },
      });

      const result = await client.expandVariable("100", 1, 50);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("x");
      // 验证 count 参数被传递
      expect(mockSendRequest).toHaveBeenCalledWith("variables", {
        variablesReference: 100,
        count: 50,
      });
    });

    it("场景: 用户递归展开深层变量 — 子节点也应递归展开", async () => {
      await client.connect();

      // 第一层：有一个对象子变量
      mockSendRequest.mockResolvedValueOnce({
        body: {
          variables: [
            { name: "obj", value: "{...}", type: "object", variablesReference: 101 },
          ],
        },
      });
      // 第二层：子对象的字段
      mockSendRequest.mockResolvedValueOnce({
        body: {
          variables: [
            { name: "inner", value: "42", type: "number", variablesReference: 0 },
          ],
        },
      });

      const result = await client.expandVariable("100", 2);

      expect(result).toHaveLength(1);
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children![0]!.name).toBe("inner");
    });

    it("场景: 展开无效的 objectId — 应返回空数组", async () => {
      const result = await client.expandVariable("0", 1);
      expect(result).toEqual([]);

      const result2 = await client.expandVariable("-1", 1);
      expect(result2).toEqual([]);
    });
  });

  describe("supportsFeature", () => {
    let client: TestDAPClient;

    beforeEach(async () => {
      client = new TestDAPClient(createConfig());
      await client.connect();
    });

    it("场景: 用户检查 DAP 支持的扩展功能 — 所有 8 个 FeatureNames 都应返回 true", () => {
      expect(client.supportsFeature("eval")).toBe(true);
      expect(client.supportsFeature("enableDisableBreakpoint")).toBe(true);
      expect(client.supportsFeature("extendedBreakpointInfo")).toBe(true);
      expect(client.supportsFeature("typeInfo")).toBe(true);
      expect(client.supportsFeature("symbolInfo")).toBe(true);
      expect(client.supportsFeature("targetMetadata")).toBe(true);
      expect(client.supportsFeature("threadBatchInfo")).toBe(true);
      expect(client.supportsFeature("expandVariable")).toBe(true);
    });

    it("场景: 用户检查不存在的功能 — 应返回 false", () => {
      expect(client.supportsFeature("nonexistent")).toBe(false);
    });
  });
});