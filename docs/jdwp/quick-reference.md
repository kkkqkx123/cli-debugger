# JDWP 命令快速参考

本文档提供 JDWP 命令的快速查找表，便于开发者快速定位所需功能。

## 命令集索引

| 命令集 | 编号 | 文件 | 主要功能 |
|--------|------|------|----------|
| [VirtualMachine](#virtualmachine) | 1 | `vm.ts` | VM 生命周期、版本、能力 |
| [ReferenceType](#referencetype) | 2 | `reference-type.ts` | 类结构、字段、方法 |
| [ClassType](#classtype) | 3 | `class-type.ts` | 继承、静态方法调用 |
| [Method](#method) | 5 | `method.ts` | 行号表、变量表、字节码 |
| [ObjectReference](#objectreference) | 7 | `object-reference.ts` | 实例字段、方法调用 |
| [StringReference](#stringreference) | 8 | `string-reference.ts` | 字符串值 |
| [ThreadReference](#threadreference) | 11 | `thread.ts` | 线程控制、栈帧 |
| [ThreadGroupReference](#threadgroupreference) | 12 | `thread-group-reference.ts` | 线程组 |
| [ArrayReference](#arrayreference) | 13 | `array-reference.ts` | 数组操作 |
| [ClassLoaderReference](#classloaderreference) | 14 | `class-loader-reference.ts` | 类加载器 |
| [EventRequest](#eventrequest) | 15 | `event.ts` | 事件请求 |
| [StackFrame](#stackframe) | 16 | `stack-frame.ts` | 栈帧变量 |
| [ClassObjectReference](#classobjectreference) | 17 | `class-object-reference.ts` | 类对象 |
| [ModuleReference](#modulereference) | 18 | `module-reference.ts` | 模块 (Java 9+) |

---

## VirtualMachine

**文件:** `src/protocol/jdwp/vm.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getVersion()` | Version (1) | 获取 JDWP 和 JVM 版本 |
| `getIDSizes()` | IDSizes (7) | 获取 ID 大小 (内部) |
| `getAllClasses()` | AllClasses (3) | 获取所有已加载类 |
| `getAllThreads()` | AllThreads (4) | 获取所有线程 ID |
| `classByName()` | ClassesBySignature (2) | 按签名查找类 |
| `suspendVM()` | Suspend (8) | 挂起整个 VM |
| `resumeVM()` | Resume (9) | 恢复整个 VM |
| `dispose()` | Dispose (6) | 结束调试会话 |
| `exit()` | Exit (10) | 退出 VM |
| `createString()` | CreateString (11) | 创建字符串对象 |
| `getCapabilities()` | Capabilities (12) | 获取 VM 能力 |
| `getCapabilitiesInfo()` | Capabilities (12) | 获取详细能力 |
| `getClassPaths()` | ClassPaths (13) | 获取类路径 |
| `holdEvents()` | HoldEvents (15) | 暂停事件 |
| `releaseEvents()` | ReleaseEvents (16) | 恢复事件 |
| `redefineClasses()` | RedefineClasses (18) | 热替换类 |

---

## ReferenceType

**文件:** `src/protocol/jdwp/reference-type.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getSignature()` | Signature (1) | 获取类签名 |
| `getFields()` | Fields (4) | 获取所有字段 |
| `getMethods()` | Methods (5) | 获取所有方法 |
| `getSourceFile()` | SourceFile (7) | 获取源文件名 |
| `getStaticFieldValues()` | GetValues (6) | 获取静态字段值 |
| `getValuesWithTags()` | GetValues (6) | 获取静态字段值 (带标签) |
| `setStaticFieldValue()` | SetValues (19) | 设置静态字段值 |
| `getStatus()` | Status (9) | 获取类状态 |
| `getInterfaces()` | Interfaces (10) | 获取实现的接口 |
| `getClassObject()` | ClassObject (11) | 获取类对象 |
| `getInstances()` | Instances (16) | 获取类实例 |
| `getClassFileVersion()` | ClassFileVersion (17) | 获取类文件版本 |
| `getClassLoader()` | ClassLoader (2) | 获取类加载器 |

---

## ClassType

**文件:** `src/protocol/jdwp/class-type.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getSuperclass()` | Superclass (1) | 获取父类 |
| `setStaticFieldValues()` | SetValues (2) | 设置静态字段 |
| `invokeStaticMethod()` | InvokeMethod (3) | 调用静态方法 |
| `newInstance()` | NewInstance (4) | 创建新实例 |

---

## Method

**文件:** `src/protocol/jdwp/method.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getLineTable()` | LineTable (1) | 获取行号映射 |
| `getVariableTable()` | VariableTable (2) | 获取局部变量表 |
| `getBytecodes()` | Bytecodes (3) | 获取字节码 |
| `isObsolete()` | IsObsolete (4) | 检查是否过时 |
| `getVariableTableWithGeneric()` | VariableTableWithGeneric (5) | 获取变量表 (含泛型) |

---

## ObjectReference

**文件:** `src/protocol/jdwp/object-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getReferenceType()` | ReferenceType (1) | 获取对象类型 |
| `getInstanceFieldValues()` | GetValues (2) | 获取实例字段值 |
| `setInstanceFieldValues()` | SetValues (3) | 设置实例字段值 |
| `setInstanceFieldValue()` | SetValues (3) | 设置单个字段值 |
| `getMonitorInfo()` | MonitorInfo (5) | 获取监视器信息 |
| `invokeInstanceMethod()` | InvokeMethod (6) | 调用实例方法 |
| `disableCollection()` | DisableCollection (7) | 禁用 GC |
| `enableCollection()` | EnableCollection (8) | 启用 GC |
| `isCollected()` | IsCollected (9) | 检查是否被收集 |
| `getReferringObjects()` | ReferringObjects (10) | 获取引用对象 |

---

## StringReference

**文件:** `src/protocol/jdwp/string-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getStringValue()` | Value (1) | 获取字符串内容 |

---

## ThreadReference

**文件:** `src/protocol/jdwp/thread.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getThreadName()` | Name (1) | 获取线程名 |
| `suspendThread()` | Suspend (2) | 挂起线程 |
| `resumeThread()` | Resume (3) | 恢复线程 |
| `getThreadStatus()` | Status (4) | 获取线程状态 |
| `getThreadState()` | Status (4) | 获取状态字符串 |
| `getThreadGroup()` | ThreadGroup (5) | 获取线程组 |
| `getThreadFrames()` | Frames (6) | 获取栈帧 |
| `getThreadFrameCount()` | FrameCount (7) | 获取栈帧数 |
| `getThreadStack()` | Frames (6) | 获取完整栈跟踪 |
| `getOwnedMonitors()` | OwnedMonitors (8) | 获取拥有的监视器 |
| `getCurrentContendedMonitor()` | CurrentContendedMonitor (9) | 获取竞争监视器 |
| `stopThread()` | Stop (10) | 停止线程 |
| `interruptThread()` | Interrupt (11) | 中断线程 |
| `getSuspendCount()` | SuspendCount (12) | 获取挂起计数 |
| `forceEarlyReturn()` | ForceEarlyReturn (14) | 强制提前返回 |

---

## ThreadGroupReference

**文件:** `src/protocol/jdwp/thread-group-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getThreadGroupName()` | Name (1) | 获取线程组名 |
| `getParentThreadGroup()` | Parent (2) | 获取父线程组 |
| `getThreadGroupChildren()` | Children (3) | 获取子线程组和线程 |

---

## ArrayReference

**文件:** `src/protocol/jdwp/array-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getArrayLength()` | Length (1) | 获取数组长度 |
| `getArrayValues()` | GetValues (2) | 获取数组元素 |
| `setArrayValues()` | SetValues (3) | 设置数组元素 |

---

## ClassLoaderReference

**文件:** `src/protocol/jdwp/class-loader-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getVisibleClasses()` | VisibleClasses (1) | 获取可见类 |

---

## EventRequest

**文件:** `src/protocol/jdwp/event.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `setBreakpointRequest()` | Set (1) | 设置断点 |
| `clearBreakpointRequest()` | Clear (2) | 清除断点 |
| `clearAllBreakpoints()` | ClearAllBreakpoints (3) | 清除所有断点 |
| `setStepRequest()` | Set (1) | 设置单步 |
| `setMethodRequest()` | Set (1) | 设置方法断点 |
| `setExceptionRequest()` | Set (1) | 设置异常断点 |
| `setFieldRequest()` | Set (1) | 设置字段断点 |
| `setClassRequest()` | Set (1) | 设置类断点 |
| `setThreadRequest()` | Set (1) | 设置线程断点 |
| `setClassPrepareRequest()` | Set (1) | 设置类准备事件 |
| `setThreadStartRequest()` | Set (1) | 设置线程启动事件 |
| `setThreadDeathRequest()` | Set (1) | 设置线程死亡事件 |
| `parseEvent()` | - | 解析事件数据 |

---

## StackFrame

**文件:** `src/protocol/jdwp/stack-frame.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getStackFrameValues()` | GetValues (1) | 获取局部变量 |
| `setStackFrameValues()` | SetValues (2) | 设置局部变量 |
| `getThisObject()` | ThisObject (3) | 获取 this 对象 |
| `popFrames()` | PopFrames (4) | 弹出栈帧 |

---

## ClassObjectReference

**文件:** `src/protocol/jdwp/class-object-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getReflectedType()` | ReflectedType (1) | 获取反射类型 |

---

## ModuleReference

**文件:** `src/protocol/jdwp/module-reference.ts`

| 函数 | 命令 | 用途 |
|------|------|------|
| `getModuleName()` | Name (1) | 获取模块名 |
| `getModuleClassLoader()` | ClassLoader (2) | 获取模块类加载器 |

---

## 按功能分类

### 生命周期管理

| 操作 | 函数 | 文件 |
|------|------|------|
| 连接 | `connect()` | `client.ts` |
| 断开 | `close()`, `dispose()` | `client.ts`, `vm.ts` |
| 退出 VM | `exit()` | `vm.ts` |

### 线程操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取所有线程 | `threads()`, `getAllThreads()` | `client.ts`, `vm.ts` |
| 获取线程名 | `getThreadName()` | `thread.ts` |
| 获取线程状态 | `getThreadStatus()`, `getThreadState()` | `thread.ts` |
| 挂起线程 | `suspend()`, `suspendThread()`, `suspendVM()` | `client.ts`, `thread.ts`, `vm.ts` |
| 恢复线程 | `resume()`, `resumeThread()`, `resumeVM()` | `client.ts`, `thread.ts`, `vm.ts` |
| 停止线程 | `stopThread()` | `thread.ts` |
| 中断线程 | `interruptThread()` | `thread.ts` |

### 栈帧操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取栈帧 | `stack()`, `getThreadFrames()`, `getThreadStack()` | `client.ts`, `thread.ts` |
| 获取栈帧数 | `getThreadFrameCount()` | `thread.ts` |
| 获取局部变量 | `locals()`, `getStackFrameValues()` | `client.ts`, `stack-frame.ts` |
| 设置局部变量 | `setStackFrameValues()` | `stack-frame.ts` |
| 获取 this | `getThisObject()` | `stack-frame.ts` |
| 弹出栈帧 | `popFrames()` | `stack-frame.ts` |

### 断点操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 设置断点 | `setBreakpoint()` | `client.ts` |
| 设置行断点 | `setBreakpointRequest()` | `event.ts` |
| 设置方法断点 | `setMethodRequest()` | `event.ts` |
| 设置异常断点 | `setExceptionRequest()` | `event.ts` |
| 设置字段断点 | `setFieldRequest()` | `event.ts` |
| 设置类断点 | `setClassRequest()` | `event.ts` |
| 设置线程断点 | `setThreadRequest()` | `event.ts` |
| 移除断点 | `removeBreakpoint()`, `clearBreakpointRequest()` | `client.ts`, `event.ts` |
| 清除所有断点 | `clearBreakpoints()`, `clearAllBreakpoints()` | `client.ts`, `event.ts` |
| 获取所有断点 | `breakpoints()` | `client.ts` |

### 单步执行

| 操作 | 函数 | 文件 |
|------|------|------|
| 单步进入 | `stepInto()` | `client.ts` |
| 单步跳过 | `stepOver()` | `client.ts` |
| 单步跳出 | `stepOut()` | `client.ts` |
| 设置单步请求 | `setStepRequest()` | `event.ts` |

### 类操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取所有类 | `getAllClasses()` | `vm.ts` |
| 按名查找类 | `classByName()` | `vm.ts` |
| 获取类签名 | `getSignature()` | `reference-type.ts` |
| 获取类状态 | `getStatus()` | `reference-type.ts` |
| 获取类字段 | `getFields()` | `reference-type.ts` |
| 获取类方法 | `getMethods()` | `reference-type.ts` |
| 获取源文件 | `getSourceFile()` | `reference-type.ts` |
| 获取父类 | `getSuperclass()` | `class-type.ts` |
| 获取接口 | `getInterfaces()` | `reference-type.ts` |
| 重定义类 | `redefineClasses()` | `vm.ts` |

### 字段操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取静态字段 | `getStaticFieldValues()`, `getValuesWithTags()` | `reference-type.ts` |
| 设置静态字段 | `setStaticFieldValue()` | `reference-type.ts` |
| 获取实例字段 | `fields()`, `getInstanceFieldValues()` | `client.ts`, `object-reference.ts` |
| 设置实例字段 | `setField()`, `setInstanceFieldValue()` | `client.ts`, `object-reference.ts` |

### 方法操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取行号表 | `getLineTable()` | `method.ts` |
| 获取变量表 | `getVariableTable()` | `method.ts` |
| 获取字节码 | `getBytecodes()` | `method.ts` |
| 调用静态方法 | `invokeStaticMethod()` | `class-type.ts` |
| 调用实例方法 | `invokeInstanceMethod()` | `object-reference.ts` |

### 对象操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取对象类型 | `getReferenceType()` | `object-reference.ts` |
| 获取监视器信息 | `getMonitorInfo()` | `object-reference.ts` |
| 禁用/启用 GC | `disableCollection()`, `enableCollection()` | `object-reference.ts` |
| 检查是否被收集 | `isCollected()` | `object-reference.ts` |
| 获取引用对象 | `getReferringObjects()` | `object-reference.ts` |

### 数组操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 获取数组长度 | `getArrayLength()` | `array-reference.ts` |
| 获取数组元素 | `getArrayValues()` | `array-reference.ts` |
| 设置数组元素 | `setArrayValues()` | `array-reference.ts` |

### 事件操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 等待事件 | `waitForEvent()` | `client.ts` |
| 解析事件 | `parseEvent()` | `event.ts` |
| 暂停事件 | `holdEvents()` | `vm.ts` |
| 恢复事件 | `releaseEvents()` | `vm.ts` |

### 字符串操作

| 操作 | 函数 | 文件 |
|------|------|------|
| 创建字符串 | `createString()` | `vm.ts` |
| 获取字符串值 | `getStringValue()` | `string-reference.ts` |

---

## 常量参考

### 事件类型 (EventType)

```typescript
SingleStep: 1        // 单步执行
Breakpoint: 2        // 断点
Exception: 4         // 异常
ThreadStart: 6       // 线程启动
ThreadDeath: 7       // 线程死亡
ClassPrepare: 8      // 类准备
ClassUnload: 9       // 类卸载
ClassLoad: 10        // 类加载
FieldAccess: 11      // 字段访问
FieldModification: 12 // 字段修改
VMStart: 13          // VM 启动
VMDeath: 14          // VM 死亡
MethodEntry: 40      // 方法进入
MethodExit: 41       // 方法退出
```

### 挂起策略 (SuspendPolicy)

```typescript
None: 0        // 不挂起
EventThread: 1 // 挂起事件线程
All: 2         // 挂起所有线程
```

### 单步类型 (StepKind)

```typescript
Into: 0  // 进入方法
Over: 1  // 跳过方法
Out: 2   // 跳出方法
```

### 线程状态 (ThreadState)

```typescript
Zombie: 1      // 僵尸
Running: 2     // 运行中
Sleeping: 3    // 休眠
Monitor: 4     // 等待监视器
Wait: 5        // 等待
NotStarted: 6  // 未启动
Started: 7     // 已启动
```

---

## 相关文档

- [完整命令参考](./commands-reference.md)
- [协议概述](./protocol-overview.md)
- [实现分析](./implementation-analysis.md)
