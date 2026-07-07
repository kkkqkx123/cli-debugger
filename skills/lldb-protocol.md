# LLDB 协议指南

## 概述

LLDB 协议通过 Python 桥接（`lldb_bridge.py`）与 LLDB 调试器通信。客户端使用 `LLDBBridge` 与 Python 后端交互。协议实现位于 `src/protocol/lldb/`。

## 文件结构

```
lldb/
├── index.ts         # 导出
├── client.ts        # LLDBClient - 实现 DebugProtocol + ExtendedDebugProtocol
├── bridge.ts        # LLDBBridge - Python 桥接通信
├── protocol.ts      # 协议序列化
├── types.ts         # LLDBConfig, LLDBThreadInfo, LLDBVariable 等类型
├── env.ts           # 环境配置
└── scripts/         # Python 桥接脚本
    ├── lldb_bridge.py      # 主桥接脚本
    ├── handlers/            # 各功能处理器
    │   ├── __init__.py
    │   ├── batch.py
    │   ├── breakpoint.py
    │   ├── connection.py
    │   ├── event.py
    │   ├── execution.py
    │   ├── expression.py
    │   ├── io.py
    │   ├── metadata.py
    │   ├── module.py
    │   ├── process_info.py
    │   ├── register.py
    │   ├── selection.py
    │   ├── stack.py
    │   ├── target_info.py
    │   ├── thread.py
    │   ├── type.py
    │   └── variable.py
    └── utils/
        ├── __init__.py
        ├── converters.py
        └── errors.py
```

## LLDBBridge 通信模式

`LLDBBridge` 通过子进程与 Python 脚本通信：

```typescript
const result = await this.bridge.call<T>("methodName", params);
```

## eval 关键参数结构（易错点）

LLDBClient 的 `eval` 方法调用桥接方式如下（`client.ts:758-782`）：

```typescript
async eval(
  expression: string,
  threadId: string,
  frameIndex: number,
  options?: EvalOptions,
): Promise<EvalResult> {
  const lldbOptions: LLDBEvalOptions = {
    timeout: options?.timeout,
    unwindOnError: options?.unwindOnError,
    ignoreBreakpoints: options?.ignoreBreakpoints,
  };

  const result = await this.bridge.call<{ value: unknown; type: string; error?: string }>("eval", {
    expression,
    threadId,       // ⚠️ string 类型，不是 number
    frameIndex,
    options: lldbOptions,  // ⚠️ 包装在 options 对象中
  });

  return {
    value: result.value,
    type: result.type,
    error: result.error,
  };
}
```

### 测试中的对应 mock 结构

```typescript
// 正确
expect(mockBridge.call).toHaveBeenLastCalledWith("eval", {
  expression: "some_expr",
  threadId: "1",               // string!
  frameIndex: 0,
  options: {                   // 包装对象
    timeout: 5000,
    unwindOnError: undefined,
    ignoreBreakpoints: undefined,
  },
});
```

## LLDB 配置

`LLDBClient` 需要额外的配置字段：

```typescript
interface LLDBConfig {
  protocol: "lldb";
  target: string;       // 必填 - 目标可执行文件路径
  coreFile?: string;    // 核心转储文件
  pythonPath?: string;  // Python 路径
  attachPid?: number;   // 附加到进程 PID
  waitFor?: boolean;    // 等待进程启动
  timeout: number;
  launchArgs?: string[];
  env?: Record<string, string>;
  workingDir?: string;
  stopAtEntry?: boolean;
}
```

### 构造函数验证顺序

```typescript
constructor(config: DebugConfig) {
  // 1. 先检查 extraConfig["target"] — 没有 target 抛 "LLDB requires 'target' configuration"
  // 2. 再验证 DebugConfigSchema
  // 3. 在 validateLLDBConfig 中检查 protocol === "lldb"
  // 4. 再次检查 target
}
```

测试构造函数错误时需要注意：
- 没有 `target` 会先抛出 "LLDB requires 'target' configuration"
- 有 `target` 但 protocol 错误会抛出 "Expected protocol 'lldb'"

## 方法映射

| LLDBClient 方法 | bridge.call 方法 | 备注 |
|-----------------|------------------|------|
| connect() | "connect" + "launch" | 先启动桥接，再连接目标 |
| close() | - | 停止桥接 |
| threads() | "threads" | 返回 LLDBThreadInfo[] |
| stack() | "stack" | threadId 转为 number |
| locals() | "locals" | threadId 转为 number |
| setBreakpoint() | "setBreakpoint" | 支持 location/address/regex |
| eval() | "eval" | 核心 — 注意参数结构 |
| registers() | "registers" | 扩展方法 |
| getTypeInfo() | "getTypeInfo" | 完整类型信息 |

## supportedLanguages

```typescript
supportedLanguages(): string[] {
  return ["c", "cpp", "objc", "swift", "rust"];
}
```

## 扩展功能

LLDB 是功能最完整的协议实现，支持所有 ExtendedDebugProtocol 功能：

- `eval` ✅
- `enableBreakpoint`/`disableBreakpoint` ✅
- `getBreakpointInfo` ✅
- `getTypeInfo` ✅（含 fields, templateArgs, enumValues）
- `getSymbol` ✅
- `getTargetMetadata` ✅
- `getThreadBatchInfo` ✅

## 测试注意事项

- 单元测试使用 `vi.fn()` mock `LLDBBridge`
- `bridge.call` 的 mock 需要匹配实际调用参数
- 构造函数测试需要提供 `target` 字段避免早期失败
- `toHaveBeenLastCalledWith` 优先于 `toHaveBeenCalledWith`（避免历史调用干扰）