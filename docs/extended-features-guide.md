# 扩展功能使用指南

本文档介绍了调试协议的扩展功能和统一接口的使用方法。

## 概述

调试器支持三种协议：JDWP (Java Debug Wire Protocol)、DLV (Go Delve) 和 LLDB (LLVM Debugger)。为了提供统一的高级功能接口，我们定义了 `ExtendedDebugProtocol` 接口，包含可选的高级功能方法。

## 扩展接口定义

### ExtendedDebugProtocol

`ExtendedDebugProtocol` 继承自 `DebugProtocol`，添加了以下可选方法：

```typescript
interface ExtendedDebugProtocol extends DebugProtocol {
  // 表达式求值
  eval?(expression: string, threadId: string, frameIndex: number, options?: EvalOptions): Promise<EvalResult>;

  // 断点控制
  enableBreakpoint?(id: string): Promise<void>;
  disableBreakpoint?(id: string): Promise<void>;
  getBreakpointInfo?(id: string): Promise<ExtendedBreakpointInfo>;

  // 类型信息
  getTypeInfo?(typeName: string, includeFields?: boolean, includeTemplateArgs?: boolean): Promise<TypeInfo>;

  // 符号查询
  getSymbol?(threadId: string, frameIndex: number, symbolName?: string, fuzzyMatch?: boolean): Promise<SymbolInfo>;

  // 目标元数据
  getTargetMetadata?(): Promise<TargetMetadata>;

  // 批量信息
  getThreadBatchInfo?(threadId: string): Promise<ThreadBatchInfo>;

  // 特征支持检查
  supportsFeature?(feature: FeatureName): boolean;
}
```

### 功能名称

```typescript
const FeatureNames = {
  Eval: "eval",
  EnableDisableBreakpoint: "enableDisableBreakpoint",
  ExtendedBreakpointInfo: "extendedBreakpointInfo",
  TypeInfo: "typeInfo",
  SymbolInfo: "symbolInfo",
  TargetMetadata: "targetMetadata",
  ThreadBatchInfo: "threadBatchInfo",
};
```

## 协议功能支持矩阵

| 功能 | LLDB | DLV | JDWP |
|------|------|-----|------|
| eval | ✅ | ✅ | ❌ |
| enableBreakpoint | ✅ | ✅ | ❌ |
| disableBreakpoint | ✅ | ✅ | ❌ |
| getBreakpointInfo | ✅ | ✅ | ✅ |
| getTypeInfo | ✅ | ❌ | ❌ |
| getSymbol | ✅ | ❌ | ❌ |
| getTargetMetadata | ✅ | ✅ | ✅ |
| getThreadBatchInfo | ✅ | ❌ | ❌ |

## 使用示例

### 1. 检查功能支持

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";
import { FeatureNames, hasFeature } from "./protocol/extended.js";

const client = new LLDBClient(config);

// 方法 1: 使用 hasFeature 函数
if (hasFeature(client, FeatureNames.Eval)) {
  const result = await client.eval("x + 5", threadId, 0);
  console.log("Result:", result.value);
}

// 方法 2: 直接调用 supportsFeature
if (client.supportsFeature(FeatureNames.Eval)) {
  const result = await client.eval("x + 5", threadId, 0);
  console.log("Result:", result.value);
}
```

### 2. 表达式求值

#### LLDB

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";

const client = new LLDBClient({
  protocol: "lldb",
  target: "./myapp",
});

await client.connect();
await client.launch();

// 简单表达式
const result = await client.eval("x + 5", threadId, 0);
console.log(result.value); // 10
console.log(result.type);  // int

// 使用动态类型
const result2 = await client.eval("obj.method()", threadId, 0, {
  useDynamicTypes: true,
});

// 跨线程求值
const result3 = await client.eval("globalVar", threadId, 0, {
  tryAllThreads: true,
});
```

#### DLV

```typescript
import { DlvClient } from "./protocol/dlv/client.js";

const client = new DlvClient({
  protocol: "dlv",
  host: "localhost",
  port: 2345,
});

await client.connect();

// 表达式求值
const result = await client.eval("x + 5", threadId, 0);
console.log(result.value);
```

### 3. 断点控制

#### LLDB

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";

const client = new LLDBClient(config);
await client.connect();

// 设置断点
const bpId = await client.setBreakpoint("main.c:42");

// 禁用断点
await client.disableBreakpoint(bpId);

// 启用断点
await client.enableBreakpoint(bpId);

// 获取断点信息
const bpInfo = await client.getBreakpointInfo(bpId);
console.log("Hit count:", bpInfo.hitCount);
console.log("Condition:", bpInfo.condition);
```

#### DLV

```typescript
import { DlvClient } from "./protocol/dlv/client.js";

const client = new DlvClient(config);
await client.connect();

// 设置断点
const bpId = await client.setBreakpoint("main.go:42");

// 禁用断点
await client.disableBreakpoint(bpId);

// 启用断点
await client.enableBreakpoint(bpId);

// 获取断点信息
const bpInfo = await client.getBreakpointInfo(bpId);
console.log("Hit count:", bpInfo.hitCount);
```

### 4. 类型信息查询

#### LLDB

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";

const client = new LLDBClient(config);
await client.connect();

// 基本类型信息
const typeInfo = await client.getTypeInfo("std::vector<int>");
console.log("Type name:", typeInfo.name);
console.log("Byte size:", typeInfo.byteSize);
console.log("Is pointer:", typeInfo.isPointer);

// 包含模板参数
const typeInfo2 = await client.getTypeInfo("MyClass<int>", false, true);
console.log("Template args:", typeInfo2.templateArgs);

// 包含字段信息
const typeInfo3 = await client.getTypeInfo("MyStruct", true, false);
console.log("Fields:", typeInfo3.fields);

// 完整信息
const typeInfo4 = await client.getTypeInfo("MyClass", true, true);
console.log("Base classes:", typeInfo4.baseClasses);
console.log("Enum values:", typeInfo4.enumValues);
```

### 5. 符号查询

#### LLDB

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";

const client = new LLDBClient(config);
await client.connect();

// 获取当前符号
const symbol = await client.getSymbol(threadId, 0);
console.log("Symbol:", symbol.name);
console.log("Address:", symbol.address);

// 按名称查询
const symbol2 = await client.getSymbol(threadId, 0, "main");
console.log("Symbol:", symbol2.name);

// 模糊匹配
const symbol3 = await client.getSymbol(threadId, 0, "get*", true);
console.log("Found:", symbol3.numMatches, "matches");
```

### 6. 目标元数据

#### LLDB

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";

const client = new LLDBClient(config);
await client.connect();

const metadata = await client.getTargetMetadata();
console.log("Executable:", metadata.executable);
console.log("Triple:", metadata.triple);
console.log("Modules:", metadata.numModules);
```

#### DLV

```typescript
import { DlvClient } from "./protocol/dlv/client.js";

const client = new DlvClient(config);
await client.connect();

const metadata = await client.getTargetMetadata();
console.log("Executable:", metadata.executable);
```

#### JDWP

```typescript
import { JDWPClient } from "./protocol/jdwp/client.js";

const client = new JDWPClient(config);
await client.connect();

const metadata = await client.getTargetMetadata();
console.log("Runtime:", metadata.executable);
console.log("Classes:", metadata.numModules);
```

### 7. 批量信息获取

#### LLDB

```typescript
import { LLDBClient } from "./protocol/lldb/client.js";

const client = new LLDBClient(config);
await client.connect();

const batchInfo = await client.getThreadBatchInfo(threadId);
console.log("Functions:", batchInfo.functions);
console.log("Files:", batchInfo.files);
console.log("Lines:", batchInfo.lines);
```

## 错误处理

### 功能不支持

```typescript
try {
  await client.eval("x + 5", threadId, 0);
} catch (error) {
  if (error.type === ErrorType.UnsupportedOperation) {
    console.log("This feature is not supported by the protocol");
  } else {
    throw error;
  }
}
```

### 检查功能支持

```typescript
if (!client.supportsFeature(FeatureNames.Eval)) {
  console.log("Expression evaluation is not supported");
  // 提供替代方案或显示错误消息
} else {
  const result = await client.eval("x + 5", threadId, 0);
}
```

## 性能优化建议

### 1. 批量操作

使用批量信息获取代替多次查询：

```typescript
// 不推荐
for (const frame of frames) {
  const info = await client.getSymbol(threadId, frame.index);
}

// 推荐
const batchInfo = await client.getThreadBatchInfo(threadId);
```

### 2. 功能检查缓存

```typescript
const hasEval = client.supportsFeature(FeatureNames.Eval);
// 在循环中使用缓存的值
if (hasEval) {
  for (const expr of expressions) {
    await client.eval(expr, threadId, 0);
  }
}
```

### 3. 错误处理

```typescript
try {
  const result = await client.eval(expression, threadId, 0);
} catch (error) {
  if (error.code === ErrorCodes.UnsupportedOperation) {
    // 功能不支持，跳过或使用替代方案
  } else if (error.code === ErrorCodes.ThreadNotSuspended) {
    // 线程未暂停，先暂停
    await client.suspend(threadId);
    const result = await client.eval(expression, threadId, 0);
  } else {
    // 其他错误
    throw error;
  }
}
```

## 协议限制

### JDWP 限制

1. **不支持表达式求值**：JDWP 不支持直接表达式求值，需要使用 `invokeStaticMethod` 或 `invokeInstanceMethod` 代替。
2. **不支持断点启用/禁用**：JDWP 使用事件请求，不支持直接启用/禁用断点，需要删除并重新创建。
3. **不支持类型信息查询**：JDWP 不支持详细的类型信息查询。
4. **不支持符号查询**：JDWP 不支持符号查询功能。

### DLV 限制

1. **不支持类型信息查询**：DLV 不支持详细的类型信息查询。
2. **不支持符号查询**：DLV 不支持符号查询功能。
3. **不支持批量信息获取**：DLV 不支持批量信息获取功能。

### LLDB 限制

LLDB 支持所有扩展功能，无明显限制。

## 最佳实践

### 1. 始终检查功能支持

```typescript
if (client.supportsFeature(FeatureNames.Eval)) {
  const result = await client.eval(expression, threadId, 0);
} else {
  console.log("Expression evaluation not supported");
}
```

### 2. 使用类型安全的方法

```typescript
import { FeatureNames } from "./protocol/extended.js";

// 使用类型安全的常量
client.supportsFeature(FeatureNames.Eval);

// 而不是字符串字面量
client.supportsFeature("eval"); // 可能拼写错误
```

### 3. 统一错误处理

```typescript
import { APIError, ErrorType, ErrorCodes } from "./protocol/errors.js";

try {
  const result = await client.eval(expression, threadId, 0);
} catch (error) {
  if (error instanceof APIError) {
    switch (error.type) {
      case ErrorType.UnsupportedOperation:
        console.log("Feature not supported");
        break;
      case ErrorType.ConnectionError:
        console.log("Connection error");
        break;
      default:
        throw error;
    }
  } else {
    throw error;
  }
}
```

### 4. 资源清理

```typescript
const client = new LLDBClient(config);
try {
  await client.connect();
  // 执行调试操作
} finally {
  await client.close();
}
```

## 测试

### 集成测试

项目包含三个协议的扩展功能集成测试：

- `tests/integration/lldb/advanced-features.test.ts` - LLDB 高级功能测试
- `tests/integration/dlv/advanced-features.test.ts` - DLV 高级功能测试
- `tests/integration/jdwp/advanced-features.test.ts` - JDWP 高级功能测试

运行测试：

```bash
npm test tests/integration/*/advanced-features.test.ts
```

### 测试覆盖

所有扩展功能都有对应的单元测试和集成测试，确保功能的正确性和可靠性。

## 参考文档

- [LLDB 高级功能指南](./lldb/advanced-features-guide.md)
- [JDWP 协议文档](./jdwp/protocol.md)
- [DLV 协议文档](./dlv/protocol.md)
- [基础 DebugProtocol 接口](../src/protocol/base.ts)
- [扩展接口定义](../src/protocol/extended.ts)

## 反馈和贡献

如果您发现任何问题或有改进建议，请通过以下方式反馈：

- GitHub Issues: https://github.com/anomalyco/opencode/issues
- 文档反馈: 在文档中直接提出修改建议