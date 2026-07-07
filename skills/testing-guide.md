# 测试指南

## 测试框架

项目使用 **Vitest 4.x** 作为测试框架，配置在 `vitest.config.ts`。

## 测试层级

| 层级 | 命令 | 配置 | 说明 |
|------|------|------|------|
| 单元测试 | `npm run test:unit` | 默认 | `src/` 下的测试，无需外部依赖 |
| 集成测试 | `npm run test:integration` | `tests/integration/vitest.config.ts` | 使用 Mock JDWP Server |
| E2E 测试 | `npm run test:e2e` | `tests/e2e/vitest.config.ts` | 需要真实 JVM 环境 |
| 全量测试 | `npm test` | 默认 | 运行所有测试 |

## 测试文件位置

- 单元测试位于 `src/` 下各模块的 `__tests__/` 目录中
- 集成测试位于 `tests/integration/`
- E2E 测试位于 `tests/e2e/`

## DLV API 测试 Mock 模式（关键！）

DLV API 测试使用 `vi.fn()` 模拟 `DlvRpcClient` 的 `call` 方法。

### 正确的 Mock 返回结构

DLV RPC 的返回值总是封装在 PascalCase 字段名对象中。**测试的 mock 必须匹配源码中的解析方式。**

```typescript
// 错误 ❌：mock 返回裸数组
mockRpc.call.mockResolvedValue(frames);
// 源码中：result.Frames — 得到 undefined

// 正确 ✅：mock 返回封装对象
mockRpc.call.mockResolvedValue({ Frames: frames });
// 源码中：result.Frames — 得到 frames
```

### 各 API 的封装字段对照表

| 源码函数 | 源码中的 `rpc.call` 类型参数 | Mock 返回 |
|----------|------------------------------|-----------|
| `stacktrace()` | `{ Frames: DlvStackFrame[] }` | `{ Frames: [...] }` |
| `listLocalVars()` | `{ Variables: DlvVariable[] }` | `{ Variables: [...] }` |
| `listFunctionArgs()` | `{ Args: DlvVariable[] }` | `{ Args: [...] }` |
| `listBreakpoints()` | `{ Breakpoints: DlvBreakpoint[] }` | `{ Breakpoints: [...] }` |
| `listPackages()` | `{ Packages: string[] }` | `{ Packages: [...] }` |
| `listSources()` | `{ Sources: string[] }` | `{ Sources: [...] }` |
| `listTypes()` | `{ Types: DlvTypeInfo[] }` | `{ Types: [...] }` |
| `listLibraries()` | `{ Libraries: DlvLibrary[] }` | `{ Libraries: [...] }` |
| `getState()` | `{ State?: DlvDebuggerState }` | `{ State: {...} }` 或直接对象 |
| `getStateWithNext()` | `{ State?: DlvDebuggerState }` | `{ State: {...} }` 或直接对象 |
| `listGoroutines()` | `DlvGoroutinesResult` | `{ Goroutines: [...], Nextg: 0, GroupBy: null }` |
| `createBreakpoint()` | 直接 DlvBreakpoint | 直接返回对象，无封装 |
| `listFunctions()` | `{ Funcs: string[] }` | `{ Funcs: [...] }` 或直接 `[...]` |

### `toHaveBeenCalledWith` 参数匹配

```typescript
// getState 调用
expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.State", [{}]);  // 注意参数是 [{}] 不是 [false]
// getStateWithNext 调用
expect(mockRpc.call).toHaveBeenCalledWith("RPCServer.State", [{ Next: true }]);
```

## LLDB 测试 Mock 模式

LLDB 测试使用 `vi.fn()` 模拟 `LLDBBridge` 的 `call` 方法。

### 构造函数测试

```typescript
// 需要提供 target 字段才能通过构造函数的早期检查
const config = { protocol: "lldb", target: "/path/to/binary", host: "127.0.0.1", port: 0, timeout: 5000 };
expect(() => new LLDBClient(config)).toThrow(/Expected protocol .lldb/);
```

### eval 参数匹配

```typescript
// 注意：threadId 是 string，options 是包装对象
expect(mockBridge.call).toHaveBeenLastCalledWith("eval", {
  expression: "some_expr",
  threadId: "1",          // string，不是 number
  frameIndex: 0,
  options: {
    timeout: 5000,
    unwindOnError: undefined,
    ignoreBreakpoints: undefined,
  },
});
```

### `toHaveBeenLastCalledWith` 优先

当 `mockBridge.call` 在测试过程中被多次调用（如 `connect()` 先调用了 `call`），用 `toHaveBeenLastCalledWith` 只检查最后一次调用，而不是 `toHaveBeenCalledWith`（检查所有历史调用）。

## JDWP 事件测试

JDWP 事件测试需要构建精确的二进制 Buffer 数据。

### Breakpoint/SingleStep 事件数据

```typescript
Buffer.concat([
  Buffer.from([0x01]),      // suspendPolicy: ALL
  Buffer.from([0x00, 0x00, 0x00, 0x01]), // eventCount: 1
  Buffer.from([0x02]),      // eventKind: Breakpoint (2)
  Buffer.from([0x01]),      // resumePolicy
  Buffer.from([0x00, 0x00, 0x00, 0x01]), // requestID
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]), // threadID
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]), // location (classID)
  Buffer.from([0x00]),      // typeTag
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]), // classID
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]), // methodID
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // codeIndex
]);
```

## 集成测试超时

集成测试（特别是错误恢复测试）可能需要较长时间。使用 Vitest 的第三个参数设置超时：

```typescript
it("should handle malformed packet response", async () => {
  // ...
}, 10000);  // 10 秒超时

// beforeEach/afterEach 也支持超时
beforeEach(async () => {
  server = new MockJDWPServer();
  port = await server.start();
}, 10000);
```

## 常见测试失败原因

1. **Mock 返回结构不匹配** — 检查 `rpc.call` 的 mock 是否返回了正确的封装对象
2. **`toHaveBeenCalledWith` 参数不匹配** — 检查 RPC 调用参数是否与源码一致（`[{}]` vs `[false]`）
3. **`toHaveBeenCalledWith` 检查所有历史调用** — 如果有前置调用，改用 `toHaveBeenLastCalledWith`
4. **`??` 运算符不保留 null** — `null ?? undefined` 结果为 `undefined`，需要加 `?? null` 兜底
5. **JDWP 事件数据不完整** — Breakpoint/SingleStep 需要 typeTag + classID + methodID + codeIndex 字段
6. **LLDB eval 参数结构** — `threadId` 是 string，`options` 是包装对象