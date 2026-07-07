# 常见模式与陷阱

## 1. DLV RPC 返回封装模式

**这是整个项目中最容易出错的地方。**

所有 DLV RPC 调用都通过 `rpc.call<T>(method, params)` 执行，返回值的结构取决于 `T` 类型参数。

**源码模式：**
```typescript
// 源码中总是从 result.X 解包
const result = await rpc.call<{ Frames: DlvStackFrame[] }>("RPCServer.Stacktrace", [params]);
return result.Frames;
```

**测试中的对应 mock：**
```typescript
// ✅ 正确：mock 返回封装对象
mockRpc.call.mockResolvedValue({ Frames: frames });

// ❌ 错误：mock 返回裸数组
mockRpc.call.mockResolvedValue(frames);
// 源码中 result.Frames 将是 undefined
```

**完整映射表：**

| 源码函数 | 类型参数 | Mock 返回 |
|----------|----------|-----------|
| stacktrace/stacktraceGoroutine/... | `{ Frames: ... }` | `{ Frames: [...] }` |
| listLocalVars | `{ Variables: ... }` | `{ Variables: [...] }` |
| listFunctionArgs | `{ Args: ... }` | `{ Args: [...] }` |
| listBreakpoints | `{ Breakpoints: ... }` | `{ Breakpoints: [...] }` |
| getState | `{ State?: ... }` | `{ State: {...} }` |
| listPackages | `{ Packages: ... }` | `{ Packages: [...] }` |
| listSources | `{ Sources: ... }` | `{ Sources: [...] }` |
| listTypes | `{ Types: ... }` | `{ Types: [...] }` |
| listLibraries | `{ Libraries: ... }` | `{ Libraries: [...] }` |
| listGoroutines | `DlvGoroutinesResult` | `{ Goroutines: [...], Nextg: 0, GroupBy: null }` |

## 2. `??`（nullish coalescing）运算符陷阱

```typescript
// 错误：null ?? undefined 结果是 undefined，不是 null
result["GroupBy"] ?? result["groupBy"]
// 结果：GroupBy = null → null ?? undefined → undefined ❌

// 正确：需要加 ?? null 兜底
result["GroupBy"] ?? result["groupBy"] ?? null
// 结果：GroupBy = null → null ?? undefined → undefined ?? null → null ✅
```

适用场景：当 DLV 返回的字段可能是 `null`，而代码需要保留 `null` 值时。

## 3. LLDB eval 参数结构

`LLDBClient.eval()` 的桥接调用参数结构有特殊要求：

```typescript
await this.bridge.call("eval", {
  expression,         // string
  threadId,           // ⚠️ string 类型（不是 number）
  frameIndex,         // number
  options: {          // ⚠️ 包装在 options 对象中
    timeout,          // number | undefined
    unwindOnError,    // boolean | undefined
    ignoreBreakpoints, // boolean | undefined
  },
});
```

## 4. `toHaveBeenCalledWith` vs `toHaveBeenLastCalledWith`

```typescript
// toHaveBeenCalledWith — 检查所有历史调用是否包含该匹配
// 如果 bridge.call 之前被 connect() 等其他方法调用过，会失败

// toHaveBeenLastCalledWith — 只检查最后一次调用
// 更安全，推荐在 LLDB 测试中使用
expect(mockBridge.call).toHaveBeenLastCalledWith("eval", { ... });
```

## 5. RPCServer.State 的参数

```typescript
// getState 的调用参数
getState: rpc.call("RPCServer.State", [{}])           // ✅ 参数是 [{}]
getStateWithNext: rpc.call("RPCServer.State", [{ Next: true }])  // ✅ 参数是 [{ Next: true }]

// 错误写法
getState: rpc.call("RPCServer.State", [false])        // ❌ 参数不是 [false]
```

## 6. LLDB 构造函数验证顺序

```typescript
constructor(config: DebugConfig) {
  // 第 1 步：检查 extraConfig["target"]
  //   如果没有 target → 抛出 "LLDB requires 'target' configuration"
  // 第 2 步：验证 DebugConfigSchema
  // 第 3 步：validateLLDBConfig — 检查 protocol === "lldb"
  //   如果 protocol 不匹配 → 抛出 "Expected protocol 'lldb'"
  // 第 4 步：再次检查 target
}
```

测试时需要根据验证顺序设计测试用例：
- 测试协议错误前，先提供 `target` 字段
- 否则测试在第一步就失败了，不会到达协议检查

## 7. JDWP 事件数据完整性

Breakpoint 和 SingleStep 事件需要完整的字段才能被 `parseEvent` 正确解析：

```
事件结构（38 字节）：
  suspendPolicy(1B) + eventCount(4B) + eventKind(1B) + resumePolicy(1B) +
  requestID(4B) + threadID(8B) + location(8B) + typeTag(1B) +
  classID(8B) + methodID(8B) + codeIndex(8B)
```

缺少 `typeTag`、`classID`、`methodID`、`codeIndex` 中的任一字段会导致解析失败。

## 8. Vitest 超时设置

Vitest 的 `it`, `beforeEach`, `afterEach` 都支持第三个参数设置超时（毫秒）：

```typescript
it("test name", async () => { ... }, 10000);
beforeEach(async () => { ... }, 10000);
```

集成测试和错误恢复测试需要较长的超时时间。

## 9. 协议注册与自动发现

在 `src/protocol/index.ts` 中自动注册：

```typescript
registerProtocol("jdwp", (config) => new JDWPClient(config));
registerProtocol("dlv", (config) => new DlvClient(config));
registerProtocol("lldb", (config) => new LLDBClient(config));
registerProtocol("debugpy", (config) => new DebugPyClient(config));
registerProtocol("js-debug", (config) => new JsDebugClient(config));
```

添加新协议需要在三处修改：
1. 创建协议实现文件（实现 `DebugProtocol` 接口）
2. 在 `src/protocol/index.ts` 中导出并注册
3. 在 `src/cli/index.ts` 的 `detectProtocol()` 中添加扩展名映射（可选）

## 10. DebugConfig 验证

`DebugConfig` 使用 Zod 运行时验证，默认值：

```typescript
const DebugConfigSchema = z.object({
  protocol: z.string().min(1).default("jdwp"),
  host: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().positive().default(5005),
  timeout: z.number().int().positive().default(30000),
});
```

协议特定的额外配置（如 `target`、`attachPid`）通过 `extraConfig` 从 `Record<string, unknown>` 中提取，不走 Zod 验证。