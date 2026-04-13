# JDWP P2 任务修改方案

## 概述

本文档描述 JDWP 协议实现中 P2 优先级任务的修改方案。这些任务属于可选功能,用于增强调试器的完整性和功能性。

---

## 任务列表

### 1. ThreadGroupReference 命令集实现

**优先级**: P2 (可选)  
**命令集 ID**: 12  
**文档参考**: [JDWP调试器命令及参数.md](../JDWP调试器命令及参数.md)

#### 需要实现的命令

| 命令 ID | 命令名 | 输入参数 | 输出 | 用途 |
|---------|--------|----------|------|------|
| 1 | Name | threadGroupID | 线程组名称 | 获取线程组名称 |
| 2 | Parent | threadGroupID | 父线程组ID | 获取父线程组 |
| 3 | Children | threadGroupID | 子线程组+子线程ID列表 | 获取子线程组 |

#### 实现方案

1. **创建文件**: `src/protocol/jdwp/thread-group-reference.ts`

2. **命令常量定义** (已在 `protocol.ts` 中定义):
```typescript
export const ThreadGroupReferenceCommand = {
  Name: 1,
  Parent: 2,
  Children: 3,
} as const;
```

3. **实现函数签名**:
```typescript
export async function getThreadGroupName(
  executor: JDWPCommandExecutor,
  threadGroupID: string
): Promise<string>

export async function getParentThreadGroup(
  executor: JDWPCommandExecutor,
  threadGroupID: string
): Promise<string>

export async function getThreadGroupChildren(
  executor: JDWPCommandExecutor,
  threadGroupID: string
): Promise<{
  childGroups: string[]
  childThreads: string[]
}>
```

4. **数据格式**:
   - `Children` 命令返回:
     - `childGroups`: 子线程组ID列表
     - `childThreads`: 子线程ID列表

#### 使用场景

- 可视化线程组层次结构
- 线程管理和监控工具
- 调试复杂的多线程应用

---

### 2. ClassLoaderReference 命令集实现

**优先级**: P2 (可选)  
**命令集 ID**: 14  
**文档参考**: [JDWP调试器命令及参数.md](../JDWP调试器命令及参数.md)

#### 需要实现的命令

| 命令 ID | 命令名 | 输入参数 | 输出 | 用途 |
|---------|--------|----------|------|------|
| 1 | VisibleClasses | classLoaderID | 可见类列表 | 获取类加载器可见的类 |

#### 实现方案

1. **创建文件**: `src/protocol/jdwp/class-loader-reference.ts`

2. **命令常量定义** (已在 `protocol.ts` 中定义):
```typescript
export const ClassLoaderReferenceCommand = {
  VisibleClasses: 1,
} as const;
```

3. **实现函数签名**:
```typescript
export async function getVisibleClasses(
  executor: JDWPCommandExecutor,
  classLoaderID: string
): Promise<{
  classes: Array<{
    refTypeID: string
    typeTag: number
    status: number
  }>
}>
```

4. **数据格式**:
   - 返回类数组,每个类包含:
     - `refTypeID`: 类的引用类型ID
     - `typeTag`: 类型标签
     - `status`: 类状态

#### 使用场景

- 分析类加载器行为
- 检测类泄漏
- 理解应用的类加载层次结构

---

### 3. ClassObjectReference 命令集实现

**优先级**: P2 (可选)  
**命令集 ID**: 17  
**文档参考**: [JDWP调试器命令及参数.md](../JDWP调试器命令及参数.md)

#### 需要实现的命令

| 命令 ID | 命令名 | 输入参数 | 输出 | 用途 |
|---------|--------|----------|------|------|
| 1 | ReflectedType | classObjectID | referenceTypeID | 获取类对象对应的类型 |

#### 实现方案

1. **创建文件**: `src/protocol/jdwp/class-object-reference.ts`

2. **命令常量定义** (已在 `protocol.ts` 中定义):
```typescript
export const ClassObjectReferenceCommand = {
  ReflectedType: 1,
} as const;
```

3. **实现函数签名**:
```typescript
export async function getReflectedType(
  executor: JDWPCommandExecutor,
  classObjectID: string
): Promise<string>
```

4. **数据格式**:
   - 返回 `referenceTypeID`: 类对象对应的引用类型ID

#### 使用场景

- 反射操作
- 动态类分析
- 元编程工具

---

### 4. ModuleReference 命令集实现

**优先级**: P2 (可选)  
**命令集 ID**: 18  
**文档参考**: [JDWP调试器命令及参数.md](../JDWP调试器命令及参数.md)

#### 需要实现的命令

| 命令 ID | 命令名 | 输入参数 | 输出 | 用途 |
|---------|--------|----------|------|------|
| 1 | Name | moduleID | 模块名称 | 获取模块名称 |
| 2 | ClassLoader | moduleID | classLoaderID | 获取模块的类加载器 |

#### 实现方案

1. **创建文件**: `src/protocol/jdwp/module-reference.ts`

2. **添加命令常量** (需要在 `protocol.ts` 中添加):
```typescript
export const ModuleReferenceCommand = {
  Name: 1,
  ClassLoader: 2,
} as const;
```

3. **添加命令集ID** (需要在 `protocol.ts` 的 `CommandSet` 中添加):
```typescript
export const CommandSet = {
  // ... 其他命令集
  ModuleReference: 18,
  Event: 64,
} as const;
```

4. **实现函数签名**:
```typescript
export async function getModuleName(
  executor: JDWPCommandExecutor,
  moduleID: string
): Promise<string>

export async function getModuleClassLoader(
  executor: JDWPCommandExecutor,
  moduleID: string
): Promise<string>
```

5. **数据格式**:
   - `Name`: 返回模块名称 (UTF-8字符串)
   - `ClassLoader`: 返回类加载器对象ID

#### 使用场景

- Java 9+ 模块系统支持
- 模块依赖分析
- 模块化应用调试

---

## 实现步骤

### 通用步骤 (适用于所有命令集)

1. **创建命令集文件**
   - 在 `src/protocol/jdwp/` 目录下创建对应的 `.ts` 文件
   - 文件命名格式: `{command-set-name}-reference.ts`

2. **实现命令函数**
   - 每个命令实现一个 `async` 函数
   - 函数签名: `export async function {commandName}(executor: JDWPCommandExecutor, ...params): Promise<ReturnType>`
   - 使用 `createCommandPacketWithData` 构建请求包
   - 使用 `PacketReader` 解析响应
   - 错误处理: 使用 `APIError` 抛出协议错误

3. **更新导出**
   - 在 `src/protocol/jdwp/index.ts` 中添加导出:
     ```typescript
     export * as {moduleName} from "./{module-name}.js";
     ```

4. **添加类型定义** (如需要)
   - 在 `src/protocol/jdwp/protocol.ts` 中添加相关接口

5. **编写测试**
   - 在 `src/protocol/jdwp/__tests__/` 目录下创建测试文件
   - 使用 Vitest 的 `describe`, `it`, `expect` 模式
   - Mock 网络操作

### 具体实现顺序建议

1. **ThreadGroupReference** - 最简单,3个命令
2. **ClassLoaderReference** - 单个命令,较简单
3. **ClassObjectReference** - 单个命令,最简单
4. **ModuleReference** - 需要添加新的命令集定义

---

## 代码模板

### 命令集文件模板

```typescript
/**
 * {CommandSetName} Command Set Implementation
 */

import {
  CommandSet,
  {CommandSet}Command,
  type IDSizes,
} from "./protocol.js";
import {
  createCommandPacketWithData,
  encodeID,
  encodeUint32,
  // 其他需要的编码函数
} from "./codec.js";
import { PacketReader } from "./reader.js";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";

/**
 * JDWP Client interface for command execution
 */
export interface JDWPCommandExecutor {
  sendPacket(packet: Buffer): Promise<void>;
  readReply(): Promise<{ errorCode: number; message: string; data: Buffer }>;
  idSizes: IDSizes;
}

/**
 * {Command description}
 */
export async function {commandName}(
  executor: JDWPCommandExecutor,
  {paramName}: {ParamType},
): Promise<{ReturnType}> {
  const data = encodeID({paramName}, executor.idSizes.{idSize});
  const packet = createCommandPacketWithData(
    CommandSet.{CommandSet},
    {CommandSet}Command.{Command},
    data,
  );
  await executor.sendPacket(packet);

  const reply = await executor.readReply();
  if (reply.errorCode !== 0) {
    throw new APIError(
      ErrorType.ProtocolError,
      ErrorCodes.ProtocolError,
      `{Command name} failed: ${reply.message}`,
    );
  }

  const reader = new PacketReader(reply.data);
  // 解析返回数据
  return {returnValue};
}
```

### 测试文件模板

```typescript
import { describe, it, expect, vi } from "vitest";
import { JDWPCommandExecutor } from "../{module-name}.js";
import * as codec from "../codec.js";
import * as protocol from "../protocol.js";

vi.mock("../codec.js");
vi.mock("../protocol.js");

describe("{CommandSetName}", () => {
  it("should {test description}", async () => {
    const mockExecutor: JDWPCommandExecutor = {
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

    // Mock responses
    vi.spyOn(codec, "createCommandPacketWithData").mockReturnValue(
      Buffer.from([]),
    );
    vi.spyOn(mockExecutor, "readReply").mockResolvedValue({
      errorCode: 0,
      message: "",
      data: Buffer.from([]),
    });

    // Test implementation
    const result = await {commandName}(mockExecutor, {paramValue});

    // Assertions
    expect(result).toBeDefined();
  });
});
```

---

## 验证清单

完成每个命令集实现后,验证以下项目:

- [ ] TypeScript 类型检查通过 (`npm run typecheck`)
- [ ] ESLint 检查通过 (`npm run lint`)
- [ ] 单元测试通过 (`npm test`)
- [ ] 代码符合项目规范
- [ ] 错误处理完整
- [ ] 导出正确更新

---

## 参考资料

- [JDWP 调试器命令及参数.md](../JDWP调试器命令及参数.md) - 完整的 JDWP 命令参考
- [命令速查.md](../命令速查.md) - 快速查询命令集和命令ID
- [JDWP Specification](https://docs.oracle.com/javase/8/docs/technotes/guides/jpda/jdwp-spec.html) - 官方规范文档

---

## 注意事项

1. **ID 大小**: 所有 ID 编码/解码都需要使用正确的 `idSize` (objectIDSize, referenceTypeIDSize 等)
2. **错误处理**: 所有命令都必须检查 `errorCode` 并抛出 `APIError`
3. **类型安全**: 避免使用 `any`, 使用 `unknown` 处理动态类型
4. **编码规范**: 遵循项目 ESLint 和 Prettier 配置
5. **测试覆盖**: 为每个命令编写单元测试

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-04-13 | 1.0 | 初始版本,定义 P2 任务方案 |
