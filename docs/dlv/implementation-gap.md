# Delve 协议实现差异分析

本文档对照 `docs/dlv` 目录的文档与 `src/protocol/dlv` 现有实现，分析缺失的功能。

## 一、执行控制功能（`api/debugger.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `continue` | `continueExecution()` | ✅ 已实现 |
| `next` | `next()` | ✅ 已实现 |
| `step` | `step()` | ✅ 已实现 |
| `stepout` | `stepOut()` | ✅ 已实现 |
| `halt` | `halt()` | ✅ 已实现 |
| `restart` | `restart()` | ✅ 已实现 |
| `rewind` | `rewind()` | ✅ 已实现 |
| `call` | `callFunction()` | ✅ 已实现 |
| `next-instruction` | `nextInstruction()` | ✅ 已实现 |
| `step-instruction` | `stepInstruction()` | ✅ 已实现 |
| `rebuild` | `rebuild()` (in `api/advanced.ts`) | ✅ 已实现 |

---

## 二、断点管理功能（`api/breakpoint.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `break` | `createBreakpoint()` | ✅ 已实现 |
| `breakpoints` | `listBreakpoints()` | ✅ 已实现 |
| `clear` | `clearBreakpoint()` | ✅ 已实现 |
| `clearall` | `clearAllBreakpoints()` | ✅ 已实现 |
| `condition` | `setBreakpointCondition()` | ✅ 已实现 |
| `toggle` | `toggleBreakpoint()` | ✅ 已实现 |
| `trace` | `createTracepoint()` | ✅ 已实现 |
| `watch` | `createWatchpoint()` | ✅ 已实现 |
| `on` | `setBreakpointCommand()` | ✅ 已实现 |

---

## 三、变量检查功能（`api/variable.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `locals` | `listLocalVars()` | ✅ 已实现 |
| `args` | `listFunctionArgs()` | ✅ 已实现 |
| `vars` | `listPackageVars()` | ✅ 已实现 |
| `print` | `evalExpr()` | ✅ 已实现 |
| `set` | `setVar()` | ✅ 已实现 |
| `whatis` | `getType()` | ✅ 已实现 |
| `examinemem` | `examineMemory()` | ✅ 已实现 |
| `regs` | `registers()` | ✅ 已实现 |
| `disassemble` | `disassemble()` | ✅ 已实现 |
| `display` | `addDisplay()`, `removeDisplay()`, `listDisplays()` | ✅ 已实现 |

---

## 四、协程管理功能（`api/goroutine.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `goroutines` | `listGoroutines()` | ✅ 已实现 |
| `goroutine` | `getGoroutine()` | ✅ 已实现 |
| 分组功能 | `listGoroutinesGrouped()` | ✅ 已实现 |
| 标签过滤 | `listGoroutinesWithLabel()` | ✅ 已实现 |
| 通道等待 | `listGoroutinesOnChannel()` | ✅ 已实现 |
| 运行中过滤 | `listRunningGoroutines()` | ✅ 已实现 |
| 用户协程过滤 | `listUserGoroutines()` | ✅ 已实现 |
| 协程标签 | `getGoroutineLabels()` | ✅ 已实现 |
| `-exec` 批量执行 | `execOnAllGoroutines()` | ✅ 已实现 |

---

## 五、栈操作功能（`api/stack.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `stack` | `stacktrace()` | ✅ 已实现 |
| `stack -full` | `stacktraceFull()` | ✅ 已实现 |
| `stack -defer` | `stacktraceWithDefers()` | ✅ 已实现 |
| 祖先栈 | `ancestorStacktrace()` | ✅ 已实现 |
| `frame` | `getFrame()` | ✅ 已实现 |
| `up` | `frameUp()` | ✅ 已实现 |
| `down` | `frameDown()` | ✅ 已实现 |
| `deferred` | `listDeferredCalls()` | ✅ 已实现 |
| `setFrame` | `setFrame()` | ✅ 已实现 |

---

## 六、高级功能（`api/advanced.ts` + `api/info.ts`）

| 文档命令 | 现有实现 | 状态 |
|----------|----------|------|
| `checkpoint` | `createCheckpoint()` | ✅ 已实现 |
| `checkpoints` | `listCheckpoints()` | ✅ 已实现 |
| `clear-checkpoint` | `clearCheckpoint()` | ✅ 已实现 |
| `config` | `getConfig()` / `setConfig()` | ✅ 已实现 |
| `dump` | `dumpCore()` | ✅ 已实现 |
| `edit` | `editSource()` | ✅ 已实现 |
| `list` | `listSource()` (in `api/info.ts`) | ✅ 已实现 |
| `source` | `sourceScript()` | ✅ 已实现 |
| `transcript` | `transcript()` | ✅ 已实现 |
| `funcs` | `listFunctions()` (in `api/info.ts`) | ✅ 已实现 |
| `packages` | `listPackages()` (in `api/info.ts`) | ✅ 已实现 |
| `sources` | `listSources()` (in `api/info.ts`) | ✅ 已实现 |
| `types` | `listTypes()` (in `api/info.ts`) | ✅ 已实现 |
| `libraries` | `listLibraries()` (in `api/info.ts`) | ✅ 已实现 |
| `target` | `getTarget()` | ✅ 已实现 |

---

## 七、类型定义（`types.ts`）

所有必需的类型定义均已补充完整：

| 类型 | 位置 | 状态 |
|------|------|------|
| `DlvDeferredCall` | `types.ts` | ✅ 已定义 |
| `DlvLibrary` | `types.ts` | ✅ 已定义 |
| `DlvCheckpoint` | `types.ts` | ✅ 已定义 |
| `DlvDebuggerConfig` | `api/advanced.ts` | ✅ 已定义 |
| `DlvTarget` | `api/advanced.ts` | ✅ 已定义 |
| `DlvDisplay` | `types.ts` | ✅ 已定义 |

---

## 八、`GoDebugExtension` 接口（`extension.ts`）

`GoDebugExtension` 接口已完整定义，包含所有 Go 特有扩展方法。该接口与 `DebugProtocol` 组合形成完整的 Go 调试支持。

---

## 总结

**所有文档中提及的功能均已实现。** Delve 协议实现现已完整覆盖：

1. **执行控制** - continue, step, next, stepout, halt, restart, rewind, call, 指令级单步
2. **断点管理** - 创建、删除、条件、切换、跟踪点、观察点、命中命令
3. **变量检查** - 局部变量、函数参数、包变量、表达式求值、类型查询、内存检查、寄存器、反汇编、自动显示
4. **协程管理** - 列表、过滤、分组、标签、批量执行
5. **栈操作** - 栈跟踪、帧导航、延迟调用、祖先栈
6. **高级功能** - 检查点、配置、核心转储、重建、编辑器集成、脚本执行、会话记录
7. **信息查询** - 函数、包、源文件、类型、动态库列表
