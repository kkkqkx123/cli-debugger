# JDWP 协议指南

## 概述

JDWP (Java Debug Wire Protocol) 通过 TCP Socket 与 JVM 调试接口通信。协议实现位于 `src/protocol/jdwp/`。

## 文件结构

```
jdwp/
├── index.ts              # 导出
├── client.ts             # JDWPClient - 实现 DebugProtocol
├── event.ts              # 事件解析（断点、单步、异常等）
├── handshake.ts          # JDWP 握手
├── codec.ts              # 包编解码
├── reader.ts             # Buffer 读取工具
├── vm.ts                 # VM 命令（Version, ClassByName, IDSizes, AllThreads 等）
├── thread.ts             # 线程命令（GetName, GetStatus, Suspend, Resume, GetStack 等）
├── stack-frame.ts        # 栈帧命令（GetValues）
├── reference-type.ts     # 引用类型命令（GetMethods, GetFields, GetValues 等）
├── method.ts             # 方法命令（GetLineTable, GetVariableTable）
├── object-reference.ts   # 对象引用命令
├── class-type.ts         # 类类型命令
├── array-reference.ts    # 数组引用命令
├── class-loader-reference.ts  # 类加载器引用
├── class-object-reference.ts  # 类对象引用
├── string-reference.ts   # 字符串引用
├── module-reference.ts   # 模块引用
├── thread-group-reference.ts  # 线程组引用
└── protocol/             # JDWP 协议常数和类型
    ├── index.ts
    ├── constants.ts      # 命令集/命令码、事件类型、错误码
    ├── types.ts          # JDWP 内部类型
    └── utils.ts
```

## JDWP 包格式

JDWP 使用二进制包格式：

```
包头 (11 bytes):
  - length:     4 bytes (uint32) - 总包长度（含包头）
  - id:         4 bytes (uint32) - 包 ID
  - flags:      1 byte  - 0x00=命令, 0x80=回复
  - commandSet: 1 byte  - (仅命令包) 命令集
  - command:    1 byte  - (仅命令包) 命令码
  - errorCode:  4 bytes - (仅回复包) 错误码
数据载荷: (length - 11) bytes
```

## 事件机制

JDWP 事件由 JVM 主动推送给客户端。`event.ts` 实现事件解析：

```typescript
export function parseEvent(data: Buffer, idSizes: IDSizes): DebugEvent | null
```

### 事件类型

| 事件 | 类型码 | 关键字段 |
|------|--------|----------|
| SingleStep | 1 | requestID, threadID, location, typeTag, classID, methodID, codeIndex |
| Breakpoint | 2 | requestID, threadID, location, typeTag, classID, methodID, codeIndex |
| Exception | 4 | requestID, threadID, location, exception 等 |
| ThreadStart | 6 | requestID, threadID |
| ThreadDeath | 7 | requestID, threadID |
| ClassLoad | 8 | requestID, threadID, refTypeID |
| ClassUnload | 9 | requestID, threadID, refTypeID |
| MethodEntry | 10 | requestID, threadID, typeTag, classID, methodID |
| MethodExit | 11 | requestID, threadID, typeTag, classID, methodID |
| FieldAccess | 20 | requestID, threadID, typeTag, classID, methodID, fieldID |
| FieldModification | 21 | requestID, threadID, typeTag, classID, methodID, fieldID, value |

### 事件测试数据构建

Breakpoint 和 SingleStep 事件需要完整的 38 字节数据结构：

```typescript
// 事件头: suspendPolicy(1B) + eventCount(4B)
// 每个事件: eventKind(1B) + suspendPolicy(1B) + requestID(4B) + threadID(8B) + location(8B) + typeTag(1B) + classID(8B) + methodID(8B) + codeIndex(8B)
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

## ID 大小

ID 大小在连接时从 JVM 获取：

```typescript
interface IDSizes {
  fieldIDSize: number;
  methodIDSize: number;
  objectIDSize: number;
  referenceTypeIDSize: number;
  frameIDSize: number;
}
```

默认均为 8 字节。测试中构建 Buffer 时需要注意 IDSize 的一致性。

## 断点类型

JDWPClient 支持多种断点类型：

| 类型 | 对应 Event | 实现函数 |
|------|--------|----------|
| `line` | Breakpoint | `setLineBreakpoint` |
| `method-entry` | MethodEntry | `setMethodBreakpoint` |
| `method-exit` | MethodExit | `setMethodBreakpoint` |
| `exception` | Exception | `setExceptionBreakpoint` |
| `field-access` | FieldAccess | `setFieldBreakpoint` |
| `field-modify` | FieldModification | `setFieldBreakpoint` |
| `class-load` | ClassLoad | `setClassBreakpoint` |
| `class-unload` | ClassUnload | `setClassBreakpoint` |
| `thread-start` | ThreadStart | `setThreadBreakpoint` |
| `thread-death` | ThreadDeath | `setThreadBreakpoint` |

## JDWPClient 关键实现

### 连接流程
1. 创建 TCP Socket
2. 执行 JDWP 握手（`performHandshake`）
3. 获取 ID sizes（`vm.getIDSizes`）

### 命令执行模式
所有命令都通过 `executeCommand<T>` 方法执行：

```typescript
private async executeCommand<T>(
  fn: (executor: JDWPCommandExecutor) => Promise<T>,
): Promise<T>
```

`JDWPCommandExecutor` 提供 `sendPacket`、`readReply`、`idSizes` 接口。

### 事件等待

```typescript
async waitForEvent(timeout?: number): Promise<DebugEvent | null>
```

通过 `waitForEventInternal` 读取 JVM 推送的事件包，使用 `event.parseEvent()` 解析。

### 错误处理

JDWP 错误码通过 `mapJDWPError()` 映射到内部 `ErrorType`/`ErrorCodes`，并通过 `handleProtocolError()` 抛出 `APIError`。

## 测试注意事项

- 集成测试使用 `MockJDWPServer`（`tests/integration/jdwp/fixtures/mock-jdwp-server.ts`）
- E2E 测试需要真实 JVM 环境
- 事件测试需要构建精确的二进制数据