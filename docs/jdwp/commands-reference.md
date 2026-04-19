# JDWP 命令参考

本文档详细列出 cli-debugger 项目中实现的 JDWP (Java Debug Wire Protocol) 命令集及其功能。

## 目录

- [命令集概览](#命令集概览)
- [VirtualMachine 命令集 (1)](#virtualmachine-命令集-1)
- [ReferenceType 命令集 (2)](#referencetype-命令集-2)
- [ClassType 命令集 (3)](#classtype-命令集-3)
- [Method 命令集 (5)](#method-命令集-5)
- [ObjectReference 命令集 (7)](#objectreference-命令集-7)
- [StringReference 命令集 (8)](#stringreference-命令集-8)
- [ThreadReference 命令集 (11)](#threadreference-命令集-11)
- [ThreadGroupReference 命令集 (12)](#threadgroupreference-命令集-12)
- [ArrayReference 命令集 (13)](#arrayreference-命令集-13)
- [ClassLoaderReference 命令集 (14)](#classloaderreference-命令集-14)
- [EventRequest 命令集 (15)](#eventrequest-命令集-15)
- [StackFrame 命令集 (16)](#stackframe-命令集-16)
- [ClassObjectReference 命令集 (17)](#classobjectreference-命令集-17)
- [ModuleReference 命令集 (18)](#modulereference-命令集-18)
- [事件类型](#事件类型)
- [挂起策略](#挂起策略)
- [单步执行类型](#单步执行类型)

---

## 命令集概览

| 命令集 | 编号 | 描述 | 实现文件 |
|--------|------|------|----------|
| VirtualMachine | 1 | 虚拟机级别操作 | `vm.ts` |
| ReferenceType | 2 | 引用类型操作 | `reference-type.ts` |
| ClassType | 3 | 类类型操作 | `class-type.ts` |
| ArrayType | 4 | 数组类型操作 | - |
| Method | 5 | 方法操作 | `method.ts` |
| Field | 6 | 字段操作 | - |
| ObjectReference | 7 | 对象引用操作 | `object-reference.ts` |
| StringReference | 8 | 字符串引用操作 | `string-reference.ts` |
| ThreadReference | 11 | 线程引用操作 | `thread.ts` |
| ThreadGroupReference | 12 | 线程组引用操作 | `thread-group-reference.ts` |
| ArrayReference | 13 | 数组引用操作 | `array-reference.ts` |
| ClassLoaderReference | 14 | 类加载器引用操作 | `class-loader-reference.ts` |
| EventRequest | 15 | 事件请求操作 | `event.ts` |
| StackFrame | 16 | 栈帧操作 | `stack-frame.ts` |
| ClassObjectReference | 17 | 类对象引用操作 | `class-object-reference.ts` |
| ModuleReference | 18 | 模块引用操作 | `module-reference.ts` |
| Event | 64 | 事件处理 | `event.ts` |

---

## VirtualMachine 命令集 (1)

虚拟机级别的操作，用于获取 VM 信息、控制 VM 生命周期等。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Version | 1 | `getVersion()` | 获取 JDWP 版本信息和 VM 描述 |
| ClassesBySignature | 2 | `classByName()` | 按签名查找已加载的类 |
| AllClasses | 3 | `getAllClasses()` | 获取所有已加载的类 |
| AllThreads | 4 | `getAllThreads()` | 获取所有线程 ID |
| TopLevelThreadGroups | 5 | - | 获取顶层线程组 |
| Dispose | 6 | `dispose()` | 释放调试会话 |
| IDSizes | 7 | `getIDSizes()` | 获取各种 ID 的大小 |
| Suspend | 8 | `suspendVM()` | 挂起整个 VM |
| Resume | 9 | `resumeVM()` | 恢复整个 VM |
| Exit | 10 | `exit()` | 退出 VM |
| CreateString | 11 | `createString()` | 在 VM 中创建字符串 |
| Capabilities | 12 | `getCapabilities()` | 获取 VM 能力 |
| ClassPaths | 13 | `getClassPaths()` | 获取类路径信息 |
| HoldEvents | 15 | `holdEvents()` | 暂停事件发送 |
| ReleaseEvents | 16 | `releaseEvents()` | 恢复事件发送 |
| RedefineClasses | 18 | `redefineClasses()` | 重定义类 |
| SetDefaultStratum | 19 | - | 设置默认分层 |
| AllClassesWithGeneric | 20 | - | 获取所有类（含泛型信息） |

### 详细说明

#### `getVersion()`
获取 JVM 版本信息。

**返回值：**
- `protocolVersion`: JDWP 协议版本 (如 "1.8")
- `runtimeVersion`: JVM 版本
- `runtimeName`: JVM 名称
- `description`: 描述信息

#### `getIDSizes()`
获取各种 ID 的大小（内部使用，连接时自动调用）。

**返回值：**
- `fieldIDSize`: 字段 ID 大小
- `methodIDSize`: 方法 ID 大小
- `objectIDSize`: 对象 ID 大小
- `referenceTypeIDSize`: 引用类型 ID 大小
- `frameIDSize`: 栈帧 ID 大小

#### `getAllClasses()`
获取所有已加载的类。

**返回值：** `ClassInfo[]`
- `tag`: 类型标签
- `refID`: 引用类型 ID
- `status`: 类状态

#### `classByName(className: string)`
按类名查找类。

**参数：**
- `className`: 类签名 (如 "Ljava/lang/Object;")

**返回值：** `ClassInfo | null`

#### `suspendVM()` / `resumeVM()`
挂起/恢复整个虚拟机。

#### `exit(exitCode: number)`
退出虚拟机。

**参数：**
- `exitCode`: 退出码

#### `createString(str: string)`
在 VM 中创建字符串对象。

**参数：**
- `str`: 字符串内容

**返回值：** 字符串对象 ID (格式: "tag:id")

#### `getCapabilities()`
获取 VM 能力信息。

**返回值：** `Capabilities`
- `supportsVersion`: 支持版本查询
- `supportsThreads`: 支持线程操作
- `supportsStack`: 支持栈操作
- `supportsLocals`: 支持局部变量
- `supportsBreakpoints`: 支持断点
- `supportsSuspend`: 支持挂起
- `supportsResume`: 支持恢复
- `supportsStep`: 支持单步
- `supportsEvents`: 支持事件

#### `getCapabilitiesInfo()`
获取详细的 VM 能力信息。

**返回值：** `VMCapabilitiesInfo`
- `canWatchFieldModification`: 可监视字段修改
- `canWatchFieldAccess`: 可监视字段访问
- `canGetBytecodes`: 可获取字节码
- `canGetSyntheticAttribute`: 可获取合成属性
- `canGetOwnedMonitorInfo`: 可获取拥有的监视器信息
- `canGetCurrentContendedMonitor`: 可获取当前竞争监视器
- `canGetMonitorInfo`: 可获取监视器信息
- `canRedefineClasses`: 可重定义类
- `canAddMethod`: 可添加方法
- `canUnrestrictedlyRedefineClasses`: 可无限制重定义类
- `canPopFrames`: 可弹出栈帧
- `canUseInstanceFilters`: 可使用实例过滤器
- `canGetSourceDebugExtension`: 可获取源调试扩展
- `canRequestVMDeathEvent`: 可请求 VM 死亡事件
- `canSetDefaultStratum`: 可设置默认分层
- `canGetInstanceInfo`: 可获取实例信息
- `canRequestMonitorEvents`: 可请求监视器事件
- `canGetMonitorFrameInfo`: 可获取监视器帧信息
- `canGetConstantPool`: 可获取常量池
- `canSetNativeMethodPrefix`: 可设置本地方法前缀
- `canRedefineClassesWhenMismatched`: 可在类型不匹配时重定义类

#### `getClassPaths()`
获取类路径信息。

**返回值：**
- `classpath`: 类路径数组
- `bootClasspath`: 启动类路径数组

#### `holdEvents()` / `releaseEvents()`
暂停/恢复事件发送。

#### `redefineClasses(classes: ClassDef[])`
重定义类（热替换）。

**参数：**
- `classes`: 类定义数组
  - `refTypeID`: 引用类型 ID
  - `classBytes`: 新的类字节码

---

## ReferenceType 命令集 (2)

引用类型操作，用于查询类的结构信息。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Signature | 1 | `getSignature()` | 获取类签名 |
| ClassLoader | 2 | `getClassLoader()` | 获取类加载器 |
| Modifiers | 3 | - | 获取类修饰符 |
| Fields | 4 | `getFields()` | 获取类字段 |
| Methods | 5 | `getMethods()` | 获取类方法 |
| GetValues | 6 | `getStaticFieldValues()` | 获取静态字段值 |
| SourceFile | 7 | `getSourceFile()` | 获取源文件名 |
| NestedTypes | 8 | - | 获取嵌套类型 |
| Status | 9 | `getStatus()` | 获取类状态 |
| Interfaces | 10 | `getInterfaces()` | 获取实现的接口 |
| ClassObject | 11 | `getClassObject()` | 获取类对象 |
| SourceDebugExtension | 12 | - | 获取源调试扩展 |
| SignatureWithGeneric | 13 | - | 获取带泛型的签名 |
| FieldsWithGeneric | 14 | - | 获取带泛型的字段 |
| MethodsWithGeneric | 15 | - | 获取带泛型的方法 |
| Instances | 16 | `getInstances()` | 获取类实例 |
| ClassFileVersion | 17 | `getClassFileVersion()` | 获取类文件版本 |
| ConstantPool | 18 | - | 获取常量池 |
| SetValues | 19 | `setStaticFieldValue()` | 设置静态字段值 |

### 详细说明

#### `getSignature(refTypeID: string)`
获取类的签名。

**返回值：** 类签名字符串 (如 "Ljava/lang/Object;")

#### `getFields(refTypeID: string)`
获取类的所有字段。

**返回值：** `FieldInfo[]`
- `fieldID`: 字段 ID
- `name`: 字段名
- `signature`: 字段类型签名
- `modifiers`: 修饰符

#### `getMethods(refTypeID: string)`
获取类的所有方法。

**返回值：** `MethodInfo[]`
- `methodID`: 方法 ID
- `name`: 方法名
- `signature`: 方法签名
- `modifiers`: 修饰符

#### `getSourceFile(refTypeID: string)`
获取源文件名。

**返回值：** 源文件名 (如 "Object.java")

#### `getStaticFieldValues(refTypeID: string, fieldIDs: string[])`
获取静态字段值。

**参数：**
- `refTypeID`: 引用类型 ID
- `fieldIDs`: 字段 ID 数组

**返回值：** 值数组

#### `getValuesWithTags(refTypeID: string, fieldIDs: string[])`
获取静态字段值（带类型标签）。

**返回值：**
- `tags`: 类型标签数组
- `values`: 值数组

#### `setStaticFieldValue(refTypeID: string, fieldID: string, value: unknown)`
设置静态字段值。

**参数：**
- `refTypeID`: 引用类型 ID
- `fieldID`: 字段 ID
- `value`: 新值

#### `getStatus(refTypeID: string)`
获取类状态。

**返回值：** 状态码
- 1: Verified
- 2: Prepared
- 3: Initialized
- 4: Error

#### `getInterfaces(refTypeID: string)`
获取实现的接口。

**返回值：** 接口引用类型 ID 数组

#### `getClassObject(refTypeID: string)`
获取类对象。

**返回值：** 类对象 ID

#### `getInstances(refTypeID: string, maxInstances: number)`
获取类的实例。

**参数：**
- `refTypeID`: 引用类型 ID
- `maxInstances`: 最大实例数

**返回值：** 实例对象 ID 数组

#### `getClassFileVersion(refTypeID: string)`
获取类文件版本。

**返回值：**
- `majorVersion`: 主版本号
- `minorVersion`: 次版本号

#### `getClassLoader(refTypeID: string)`
获取类加载器。

**返回值：** 类加载器对象 ID

---

## ClassType 命令集 (3)

类类型操作，用于类继承和方法调用。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Superclass | 1 | `getSuperclass()` | 获取父类 |
| SetValues | 2 | `setStaticFieldValues()` | 设置静态字段值 |
| InvokeMethod | 3 | `invokeStaticMethod()` | 调用静态方法 |
| NewInstance | 4 | `newInstance()` | 创建新实例 |

### 详细说明

#### `getSuperclass(classID: string)`
获取父类。

**返回值：** 父类引用类型 ID

#### `setStaticFieldValues(classID: string, fieldValues: Map<string, unknown>)`
设置多个静态字段值。

**参数：**
- `classID`: 类 ID
- `fieldValues`: 字段 ID 到值的映射

#### `invokeStaticMethod(classID: string, threadID: string, methodID: string, args: unknown[], options: number)`
调用静态方法。

**参数：**
- `classID`: 类 ID
- `threadID`: 执行线程 ID
- `methodID`: 方法 ID
- `args`: 参数数组
- `options`: 调用选项

**返回值：**
- `returnValue`: 返回值
- `exception`: 异常对象 ID

#### `newInstance(classID: string, threadID: string, methodID: string, args: unknown[], options: number)`
创建新实例（调用构造函数）。

**参数：**
- `classID`: 类 ID
- `threadID`: 执行线程 ID
- `methodID`: 构造函数方法 ID
- `args`: 构造参数
- `options`: 调用选项

**返回值：**
- `newInstance`: 新实例对象 ID
- `exception`: 异常对象 ID

---

## Method 命令集 (5)

方法操作，用于获取方法的行号表和变量表。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| LineTable | 1 | `getLineTable()` | 获取行号表 |
| VariableTable | 2 | `getVariableTable()` | 获取变量表 |
| Bytecodes | 3 | `getBytecodes()` | 获取字节码 |
| IsObsolete | 4 | `isObsolete()` | 检查是否过时 |
| VariableTableWithGeneric | 5 | `getVariableTableWithGeneric()` | 获取带泛型的变量表 |

### 详细说明

#### `getLineTable(refTypeID: string, methodID: string)`
获取方法的行号映射表。

**返回值：** `LineLocation[]`
- `lineCodeIndex`: 代码索引
- `lineNumber`: 行号

#### `getVariableTable(refTypeID: string, methodID: string)`
获取方法的局部变量表。

**返回值：** `VariableInfo[]`
- `slot`: 槽位索引
- `name`: 变量名
- `signature`: 类型签名
- `codeIndex`: 代码索引

#### `getBytecodes(refTypeID: string, methodID: string)`
获取方法的字节码。

**返回值：** 字节码 Buffer

#### `isObsolete(refTypeID: string, methodID: string)`
检查方法是否过时（类重定义后）。

**返回值：** 布尔值

#### `getVariableTableWithGeneric(refTypeID: string, methodID: string)`
获取带泛型签名的变量表。

**返回值：** `VariableInfo[]`

---

## ObjectReference 命令集 (7)

对象引用操作，用于查询和操作对象实例。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| ReferenceType | 1 | `getReferenceType()` | 获取对象引用类型 |
| GetValues | 2 | `getInstanceFieldValues()` | 获取实例字段值 |
| SetValues | 3 | `setInstanceFieldValues()` | 设置实例字段值 |
| MonitorInfo | 5 | `getMonitorInfo()` | 获取监视器信息 |
| InvokeMethod | 6 | `invokeInstanceMethod()` | 调用实例方法 |
| DisableCollection | 7 | `disableCollection()` | 禁用 GC 收集 |
| EnableCollection | 8 | `enableCollection()` | 启用 GC 收集 |
| IsCollected | 9 | `isCollected()` | 检查是否被收集 |
| ReferringObjects | 10 | `getReferringObjects()` | 获取引用对象 |

### 详细说明

#### `getReferenceType(objectID: string)`
获取对象的引用类型。

**返回值：**
- `tag`: 类型标签
- `refTypeID`: 引用类型 ID

#### `getInstanceFieldValues(objectID: string, fieldIDs: string[])`
获取实例字段值。

**参数：**
- `objectID`: 对象 ID
- `fieldIDs`: 字段 ID 数组

**返回值：** 值数组

#### `setInstanceFieldValues(objectID: string, fieldValues: Map<string, unknown>)`
设置实例字段值。

**参数：**
- `objectID`: 对象 ID
- `fieldValues`: 字段 ID 到值的映射

#### `setInstanceFieldValue(objectID: string, fieldID: string, value: unknown)`
设置单个实例字段值。

#### `getMonitorInfo(objectID: string)`
获取对象的监视器信息。

**返回值：** `MonitorInfo`
- `owner`: 拥有者线程 ID
- `entryCount`: 进入次数
- `waiters`: 等待线程数组
- `waitersCount`: 等待线程数

#### `invokeInstanceMethod(objectID: string, threadID: string, methodID: string, args: unknown[], options: number)`
调用实例方法。

**参数：**
- `objectID`: 对象 ID
- `threadID`: 执行线程 ID
- `methodID`: 方法 ID
- `args`: 参数数组
- `options`: 调用选项

**返回值：**
- `returnValue`: 返回值
- `exception`: 异常对象 ID

#### `disableCollection(objectID: string)` / `enableCollection(objectID: string)`
禁用/启用对象的垃圾收集。

#### `isCollected(objectID: string)`
检查对象是否已被垃圾收集。

**返回值：** 布尔值

#### `getReferringObjects(objectID: string, maxReferrers: number)`
获取引用该对象的对象。

**参数：**
- `objectID`: 对象 ID
- `maxReferrers`: 最大引用数

**返回值：** 引用对象 ID 数组

---

## StringReference 命令集 (8)

字符串引用操作。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Value | 1 | `getStringValue()` | 获取字符串值 |

### 详细说明

#### `getStringValue(stringID: string)`
获取字符串对象的值。

**返回值：** 字符串内容

---

## ThreadReference 命令集 (11)

线程引用操作，用于线程管理和调试控制。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Name | 1 | `getThreadName()` | 获取线程名 |
| Suspend | 2 | `suspendThread()` | 挂起线程 |
| Resume | 3 | `resumeThread()` | 恢复线程 |
| Status | 4 | `getThreadStatus()` | 获取线程状态 |
| ThreadGroup | 5 | `getThreadGroup()` | 获取线程组 |
| Frames | 6 | `getThreadFrames()` | 获取线程栈帧 |
| FrameCount | 7 | `getThreadFrameCount()` | 获取栈帧数量 |
| OwnedMonitors | 8 | `getOwnedMonitors()` | 获取拥有的监视器 |
| CurrentContendedMonitor | 9 | `getCurrentContendedMonitor()` | 获取当前竞争监视器 |
| Stop | 10 | `stopThread()` | 停止线程 |
| Interrupt | 11 | `interruptThread()` | 中断线程 |
| SuspendCount | 12 | `getSuspendCount()` | 获取挂起计数 |
| ForceEarlyReturn | 14 | `forceEarlyReturn()` | 强制提前返回 |

### 详细说明

#### `getThreadName(threadID: string)`
获取线程名称。

**返回值：** 线程名

#### `getThreadStatus(threadID: string)`
获取线程状态。

**返回值：**
- `threadStatus`: 线程状态码
- `suspendStatus`: 挂起状态码

#### `getThreadState(threadID: string)`
获取线程状态字符串。

**返回值：** 状态字符串 ("running", "sleeping", "waiting" 等)

#### `suspendThread(threadID: string)` / `resumeThread(threadID: string)`
挂起/恢复线程。

#### `getThreadFrames(threadID: string, startFrame: number, length: number)`
获取线程的栈帧。

**参数：**
- `threadID`: 线程 ID
- `startFrame`: 起始帧索引
- `length`: 帧数量

**返回值：** `StackFrameInfo[]`
- `frameID`: 栈帧 ID
- `location`: 类 ID
- `method`: 方法 ID

#### `getThreadFrameCount(threadID: string)`
获取线程的栈帧数量。

**返回值：** 栈帧数量

#### `getThreadStack(threadID: string)`
获取线程的完整栈跟踪。

**返回值：** `StackFrame[]`
- `id`: 栈帧 ID
- `location`: 类 ID
- `method`: 方法 ID
- `line`: 行号
- `isNative`: 是否本地方法

#### `getThreadGroup(threadID: string)`
获取线程所属的线程组。

**返回值：** 线程组 ID

#### `getOwnedMonitors(threadID: string)`
获取线程拥有的监视器。

**返回值：** 监视器对象 ID 数组

#### `getCurrentContendedMonitor(threadID: string)`
获取线程当前竞争的监视器。

**返回值：** 监视器对象 ID

#### `stopThread(threadID: string, exceptionID: string)`
停止线程（抛出异常）。

**参数：**
- `threadID`: 线程 ID
- `exceptionID`: 异常对象 ID

#### `interruptThread(threadID: string)`
中断线程。

#### `getSuspendCount(threadID: string)`
获取线程的挂起计数。

**返回值：** 挂起次数

#### `forceEarlyReturn(threadID: string, frameID: string, value: unknown)`
强制方法提前返回。

**参数：**
- `threadID`: 线程 ID
- `frameID`: 栈帧 ID
- `value`: 返回值

---

## ThreadGroupReference 命令集 (12)

线程组引用操作。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Name | 1 | `getThreadGroupName()` | 获取线程组名 |
| Parent | 2 | `getParentThreadGroup()` | 获取父线程组 |
| Children | 3 | `getThreadGroupChildren()` | 获取子线程组和线程 |

### 详细说明

#### `getThreadGroupName(threadGroupID: string)`
获取线程组名称。

**返回值：** 线程组名

#### `getParentThreadGroup(threadGroupID: string)`
获取父线程组。

**返回值：** 父线程组 ID

#### `getThreadGroupChildren(threadGroupID: string)`
获取线程组的子线程组和线程。

**返回值：**
- `childGroups`: 子线程组 ID 数组
- `childThreads`: 子线程 ID 数组

---

## ArrayReference 命令集 (13)

数组引用操作。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Length | 1 | `getArrayLength()` | 获取数组长度 |
| GetValues | 2 | `getArrayValues()` | 获取数组元素 |
| SetValues | 3 | `setArrayValues()` | 设置数组元素 |

### 详细说明

#### `getArrayLength(arrayID: string)`
获取数组长度。

**返回值：** 数组长度

#### `getArrayValues(arrayID: string, startIndex: number, length: number)`
获取数组元素。

**参数：**
- `arrayID`: 数组 ID
- `startIndex`: 起始索引
- `length`: 元素数量

**返回值：** 元素值数组

#### `setArrayValues(arrayID: string, startIndex: number, values: unknown[])`
设置数组元素。

**参数：**
- `arrayID`: 数组 ID
- `startIndex`: 起始索引
- `values`: 新值数组

---

## ClassLoaderReference 命令集 (14)

类加载器引用操作。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| VisibleClasses | 1 | `getVisibleClasses()` | 获取可见类 |

### 详细说明

#### `getVisibleClasses(classLoaderID: string)`
获取类加载器可见的类。

**返回值：**
- `classes`: 类信息数组
  - `refTypeID`: 引用类型 ID
  - `typeTag`: 类型标签
  - `status`: 类状态

---

## EventRequest 命令集 (15)

事件请求操作，用于设置和管理调试事件。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Set | 1 | `setBreakpointRequest()` 等 | 设置事件请求 |
| Clear | 2 | `clearBreakpointRequest()` | 清除事件请求 |
| ClearAllBreakpoints | 3 | `clearAllBreakpoints()` | 清除所有断点 |

### 详细说明

#### `setBreakpointRequest(classID: string, methodID: string, codeIndex: bigint, suspendPolicy?: number)`
设置断点请求。

**参数：**
- `classID`: 类 ID
- `methodID`: 方法 ID
- `codeIndex`: 代码索引
- `suspendPolicy`: 挂起策略 (默认: EventThread)

**返回值：** 请求 ID

#### `clearBreakpointRequest(requestID: number)`
清除断点请求。

**参数：**
- `requestID`: 请求 ID

#### `clearAllBreakpoints()`
清除所有断点。

#### `setStepRequest(threadID: string, stepKind: number, suspendPolicy?: number)`
设置单步执行请求。

**参数：**
- `threadID`: 线程 ID
- `stepKind`: 单步类型 (Into=0, Over=1, Out=2)
- `suspendPolicy`: 挂起策略

**返回值：** 请求 ID

#### `setMethodRequest(eventType: number, classID: string, methodID: string, suspendPolicy?: number)`
设置方法进入/退出请求。

**参数：**
- `eventType`: 事件类型 (MethodEntry=40, MethodExit=41)
- `classID`: 类 ID
- `methodID`: 方法 ID
- `suspendPolicy`: 挂起策略

**返回值：** 请求 ID

#### `setExceptionRequest(exceptionRefTypeID: string | null, caught: boolean, uncaught: boolean, suspendPolicy?: number)`
设置异常断点请求。

**参数：**
- `exceptionRefTypeID`: 异常类 ID (null 表示所有异常)
- `caught`: 是否捕获已捕获异常
- `uncaught`: 是否捕获未捕获异常
- `suspendPolicy`: 挂起策略

**返回值：** 请求 ID

#### `setFieldRequest(eventType: number, declaring: string, fieldID: string, suspendPolicy?: number)`
设置字段访问/修改断点请求。

**参数：**
- `eventType`: 事件类型 (FieldAccess=11, FieldModification=12)
- `declaring`: 声明类 ID
- `fieldID`: 字段 ID
- `suspendPolicy`: 挂起策略

**返回值：** 请求 ID

#### `setClassRequest(eventType: number, classPattern: string, suspendPolicy?: number)`
设置类加载/卸载断点请求。

**参数：**
- `eventType`: 事件类型 (ClassLoad=10, ClassUnload=9)
- `classPattern`: 类名模式 (支持通配符如 "com.example.*")
- `suspendPolicy`: 挂起策略

**返回值：** 请求 ID

#### `setThreadRequest(eventType: number, threadID: string, suspendPolicy?: number)`
设置线程启动/死亡断点请求。

**参数：**
- `eventType`: 事件类型 (ThreadStart=6, ThreadDeath=7)
- `threadID`: 线程 ID
- `suspendPolicy`: 挂起策略

**返回值：** 请求 ID

#### `setClassPrepareRequest(suspendPolicy?: number)`
设置类准备事件请求。

**返回值：** 请求 ID

#### `setThreadStartRequest(suspendPolicy?: number)` / `setThreadDeathRequest(suspendPolicy?: number)`
设置线程启动/死亡事件请求。

**返回值：** 请求 ID

#### `parseEvent(data: Buffer, idSizes: IDSizes)`
解析事件数据。

**返回值：** `DebugEvent | null`
- `type`: 事件类型
- `threadId`: 线程 ID
- `location`: 位置
- `timestamp`: 时间戳
- `data`: 原始数据

---

## StackFrame 命令集 (16)

栈帧操作，用于检查和操作栈帧。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| GetValues | 1 | `getStackFrameValues()` | 获取栈帧变量 |
| SetValues | 2 | `setStackFrameValues()` | 设置栈帧变量 |
| ThisObject | 3 | `getThisObject()` | 获取 this 对象 |
| PopFrames | 4 | `popFrames()` | 弹出栈帧 |

### 详细说明

#### `getStackFrameValues(threadID: string, frameID: string, slots: number)`
获取栈帧的局部变量值。

**参数：**
- `threadID`: 线程 ID
- `frameID`: 栈帧 ID
- `slots`: 槽位数量

**返回值：** `Variable[]`
- `name`: 变量名
- `type`: 类型
- `value`: 值
- `isPrimitive`: 是否原始类型
- `isNull`: 是否为 null

#### `setStackFrameValues(threadID: string, frameID: string, values: Map<number, unknown>)`
设置栈帧变量值。

**参数：**
- `threadID`: 线程 ID
- `frameID`: 栈帧 ID
- `values`: 槽位到值的映射

#### `getThisObject(threadID: string, frameID: string)`
获取栈帧的 this 对象。

**返回值：**
- `tag`: 类型标签
- `objectID`: 对象 ID

#### `popFrames(threadID: string, frameID: string)`
弹出栈帧（回滚到指定帧）。

**参数：**
- `threadID`: 线程 ID
- `frameID`: 要弹出的帧 ID

---

## ClassObjectReference 命令集 (17)

类对象引用操作。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| ReflectedType | 1 | `getReflectedType()` | 获取反射类型 |

### 详细说明

#### `getReflectedType(classObjectID: string)`
获取类对象对应的引用类型。

**返回值：** 引用类型 ID

---

## ModuleReference 命令集 (18)

模块引用操作（Java 9+ 模块系统）。

| 命令 | 编号 | 函数 | 描述 |
|------|------|------|------|
| Name | 1 | `getModuleName()` | 获取模块名 |
| ClassLoader | 2 | `getModuleClassLoader()` | 获取模块类加载器 |

### 详细说明

#### `getModuleName(moduleID: string)`
获取模块名称。

**返回值：** 模块名

#### `getModuleClassLoader(moduleID: string)`
获取模块的类加载器。

**返回值：** 类加载器对象 ID

---

## 事件类型

| 事件类型 | 编号 | 描述 |
|----------|------|------|
| SingleStep | 1 | 单步执行 |
| Breakpoint | 2 | 断点命中 |
| FramePop | 3 | 栈帧弹出 |
| Exception | 4 | 异常抛出 |
| UserDefined | 5 | 用户定义 |
| ThreadStart | 6 | 线程启动 |
| ThreadDeath | 7 | 线程死亡 |
| ClassPrepare | 8 | 类准备完成 |
| ClassUnload | 9 | 类卸载 |
| ClassLoad | 10 | 类加载 |
| FieldAccess | 11 | 字段访问 |
| FieldModification | 12 | 字段修改 |
| VMStart | 13 | VM 启动 |
| VMDeath | 14 | VM 死亡 |
| VMDisconnected | 15 | VM 断开连接 |
| MethodEntry | 40 | 方法进入 |
| MethodExit | 41 | 方法退出 |

---

## 挂起策略

| 策略 | 值 | 描述 |
|------|-----|------|
| None | 0 | 不挂起任何线程 |
| EventThread | 1 | 挂起事件线程 |
| All | 2 | 挂起所有线程 |

---

## 单步执行类型

| 类型 | 值 | 描述 |
|------|-----|------|
| Into | 0 | 进入方法 |
| Over | 1 | 跳过方法 |
| Out | 2 | 跳出方法 |

---

## 线程状态

| 状态 | 值 | 描述 |
|------|-----|------|
| Zombie | 1 | 僵尸状态 |
| Running | 2 | 运行中 |
| Sleeping | 3 | 休眠 |
| Monitor | 4 | 等待监视器 |
| Wait | 5 | 等待 |
| NotStarted | 6 | 未启动 |
| Started | 7 | 已启动 |

---

## 高级 API (DebugProtocol 接口)

`JDWPClient` 实现了 `DebugProtocol` 接口，提供统一的调试 API：

### 生命周期

| 方法 | 描述 |
|------|------|
| `connect()` | 连接到目标 VM |
| `close()` | 关闭连接 |
| `isConnected()` | 检查连接状态 |

### 元数据

| 方法 | 描述 |
|------|------|
| `protocolName()` | 获取协议名称 ("jdwp") |
| `supportedLanguages()` | 获取支持的语言 |
| `version()` | 获取版本信息 |
| `capabilities()` | 获取能力信息 |

### 线程管理

| 方法 | 描述 |
|------|------|
| `threads(options?)` | 获取所有线程 |
| `stack(threadId, options?)` | 获取线程栈帧 |
| `threadState(threadId)` | 获取线程状态 |

### 执行控制

| 方法 | 描述 |
|------|------|
| `suspend(threadId?)` | 挂起线程或 VM |
| `resume(threadId?)` | 恢复线程或 VM |
| `stepInto(threadId)` | 单步进入 |
| `stepOver(threadId)` | 单步跳过 |
| `stepOut(threadId)` | 单步跳出 |

### 断点管理

| 方法 | 描述 |
|------|------|
| `setBreakpoint(location, condition?, type?)` | 设置断点 |
| `removeBreakpoint(id)` | 移除断点 |
| `clearBreakpoints()` | 清除所有断点 |
| `breakpoints()` | 获取所有断点 |

**断点类型：**
- `line`: 行断点 (默认)
- `method-entry`: 方法进入断点
- `method-exit`: 方法退出断点
- `exception`: 异常断点
- `field-access`: 字段访问断点
- `field-modify`: 字段修改断点
- `class-load`: 类加载断点
- `class-unload`: 类卸载断点
- `thread-start`: 线程启动断点
- `thread-death`: 线程死亡断点

### 变量检查

| 方法 | 描述 |
|------|------|
| `locals(threadId, frameIndex)` | 获取局部变量 |
| `fields(objectId)` | 获取对象字段 |
| `setField(objectId, fieldId, value)` | 设置字段值 |

### 事件处理

| 方法 | 描述 |
|------|------|
| `waitForEvent(timeout?)` | 等待事件 |

---

## 使用示例

### 基本连接和线程查询

```typescript
import { createClient } from 'cli-debugger';

const client = await createClient({ protocol: 'jdwp', port: 5005 });

// 获取版本信息
const version = await client.version();
console.log(`JVM: ${version.runtimeName} ${version.runtimeVersion}`);

// 获取所有线程
const threads = await client.threads();
for (const thread of threads) {
  console.log(`Thread: ${thread.name} (${thread.state})`);
}

await client.close();
```

### 断点设置和调试

```typescript
const client = await createClient({ protocol: 'jdwp', port: 5005 });

// 设置行断点
const bpId = await client.setBreakpoint('com.example.Main.main:42');

// 设置方法进入断点
const methodBpId = await client.setBreakpoint(
  'com.example.Main.process',
  undefined,
  'method-entry'
);

// 设置异常断点
const excBpId = await client.setBreakpoint('java.lang.NullPointerException');

// 等待断点命中
const event = await client.waitForEvent();
if (event?.type === 'breakpoint') {
  // 获取栈帧
  const frames = await client.stack(event.threadId);
  
  // 获取局部变量
  const locals = await client.locals(event.threadId, 0);
  console.log('Variables:', locals);
}

await client.close();
```

### 单步执行

```typescript
const client = await createClient({ protocol: 'jdwp', port: 5005 });

// 挂起线程
await client.suspend(threadId);

// 单步进入
await client.stepInto(threadId);

// 单步跳过
await client.stepOver(threadId);

// 单步跳出
await client.stepOut(threadId);

// 恢复线程
await client.resume(threadId);

await client.close();
```

---

## 相关文档

- [协议概述](./protocol-overview.md)
- [实现分析](./implementation-analysis.md)
- [线程管理](./thread-management.md)
- [最佳实践](./best-practices.md)
