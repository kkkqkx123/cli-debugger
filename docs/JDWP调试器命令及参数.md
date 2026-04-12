JDWP（Java Debug Wire Protocol）是调试器与目标JVM之间的通信协议，按**命令集（Command Set）** 分组，每个命令集包含多个命令，每个命令有固定的输入/输出参数与错误码。以下按命令集整理核心命令、参数与用途。

---

## 一、JDWP 启动参数（JVM 配置）
用于开启JVM调试能力，格式：`-agentlib:jdwp=key1=value1,key2=value2,...`（JDK5+）。

| 参数 | 取值 | 说明 |
|---|---|---|
| transport | dt_socket / dt_shmem | 通信方式：socket（跨机器）/ 共享内存（仅Windows本地） |
| server | y / n | y=JVM作为服务端等待调试器连接；n=主动连接调试器 |
| suspend | y / n | y=启动时挂起等待调试器；n=直接启动 |
| address | host:port | 监听/连接地址，如 `0.0.0.0:8000` |
| onthrow | 异常类名 | 抛出指定异常时才初始化JDWP |
| onuncaught | y / n | 未捕获异常时触发调试 |
| launch | 命令 | 事件触发时启动调试器进程 |

示例：
```bash
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=8000 -jar app.jar
```

---

## 二、JDWP 核心命令集与命令（按功能分组）
### 1. VirtualMachine（命令集 1）：虚拟机级操作
| 命令ID | 命令名 | 输入参数 | 输出/返回 | 用途 |
|---|---|---|---|---|
| 1 | Version | 无 | description, jdwpMajor, jdwpMinor, vmVersion, vmName | 获取JDWP与JVM版本 |
| 2 | ClassesBySignature | signature（类签名） | 匹配的referenceTypeID列表 | 按签名查类 |
| 3 | AllClasses | 无 | 所有已加载类的referenceTypeID | 枚举所有类 |
| 4 | AllThreads | 无 | 所有存活线程的threadID | 枚举所有线程 |
| 5 | TopLevelThreadGroups | 无 | 顶层线程组ID | 获取顶层线程组 |
| 6 | Dispose | 无 | 无 | 关闭调试连接 |
| 7 | IDSizes | 无 | objectID/fieldID/methodID等的字节长度 | 获取ID类型大小 |
| 8 | Suspend | 无 | 无 | 挂起整个VM |
| 9 | Resume | 无 | 无 | 恢复整个VM |
| 10 | Exit | exitCode（int） | 无 | 让目标VM退出 |
| 11 | CreateString | string（UTF-8） | stringID | 在目标VM创建字符串 |
| 12 | Capabilities | 无 | 布尔能力集（如是否支持字段监控） | 查询VM调试能力 |
| 13 | ClassPaths | 无 | classpath, bootclasspath | 获取类路径 |
| 15 | HoldEvents | 无 | 无 | 暂停发送事件 |
| 16 | ReleaseEvents | 无 | 无 | 恢复发送事件 |
| 18 | RedefineClasses | 类数+[refTypeID, classBytes] | 无 | 热替换类定义 |

### 2. ReferenceType（命令集 2）：类/接口/数组类型信息
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | Signature | refTypeID | 类签名（如Ljava/lang/String;） | 获取类签名 |
| 4 | Fields | refTypeID | 字段ID、修饰符、名称、签名 | 枚举类字段 |
| 5 | Methods | refTypeID | 方法ID、修饰符、名称、签名 | 枚举类方法 |
| 6 | GetValues | refTypeID, 字段数+fieldID | 字段值列表 | 获取静态字段值 |
| 7 | SourceFile | refTypeID | 源文件名 | 获取类对应源码文件 |
| 16 | Instances | refTypeID, maxInstances | 实例对象ID列表 | 获取类的实例 |
| 17 | ClassFileVersion | refTypeID | major, minor | 获取类文件版本 |

### 3. ClassType（命令集 3）：类类型专用命令
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | Superclass | classID | 父类referenceTypeID | 获取父类 |
| 2 | SetValues | classID, 字段数+[fieldID, value] | 无 | 设置静态字段值 |
| 3 | InvokeMethod | classID, threadID, methodID, 参数数+value, options | 返回值+异常 | 调用静态方法 |
| 4 | NewInstance | classID, threadID, methodID, 参数数+value, options | 对象ID+异常 | 创建类实例 |

### 4. Method（命令集 6）：方法信息
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | LineTable | refTypeID, methodID | 行号-代码索引映射 | 获取方法行号表 |
| 2 | VariableTable | refTypeID, methodID | 局部变量信息（名称、槽位、签名） | 获取局部变量表 |
| 3 | Bytecodes | refTypeID, methodID | 字节码数组 | 获取方法字节码 |
| 5 | VariableTableWithGeneric | refTypeID, methodID | 带泛型的变量表 | 泛型方法变量信息 |

### 5. ObjectReference（命令集 9）：对象操作
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | ReferenceType | objectID | 对象的referenceTypeID | 获取对象类型 |
| 2 | GetValues | objectID, 字段数+fieldID | 字段值列表 | 获取实例字段值 |
| 3 | SetValues | objectID, 字段数+[fieldID, value] | 无 | 设置实例字段值 |
| 5 | MonitorInfo | objectID | 持有线程、等待线程等 | 获取对象锁信息 |
| 6 | InvokeMethod | objectID, threadID, methodID, 参数, options | 返回值+异常 | 调用实例方法 |
| 7 | DisableCollection | objectID | 无 | 禁止对象被GC |
| 8 | EnableCollection | objectID | 无 | 允许对象被GC |
| 10 | ReferringObjects | objectID, maxReferrers | 引用该对象的对象列表 | 查找对象引用者 |

### 6. ThreadReference（命令集 11）：线程操作
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | Name | threadID | 线程名 | 获取线程名称 |
| 2 | Suspend | threadID | 无 | 挂起单个线程 |
| 3 | Resume | threadID | 无 | 恢复单个线程 |
| 4 | Status | threadID | threadStatus, suspendStatus | 获取线程状态 |
| 6 | Frames | threadID, startFrame, length | 栈帧ID+位置 | 获取线程栈帧 |
| 7 | FrameCount | threadID | 栈帧总数 | 获取栈深度 |
| 8 | OwnedMonitors | threadID | 持有的锁对象ID | 获取线程持有的锁 |
| 14 | ForceEarlyReturn | threadID, frameID, value | 无 | 强制方法提前返回 |

### 7. EventRequest（命令集 15）：事件订阅
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | Set | eventKind, suspendPolicy, 过滤器数+过滤器 | requestID | 创建事件请求（断点/异常/单步） |
| 2 | Clear | eventKind, requestID | 无 | 清除指定事件 |
| 3 | ClearAllBreakpoints | 无 | 无 | 清除所有断点 |

### 8. StackFrame（命令集 16）：栈帧操作
| 命令ID | 命令名 | 输入参数 | 输出 | 用途 |
|---|---|---|---|---|
| 1 | GetValues | frameID, 变量数+slot | 变量值 | 获取栈帧局部变量 |
| 2 | SetValues | frameID, 变量数+[slot, value] | 无 | 设置局部变量 |
| 3 | ThisObject | frameID | this对象ID | 获取this对象 |
| 4 | PopFrames | threadID, frameID | 无 | 弹出栈帧（回退执行） |

### 9. 其他常用命令集
- **StringReference（10）**：`Value`（获取字符串内容）
- **ArrayReference（13）**：`Length`（数组长度）、`GetValues`（数组元素）、`SetValues`（设置数组元素）
- **ClassLoaderReference（14）**：`VisibleClasses`（类加载器可见的类）
- **ModuleReference（18）**：`Name`、`ClassLoader`（模块信息）
- **Event（64）**：`Composite`（事件复合包，VM主动发送）

---

## 三、JDWP 数据包格式（命令/应答）
### 1. 命令包（Command Packet）
```
[4字节长度][4字节ID][1字节标志][1字节命令集][1字节命令][数据]
```
- 标志：0x80=应答包；0=命令包
- 命令集：0–63=调试器→VM；64–127=VM→调试器

### 2. 应答包（Reply Packet）
```
[4字节长度][4字节ID][1字节标志][2字节错误码][数据]
```
- 错误码：0=成功；非0=失败（如`INVALID_THREAD`、`VM_DEAD`）

### 3. 常用数据类型
- `objectID`/`threadID`/`referenceTypeID`：VM定义，最大8字节
- `location`：类型标记+classID+methodID+代码索引（定位代码行）
- `value`：类型标记+值（基本类型/对象ID）

---

## 四、常见错误码（部分）
- `VM_DEAD`（100）：VM未运行
- `INVALID_THREAD`（101）：无效线程ID
- `INVALID_OBJECT`（202）：无效对象ID
- `THREAD_NOT_SUSPENDED`（503）：线程未挂起
- `NOT_IMPLEMENTED`（99）：命令未实现

---

## 五、jdb 常用调试命令（基于 JDWP）
| 命令 | 作用 |
|---|---|
| `stop at Class:line` | 设置行断点 |
| `stop in Class.method` | 设置方法断点 |
| `cont` | 继续执行 |
| `step` | 单步进入 |
| `next` | 单步跳过 |
| `locals` | 查看局部变量 |
| `print var` | 打印变量值 |
| `threads` | 列出线程 |
| `thread threadID` | 切换线程 |

---

需要我把以上命令整理成一份可直接复制的**JDWP命令速查表**（含命令集/ID/参数/用途）吗？