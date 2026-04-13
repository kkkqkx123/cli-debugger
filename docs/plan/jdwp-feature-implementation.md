# JDWP 功能实现分阶段方案

## 概述

本文档基于对现有 JDWP 插件实现与 JDWP 协议规范的对比分析，制定了分阶段的功能补充方案。方案按照功能依赖关系和实现优先级分为四个阶段，逐步完善 JDWP 调试器的核心功能。

---

## 阶段一：完善基础调试功能（高优先级）

### 目标

完善断点设置、变量查看、源码定位等核心调试功能，使 JDWP 调试器具备基本的调试能力。

### 涉及命令集

- **ReferenceType**（命令集 2）：类信息查询
- **Method**（命令集 6）：方法信息查询
- **ThreadReference**（命令集 10）：线程组信息

### 具体任务

#### 1.1 ReferenceType 命令集实现

| 命令ID | 命令名     | 文件                                 | 方法名                                             | 说明         |
| ------ | ---------- | ------------------------------------ | -------------------------------------------------- | ------------ |
| 1      | Signature  | `internal/api/jdwp/referencetype.go` | `Signature(refTypeID string) (string, error)`      | 获取类签名   |
| 4      | Fields     | `internal/api/jdwp/referencetype.go` | `Fields(refTypeID string) ([]*FieldInfo, error)`   | 枚举类字段   |
| 5      | Methods    | `internal/api/jdwp/referencetype.go` | `Methods(refTypeID string) ([]*MethodInfo, error)` | 枚举类方法   |
| 7      | SourceFile | `internal/api/jdwp/referencetype.go` | `SourceFile(refTypeID string) (string, error)`     | 获取源文件名 |

**新增数据结构**：

```go
// FieldInfo 字段信息
type FieldInfo struct {
    FieldID   string
    Name      string
    Signature string
    Modifiers int
}

// MethodInfo 方法信息
type MethodInfo struct {
    MethodID  string
    Name      string
    Signature string
    Modifiers int
}
```

#### 1.2 Method 命令集实现

| 命令ID | 命令名        | 文件                          | 方法名                                                               | 说明           |
| ------ | ------------- | ----------------------------- | -------------------------------------------------------------------- | -------------- |
| 1      | LineTable     | `internal/api/jdwp/method.go` | `LineTable(refTypeID, methodID string) ([]*LineLocation, error)`     | 获取方法行号表 |
| 2      | VariableTable | `internal/api/jdwp/method.go` | `VariableTable(refTypeID, methodID string) ([]*VariableInfo, error)` | 获取局部变量表 |

**新增数据结构**：

```go
// LineLocation 行号位置
type LineLocation struct {
    LineCodeIndex int64
    LineNumber    int
}

// VariableInfo 变量信息
type VariableInfo struct {
    Slot      int
    Name      string
    Signature string
    CodeIndex int64
}
```

#### 1.3 ThreadReference 命令集补充

| 命令ID | 命令名      | 文件                          | 方法名                                         | 说明               |
| ------ | ----------- | ----------------------------- | ---------------------------------------------- | ------------------ |
| 5      | ThreadGroup | `internal/api/jdwp/thread.go` | `ThreadGroup(threadID string) (string, error)` | 获取线程所属线程组 |

#### 1.4 完善现有 TODO 功能

| 位置            | 功能          | 说明                      |
| --------------- | ------------- | ------------------------- |
| `client.go:322` | SetBreakpoint | 实现真实的断点设置逻辑    |
| `client.go:434` | GetFields     | 调用 ReferenceType.Fields |
| `event.go:252`  | encodeID      | 完善正确的 ID 编码逻辑    |

#### 1.5 协议常量补充

在 `protocol.go` 中添加：

```go
// ReferenceType Commands (Command Set = 2)
referenceTypeCommandSignature byte = 1
referenceTypeCommandFields byte = 4
referenceTypeCommandMethods byte = 5
referenceTypeCommandSourceFile byte = 7

// Method Commands (Command Set = 6)
methodCommandLineTable byte = 1
methodCommandVariableTable byte = 2
```

---

## 阶段二：对象与字段操作（中优先级）

### 目标

实现对对象的字段访问、方法调用等高级调试功能。

### 涉及命令集

- **ObjectReference**（命令集 9）：对象操作
- **ClassType**（命令集 3）：类类型操作

### 具体任务

#### 2.1 ObjectReference 命令集实现

| 命令ID | 命令名        | 文件                                   | 方法名                                                                 | 说明           |
| ------ | ------------- | -------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| 1      | ReferenceType | `internal/api/jdwp/objectreference.go` | `ReferenceType(objectID string) (string, error)`                       | 获取对象类型   |
| 2      | GetValues     | `internal/api/jdwp/objectreference.go` | `GetValues(objectID string, fieldIDs []string) ([]*Variable, error)`   | 获取实例字段值 |
| 3      | SetValues     | `internal/api/jdwp/objectreference.go` | `SetValues(objectID string, fieldValues map[string]interface{}) error` | 设置实例字段值 |
| 5      | MonitorInfo   | `internal/api/jdwp/objectreference.go` | `MonitorInfo(objectID string) (*MonitorInfo, error)`                   | 获取对象锁信息 |

**新增数据结构**：

```go
// MonitorInfo 监视器信息
type MonitorInfo struct {
    Owner         string
    EntryCount    int
    Waiters       []string
    WaitersCount  int
}
```

#### 2.2 ClassType 命令集实现

| 命令ID | 命令名       | 文件                             | 方法名                                                                                        | 说明           |
| ------ | ------------ | -------------------------------- | --------------------------------------------------------------------------------------------- | -------------- |
| 1      | Superclass   | `internal/api/jdwp/classtype.go` | `Superclass(classID string) (string, error)`                                                  | 获取父类       |
| 2      | SetValues    | `internal/api/jdwp/classtype.go` | `SetValues(classID string, fieldValues map[string]interface{}) error`                         | 设置静态字段值 |
| 3      | InvokeMethod | `internal/api/jdwp/classtype.go` | `InvokeMethod(classID, threadID, methodID string, args []interface{}) (*InvokeResult, error)` | 调用静态方法   |

**新增数据结构**：

```go
// InvokeResult 方法调用结果
type InvokeResult struct {
    ReturnValue interface{}
    Exception   string
}
```

#### 2.3 协议常量补充

在 `protocol.go` 中添加：

```go
// ObjectReference Commands (Command Set = 9)
objectReferenceCommandReferenceType byte = 1
objectReferenceCommandGetValues byte = 2
objectReferenceCommandSetValues byte = 3
objectReferenceCommandMonitorInfo byte = 5

// ClassType Commands (Command Set = 3)
classTypeCommandSuperclass byte = 1
classTypeCommandSetValues byte = 2
classTypeCommandInvokeMethod byte = 3
```

---

## 阶段三：高级调试功能（中优先级）

### 目标

实现字符串操作、数组操作、类加载器查询等高级调试功能。

### 涉及命令集

- **StringReference**（命令集 10）
- **ArrayReference**（命令集 13）
- **ClassLoaderReference**（命令集 14）
- **VirtualMachine** 高级命令

### 具体任务

#### 3.1 StringReference 命令集实现

| 命令ID | 命令名 | 文件                                   | 方法名                                   | 说明           |
| ------ | ------ | -------------------------------------- | ---------------------------------------- | -------------- |
| 1      | Value  | `internal/api/jdwp/stringreference.go` | `Value(stringID string) (string, error)` | 获取字符串内容 |

#### 3.2 ArrayReference 命令集实现

| 命令ID | 命令名    | 文件                                  | 方法名                                                                     | 说明         |
| ------ | --------- | ------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| 1      | Length    | `internal/api/jdwp/arrayreference.go` | `Length(arrayID string) (int, error)`                                      | 获取数组长度 |
| 2      | GetValues | `internal/api/jdwp/arrayreference.go` | `GetValues(arrayID string, startIndex, length int) ([]interface{}, error)` | 获取数组元素 |
| 3      | SetValues | `internal/api/jdwp/arrayreference.go` | `SetValues(arrayID string, startIndex int, values []interface{}) error`    | 设置数组元素 |

#### 3.3 ClassLoaderReference 命令集实现

| 命令ID | 命令名         | 文件                                        | 方法名                                                       | 说明                 |
| ------ | -------------- | ------------------------------------------- | ------------------------------------------------------------ | -------------------- |
| 1      | VisibleClasses | `internal/api/jdwp/classloaderreference.go` | `VisibleClasses(classLoaderID string) ([]*ClassInfo, error)` | 获取类加载器可见的类 |

#### 3.4 VirtualMachine 高级命令补充

| 命令ID | 命令名       | 文件                      | 方法名                                                         | 说明           |
| ------ | ------------ | ------------------------- | -------------------------------------------------------------- | -------------- |
| 12     | Capabilities | `internal/api/jdwp/vm.go` | `Capabilities(ctx context.Context) (*CapabilitiesInfo, error)` | 查询VM调试能力 |
| 13     | ClassPaths   | `internal/api/jdwp/vm.go` | `ClassPaths(ctx context.Context) (*ClassPathsInfo, error)`     | 获取类路径     |

**新增数据结构**：

```go
// CapabilitiesInfo 调试能力信息
type CapabilitiesInfo struct {
    CanWatchFieldModification bool
    CanWatchFieldAccess bool
    CanGetBytecodes bool
    CanGetSyntheticAttribute bool
    CanGetOwnedMonitorInfo bool
    CanGetCurrentContendedMonitor bool
    CanGetMonitorInfo bool
    CanRedefineClasses bool
    CanAddMethod bool
    CanUnrestrictedlyRedefineClasses bool
    CanPopFrames bool
    CanUseInstanceFilters bool
    CanGetSourceDebugExtension bool
    CanRequestVMDeathEvent bool
    CanSetDefaultStratum bool
    CanGetInstanceInfo bool
    CanRequestMonitorEvents bool
    CanGetMonitorFrameInfo bool
    CanGetConstantPool bool
    CanSetNativeMethodPrefix bool
    CanRedefineClassesWhenMismatched bool
}

// ClassPathsInfo 类路径信息
type ClassPathsInfo struct {
    Classpath []string
    BootClasspath []string
}
```

#### 3.5 协议常量补充

在 `protocol.go` 中添加：

```go
// StringReference Commands (Command Set = 10)
stringReferenceCommandValue byte = 1

// ArrayReference Commands (Command Set = 13)
arrayReferenceCommandLength byte = 1
arrayReferenceCommandGetValues byte = 2
arrayReferenceCommandSetValues byte = 3

// ClassLoaderReference Commands (Command Set = 14)
classLoaderCommandVisibleClasses byte = 1

// VM Commands补充
vmCommandCapabilities byte = 12
vmCommandClassPaths byte = 13
```

---

## 阶段四：扩展功能（低优先级）

### 目标

实现热替换、线程控制、模块查询等扩展功能。

### 涉及命令集

- **VirtualMachine** 扩展命令
- **ThreadReference** 高级命令
- **ModuleReference**（命令集 18）

### 具体任务

#### 4.1 VirtualMachine 扩展命令

| 命令ID | 命令名                | 文件                      | 方法名                                                             | 说明                 |
| ------ | --------------------- | ------------------------- | ------------------------------------------------------------------ | -------------------- |
| 10     | Exit                  | `internal/api/jdwp/vm.go` | `Exit(ctx context.Context, exitCode int) error`                    | 让目标VM退出         |
| 11     | CreateString          | `internal/api/jdwp/vm.go` | `CreateString(ctx context.Context, str string) (string, error)`    | 在目标VM创建字符串   |
| 15     | HoldEvents            | `internal/api/jdwp/vm.go` | `HoldEvents(ctx context.Context) error`                            | 暂停发送事件         |
| 16     | ReleaseEvents         | `internal/api/jdwp/vm.go` | `ReleaseEvents(ctx context.Context) error`                         | 恢复发送事件         |
| 18     | RedefineClasses       | `internal/api/jdwp/vm.go` | `RedefineClasses(ctx context.Context, classes []*ClassDef) error`  | 热替换类定义         |
| 20     | AllClassesWithGeneric | `internal/api/jdwp/vm.go` | `AllClassesWithGeneric(ctx context.Context) ([]*ClassInfo, error)` | 枚举所有类（带泛型） |

**新增数据结构**：

```go
// ClassDef 类定义
type ClassDef struct {
    RefTypeID string
    ClassBytes []byte
}
```

#### 4.2 ThreadReference 高级命令

| 命令ID | 命令名           | 文件                          | 方法名                                                                | 说明             |
| ------ | ---------------- | ----------------------------- | --------------------------------------------------------------------- | ---------------- |
| 11     | Interrupt        | `internal/api/jdwp/thread.go` | `Interrupt(threadID string) error`                                    | 中断线程         |
| 12     | SuspendCount     | `internal/api/jdwp/thread.go` | `SuspendCount(threadID string) (int, error)`                          | 获取挂起次数     |
| 14     | ForceEarlyReturn | `internal/api/jdwp/thread.go` | `ForceEarlyReturn(threadID, frameID string, value interface{}) error` | 强制方法提前返回 |

#### 4.3 ModuleReference 命令集实现

| 命令ID | 命令名      | 文件                                   | 方法名                                         | 说明             |
| ------ | ----------- | -------------------------------------- | ---------------------------------------------- | ---------------- |
| 1      | Name        | `internal/api/jdwp/modulereference.go` | `Name(moduleID string) (string, error)`        | 获取模块名       |
| 2      | ClassLoader | `internal/api/jdwp/modulereference.go` | `ClassLoader(moduleID string) (string, error)` | 获取模块类加载器 |

#### 4.4 StackFrame 命令集补充

| 命令ID | 命令名    | 文件                              | 方法名                                                                      | 说明         |
| ------ | --------- | --------------------------------- | --------------------------------------------------------------------------- | ------------ |
| 2      | SetValues | `internal/api/jdwp/stackframe.go` | `SetValues(threadID, frameID string, slotValues map[int]interface{}) error` | 设置局部变量 |

#### 4.5 协议常量补充

在 `protocol.go` 中添加：

```go
// VM Commands补充
vmCommandExit byte = 10
vmCommandCreateString byte = 11
vmCommandHoldEvents byte = 15
vmCommandReleaseEvents byte = 16
vmCommandRedefineClasses byte = 18
vmCommandAllClassesWithGeneric byte = 20

// ThreadReference Commands补充
threadCommandInterrupt byte = 11
threadCommandSuspendCount byte = 12
threadCommandForceEarlyReturn byte = 14

// StackFrame Commands补充
stackFrameCommandSetValues byte = 2

// ModuleReference Commands (Command Set = 18)
moduleReferenceCommandName byte = 1
moduleReferenceCommandClassLoader byte = 2
```

---

## 实现优先级总结

| 阶段   | 优先级 | 核心价值                             | 预估工作量 |
| ------ | ------ | ------------------------------------ | ---------- |
| 阶段一 | 🔴 高  | 完善基础调试能力（断点、变量、源码） | 中等       |
| 阶段二 | 🟡 中  | 支持对象操作和方法调用               | 中等       |
| 阶段三 | 🟡 中  | 支持字符串、数组、类加载器查询       | 中等       |
| 阶段四 | 🟢 低  | 热替换、高级线程控制、模块查询       | 较小       |

---

## 依赖关系图

```
阶段一（基础调试）
├── ReferenceType.Signature → 阶段二 ObjectReference.ReferenceType
├── ReferenceType.Fields → 阶段二 ObjectReference.GetValues
├── ReferenceType.Methods → 阶段二 ClassType.InvokeMethod
└── Method.LineTable → 完善断点设置

阶段二（对象操作）
├── ObjectReference.ReferenceType
├── ObjectReference.GetValues → 阶段三 StringReference.Value
├── ObjectReference.SetValues → 阶段四 StackFrame.SetValues
└── ClassType.InvokeMethod

阶段三（高级功能）
├── StringReference.Value
├── ArrayReference.Length/GetValues/SetValues
├── ClassLoaderReference.VisibleClasses
└── VirtualMachine.Capabilities/ClassPaths

阶段四（扩展功能）
├── VirtualMachine.RedefineClasses
├── ThreadReference.Interrupt/ForceEarlyReturn
├── ModuleReference.Name/ClassLoader
└── StackFrame.SetValues
```

---

## 测试建议

每个阶段完成后，建议进行以下测试：

### 阶段一测试

- 设置行断点并触发
- 查看局部变量和字段
- 获取源文件位置

### 阶段二测试

- 查看对象字段值
- 修改对象字段值
- 调用静态方法

### 阶段三测试

- 查看字符串内容
- 查看数组元素
- 查询类加载器信息

### 阶段四测试

- 热替换类定义
- 中断线程
- 查询模块信息

---

## 注意事项

1. **ID 编码**：所有 ID（objectID, threadID, referenceTypeID 等）需要根据 `IDSizes` 正确编码
2. **错误处理**：所有命令调用都需要处理 JDWP 错误码，返回 `APIError`
3. **线程安全**：`Client` 结构体使用 `sync.Mutex` 保护并发访问
4. **上下文传递**：所有方法都接收 `context.Context` 参数，支持超时和取消
5. **协议版本**：部分命令可能需要检查 `Capabilities` 确认 VM 是否支持

---

## 附录：文件结构

```
internal/api/jdwp/
├── client.go              # 客户端核心（已存在）
├── plugin.go              # 插件接口实现（已存在）
├── protocol.go            # 协议常量和编解码（已存在）
├── handshake.go           # 握手协议（已存在）
├── vm.go                  # VirtualMachine命令集（已存在，需补充）
├── thread.go              # ThreadReference命令集（已存在，需补充）
├── stackframe.go          # StackFrame命令集（已存在，需补充）
├── event.go               # EventRequest命令集（已存在）
├── stream.go              # 事件流（已存在）
├── server.go              # WebSocket服务器（已存在）
├── referencetype.go       # ReferenceType命令集（新增）
├── method.go              # Method命令集（新增）
├── objectreference.go     # ObjectReference命令集（新增）
├── classtype.go           # ClassType命令集（新增）
├── stringreference.go     # StringReference命令集（新增）
├── arrayreference.go      # ArrayReference命令集（新增）
├── classloaderreference.go # ClassLoaderReference命令集（新增）
└── modulereference.go     # ModuleReference命令集（新增）
```
