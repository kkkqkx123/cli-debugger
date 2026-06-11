# LLDB 高级功能使用指南

## 概述

本文档详细说明了 LLDB 调试器的高级功能使用方法，包括线程级控制、表达式求值选项、类型系统增强、符号查询等功能。

---

## 1. 线程级控制

### 1.1 线程级挂起

允许单独挂起某个线程，而不影响其他线程的执行。

```typescript
import { LLDBClient } from 'cli-debugger';

const client = new LLDBClient({
  protocol: 'lldb',
  target: '/path/to/executable',
  timeout: 10000
});

await client.connect();

// 挂起指定线程
await client.suspend('12345'); // 12345 是线程 ID

// 挂起所有线程（进程级）
await client.suspend();
```

### 1.2 线程级恢复

允许单独恢复某个线程的执行。

```typescript
// 恢复指定线程
await client.resume('12345'); // 12345 是线程 ID

// 恢复所有线程（进程级）
await client.resume();
```

**使用场景**：
- 调试多线程竞态条件
- 控制特定线程的执行顺序
- 观察其他线程的状态

---

## 2. 表达式求值选项

### 2.1 基本用法

```typescript
const result = await client.eval(
  'x + y',
  '12345', // 线程 ID
  0        // 帧索引
);
```

### 2.2 动态类型解析

控制是否使用动态类型信息来求值表达式。

```typescript
const result = await client.eval(
  'obj.method()',
  '12345',
  0,
  {
    useDynamicTypes: true // 使用动态类型信息
  }
);
```

**说明**：
- `useDynamicTypes: true` - 使用运行时类型信息求值
- `useDynamicTypes: false` - 使用静态类型信息求值

**使用场景**：
- 处理多态对象
- 调试模板类
- 处理动态类型语言（如 Objective-C）

### 2.3 跨线程求值

当表达式在当前线程求值失败时，自动尝试在其他线程中求值。

```typescript
const result = await client.eval(
  'globalVariable',
  '12345',
  0,
  {
    tryAllThreads: true // 在所有线程中尝试求值
  }
);
```

**说明**：
- `tryAllThreads: true` - 在当前线程求值失败时，自动尝试其他线程
- `tryAllThreads: false` - 只在指定线程中求值

**使用场景**：
- 调试跨线程变量访问
- 查找全局变量或静态变量
- 处理线程间共享数据

### 2.4 完整选项示例

```typescript
const result = await client.eval(
  'expression',
  '12345',
  0,
  {
    timeout: 5000,              // 超时时间（毫秒）
    unwindOnError: true,        // 错误时展开调用栈
    ignoreBreakpoints: false,   // 是否忽略断点
    useDynamicTypes: true,      // 使用动态类型
    tryAllThreads: true         // 跨线程求值
  }
);
```

---

## 3. 类型系统增强

### 3.1 基本类型查询

```typescript
const typeInfo = await client.getTypeInfo({
  typeName: 'std::string',
});

console.log(typeInfo.name);        // "std::string"
console.log(typeInfo.byteSize);    // 24
console.log(typeInfo.isClass);     // true
console.log(typeInfo.numChildren); // 0
```

### 3.2 从变量获取类型

```typescript
const typeInfo = await client.getTypeInfo({
  varName: 'myString',
  threadId: '12345',
  frameIndex: 0,
});
```

### 3.3 获取字段信息

```typescript
const typeInfo = await client.getTypeInfo({
  typeName: 'MyClass',
});

if (typeInfo.fields) {
  for (const field of typeInfo.fields) {
    console.log(`Field: ${field.name}, Type: ${field.type}`);
    console.log(`Offset: ${field.byteOffset} bytes`);
  }
}
```

**输出示例**：
```
Field: x, Type: int
Offset: 0 bytes
Field: y, Type: double
Offset: 8 bytes
```

### 3.4 获取模板参数

```typescript
const typeInfo = await client.getTypeInfo({
  typeName: 'std::vector<int>',
  includeTemplateArgs: true,
});

if (typeInfo.templateArgs) {
  for (const arg of typeInfo.templateArgs) {
    console.log(`Template arg: ${arg.type}`);
  }
}
```

**输出示例**：
```
Template arg: int
```

### 3.5 获取基类信息

```typescript
const typeInfo = await client.getTypeInfo({
  typeName: 'DerivedClass',
});

if (typeInfo.baseClasses) {
  for (const base of typeInfo.baseClasses) {
    console.log(`Base class: ${base.name}`);
    console.log(`Offset: ${base.byteOffset} bytes`);
  }
}
```

### 3.6 获取枚举值

```typescript
const typeInfo = await client.getTypeInfo({
  typeName: 'MyEnum',
});

if (typeInfo.enumValues) {
  for (const val of typeInfo.enumValues) {
    console.log(`${val.name} = ${val.value}`);
  }
}
```

**输出示例**：
```
RED = 0
GREEN = 1
BLUE = 2
```

---

## 4. 符号查询增强

### 4.1 按名称查询符号

```typescript
const symbol = await client.getSymbol(undefined, undefined, {
  symbolName: 'main',
});

console.log(symbol.name);    // "main"
console.log(symbol.type);    // "code"
console.log(symbol.address); // 0x400000
```

### 4.2 模糊匹配符号

使用通配符进行符号名模糊匹配。

```typescript
// 查找所有以 "get" 开头的函数
const symbol = await client.getSymbol(undefined, undefined, {
  symbolName: 'get*',
  fuzzyMatch: true,
});

console.log(`Found ${symbol.numMatches} matches`);
```

### 4.3 获取当前帧的符号

```typescript
const symbol = await client.getSymbol(
  '12345', // 线程 ID
  0        // 帧索引
);
```

**使用场景**：
- 在没有调试信息的情况下调试
- 查找函数入口点
- 分析符号表

---

## 5. 批量信息获取

### 5.1 获取线程批量信息

一次性获取线程的所有栈帧信息，减少通信开销。

```typescript
const batchInfo = await client.getThreadBatchInfo('12345');

console.log(`Addresses: ${batchInfo.addresses}`);
console.log(`Files: ${batchInfo.files}`);
console.log(`Lines: ${batchInfo.lines}`);
console.log(`Functions: ${batchInfo.functions}`);
```

**性能优势**：
- 减少 LLDB 通信次数
- 降低延迟
- 提高批量操作的效率

---

## 6. 类型信息接口

完整的 `LLDBTypeInfo` 接口定义：

```typescript
interface LLDBTypeInfo {
  // 基本信息
  name: string;              // 类型名称
  basicType: string;         // 基本类型 (int, float, void 等)
  byteSize: number;          // 类型大小（字节）
  byteAlign: number;         // 类型对齐（字节）
  displayTypeName: string;   // 显示类型名称

  // 类型判断
  isPointer: boolean;        // 是否是指针
  isReference: boolean;      // 是否是引用
  isArray: boolean;          // 是否是数组
  isStruct: boolean;         // 是否是结构体
  isClass: boolean;          // 是否是类
  isUnion: boolean;          // 是否是联合体
  isTypedef: boolean;        // 是否是 typedef
  isEnumeration: boolean;    // 是否是枚举

  // 数量信息
  numChildren: number;       // 子字段数量
  numTemplateArgs: number;   // 模板参数数量

  // 可选信息
  templateArgs?: Array<{
    index: number;
    name: string;
    type: string;
  }>;

  fields?: Array<{
    name: string;
    type: string;
    byteOffset: number;
    isBitfield: boolean;
    isBaseClass: boolean;
    bitfieldSizeInBits: number | null;
  }>;

  baseClasses?: Array<{
    name: string;
    type: string;
    byteOffset: number;
  }>;

  enumValues?: Array<{
    name: string;
    value: number;
  }>;
}
```

---

## 7. 表达式求值选项接口

完整的 `LLDBEvalOptions` 接口定义：

```typescript
interface LLDBEvalOptions {
  // 超时控制
  timeout?: number;           // 超时时间（毫秒）

  // 求值行为
  unwindOnError?: boolean;    // 错误时是否展开调用栈
  ignoreBreakpoints?: boolean; // 是否忽略断点

  // 类型处理
  useDynamicTypes?: boolean;  // 是否使用动态类型信息

  // 线程处理
  tryAllThreads?: boolean;    // 是否在所有线程中尝试求值
}
```

---

## 8. 符号信息接口

完整的 `LLDBSymbolInfo` 接口定义：

```typescript
interface LLDBSymbolInfo {
  name: string;               // 符号名称
  type: "code" | "data" | "debug" | "other"; // 符号类型
  address: number;            // 符号地址
  size: number;               // 符号大小
  module: string | null;      // 所属模块
  numMatches?: number;        // 匹配数量（模糊匹配时）
}
```

---

## 9. 使用示例

### 9.1 调试多线程程序

```typescript
import { LLDBClient } from 'cli-debugger';

async function debugMultithreaded() {
  const client = new LLDBClient({
    protocol: 'lldb',
    target: '/path/to/multithreaded',
    timeout: 10000
  });

  await client.connect();

  // 启动程序
  await client.launch();

  // 获取所有线程
  const threads = await client.threads();
  console.log(`Found ${threads.length} threads`);

  // 挂起第一个线程
  await client.suspend(threads[0].id);

  // 继续执行，其他线程继续运行
  await client.resume();

  // 观察其他线程的状态
  const updatedThreads = await client.threads();
  console.log('Thread states:', updatedThreads.map(t => ({
    id: t.id,
    state: t.state
  })));

  // 恢复第一个线程
  await client.resume(threads[0].id);

  await client.close();
}
```

### 9.2 调试模板类

```typescript
async function debugTemplates() {
  const client = new LLDBClient({
    protocol: 'lldb',
    target: '/path/to/template_program',
    timeout: 10000
  });

  await client.connect();

  // 获取模板类型的详细信息
  const typeInfo = await client.getTypeInfo({
    typeName: 'MyClass<int>',
    includeTemplateArgs: true,
    includeFields: true,
  });

  console.log('Type:', typeInfo.name);
  console.log('Template args:', typeInfo.templateArgs);
  console.log('Fields:', typeInfo.fields);

  // 使用动态类型求值
  const result = await client.eval(
    'myObject.getValue()',
    threadId,
    0,
    {
      useDynamicTypes: true
    }
  );

  console.log('Result:', result);

  await client.close();
}
```

### 9.3 无调试信息调试

```typescript
async function debugWithoutSymbols() {
  const client = new LLDBClient({
    protocol: 'lldb',
    target: '/path/to/stripped_binary',
    timeout: 10000
  });

  await client.connect();

  // 设置地址断点
  const bpId = await client.setBreakpointAtAddress(0x400500);

  // 继续执行
  await client.resume();

  // 等待断点命中
  const event = await client.waitForEvent();

  if (event.type === 'breakpoint') {
    // 获取当前帧的符号信息
    const symbol = await client.getSymbol(
      event.threadId,
      0
    );

    console.log(`Hit symbol: ${symbol.name} at ${symbol.address}`);

    // 模糊查找符号
    const matchedSymbols = await client.getSymbol(
      undefined,
      undefined,
      {
        symbolName: 'myFunction*',
        fuzzyMatch: true
      }
    );

    console.log(`Found ${matchedSymbols.numMatches} matching symbols`);
  }

  await client.close();
}
```

---

## 10. 性能优化建议

### 10.1 使用批量操作

```typescript
// 好的做法：使用批量信息获取
const batchInfo = await client.getThreadBatchInfo(threadId);

// 避免：逐个获取信息
for (let i = 0; i < numFrames; i++) {
  const frame = await client.stack(threadId);
  // 处理每个帧...
}
```

### 10.2 合理设置超时

```typescript
// 简单表达式：短超时
const result = await client.eval('x + y', threadId, 0, {
  timeout: 1000,
  useDynamicTypes: false,
});

// 复杂表达式：长超时
const result = await client.eval('complexFunction()', threadId, 0, {
  timeout: 10000,
  useDynamicTypes: true,
});
```

### 10.3 按需获取详细信息

```typescript
// 获取基本信息
const typeInfo = await client.getTypeInfo({
  typeName: 'MyClass',
});

// 只有在需要时才获取详细信息
if (typeInfo.numChildren > 0) {
  const detailedInfo = await client.getTypeInfo({
    typeName: 'MyClass',
    includeFields: true,
    includeTemplateArgs: true,
  });
}
```

---

## 11. 常见问题

### Q1: 如何区分指针类型和引用类型？

```typescript
const typeInfo = await client.getTypeInfo({ typeName: 'MyType' });

if (typeInfo.isPointer) {
  console.log('这是指针类型');
} else if (typeInfo.isReference) {
  console.log('这是引用类型');
}
```

### Q2: 如何获取数组的长度和容量？

```typescript
const typeInfo = await client.getTypeInfo({ typeName: 'MyArray' });

if (typeInfo.isArray) {
  console.log('数组大小:', typeInfo.byteSize);
  // 通过字段信息获取元素数量
  if (typeInfo.fields) {
    console.log('字段数量:', typeInfo.fields.length);
  }
}
```

### Q3: 如何处理模糊匹配结果？

```typescript
const symbol = await client.getSymbol(undefined, undefined, {
  symbolName: 'get*',
  fuzzyMatch: true,
});

if (symbol.numMatches && symbol.numMatches > 1) {
  console.log(`找到 ${symbol.numMatches} 个匹配符号`);
  console.log('返回第一个匹配:', symbol.name);
}
```

### Q4: 如何在表达式求值时避免触发断点？

```typescript
const result = await client.eval('myFunction()', threadId, 0, {
  ignoreBreakpoints: true,
});
```

---

## 12. 参考资源

- [LLDB Python API 文档](https://lldb.llvm.org/python_reference.html)
- [LLDB 命令参考](https://lldb.llvm.org/use/map.html)
- [项目 README](../../../README.md)
- [功能覆盖分析报告](./feature-coverage-analysis.md)
- [实施任务列表](./implementation-tasks.md)