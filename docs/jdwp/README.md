# JDWP 文档索引

本目录包含 JDWP (Java Debug Wire Protocol) 相关的技术文档，用于指导 cli-debugger 项目的开发和调试。

## 文档列表

### 1. [协议概述](./protocol-overview.md)

JDWP 协议的基础知识，包括：
- 协议架构和核心概念
- 命令集和数据包格式
- ID 类型和线程状态
- 挂起机制和事件机制
- 常见错误码

**适合**: 初次了解 JDWP 协议的开发者

### 2. [线程管理](./thread-management.md)

JDWP 线程管理的详细说明，包括：
- 线程生命周期和状态
- 挂起机制深入分析
- 获取栈帧的前提条件
- 正确的调试流程
- 常见陷阱和最佳实践

**适合**: 需要理解线程挂起和栈帧获取机制的开发者

### 3. [实现问题分析](./implementation-analysis.md)

当前 cli-debugger 实现的问题分析，包括：
- 代码层面的问题
- 架构层面的问题
- 测试层面的问题
- 修复建议和优先级

**适合**: 需要修复现有问题的开发者

### 4. [测试失败分析](./test-failures-analysis.md)

E2E 测试失败的根因分析，包括：
- 失败测试的详细分析
- 时间线和问题流程
- 修复方案和验证方法
- 修复优先级

**适合**: 需要理解测试失败原因的开发者

### 5. [最佳实践](./best-practices.md)

JDWP 调试的最佳实践，包括：
- 连接管理
- 线程管理
- 栈帧操作
- 断点管理
- 单步调试
- 事件处理
- 错误处理
- 性能优化

**适合**: 使用 JDWP API 进行开发的开发者

## 快速导航

### 我想了解...

- **JDWP 协议基础** → [协议概述](./protocol-overview.md)
- **如何正确挂起线程** → [线程管理](./thread-management.md)
- **为什么测试失败** → [测试失败分析](./test-failures-analysis.md)
- **如何修复现有问题** → [实现问题分析](./implementation-analysis.md)
- **如何正确使用 API** → [最佳实践](./best-practices.md)

### 我想解决...

- **堆栈跟踪返回空数组** → [测试失败分析](./test-failures-analysis.md#1-堆栈跟踪返回空数组)
- **连接被拒绝** → [测试失败分析](./test-failures-analysis.md#2-连接被拒绝)
- **Hook 超时** → [测试失败分析](./test-failures-analysis.md#3-hook-超时)
- **threads() 方法问题** → [实现问题分析](./implementation-analysis.md#问题-1-threads-方法的设计缺陷)

## 核心问题总结

### 根本原因

测试失败的根本原因是 **API 设计与使用模式不匹配**：

1. `threads()` 方法自动恢复 VM，破坏了调用者的预期
2. 测试代码假设获取线程后线程仍然挂起，但实际上已经恢复
3. 线程在恢复后继续执行，导致获取栈帧时状态不正确

### 关键修复

1. **修改 `threads()` 方法**: 添加 `keepSuspended` 选项，让调用者控制挂起状态
2. **修改测试代码**: 正确处理挂起状态，在获取线程后保持 VM 挂起
3. **改进错误处理**: 提供更清晰的错误消息和自动恢复选项

### 推荐的调试流程

```typescript
// 正确方式: 使用 keepSuspended 保持挂起
const threads = await client.threads({ keepSuspended: true });
const stack = await client.stack(threadId);
await client.resume();

// 或者: 先挂起，再获取
await client.suspend();
const threads = await client.threads();
const stack = await client.stack(threadId);
await client.resume();
```

## 参考资源

### 官方文档

- [JDWP Specification](https://docs.oracle.com/javase/specs/jvms/se11/html/jvms-4.html)
- [JPDA Overview](https://docs.oracle.com/javase/11/docs/api/jdk.jdi/module-summary.html)
- [JDI API](https://docs.oracle.com/javase/11/docs/api/jdk.jdi/com/sun/jdi/package-summary.html)

### 项目文档

- [JDWP 命令速查](../JDWP调试器命令及参数.md)
- [Java 远程调试](../java远程调试.md)
- [设计文档](../design/ts-implementation.md)
