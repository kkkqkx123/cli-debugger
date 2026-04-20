# LLDB 使用指南

## 环境要求

### 必需环境

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Python | >= 3.10 | LLDB Python 绑定要求 |
| LLDB | 系统自带或独立安装 | 需要包含 Python 绑定 |
| Node.js | >= 22.0.0 | cli-debugger 基础要求 |

### 环境检测

使用前可以检测环境是否满足要求：

```typescript
import { checkLLDBEnvironment } from 'cli-debugger/protocol';

const env = await checkLLDBEnvironment();
if (!env.available) {
  console.error(`LLDB not available: ${env.error}`);
  process.exit(1);
}

console.log(`Python: ${env.pythonVersion}`);
console.log(`LLDB: ${env.lldbVersion}`);
```

### 各平台安装

#### macOS

macOS 自带 LLDB 和 Python 绑定：

```bash
# 验证环境
python3 -c "import lldb; print(lldb.SBDebugger.Create().GetVersionString())"
```

#### Linux

```bash
# Ubuntu/Debian
sudo apt-get install lldb python3-lldb

# Fedora
sudo dnf install lldb python3-lldb

# Arch Linux
sudo pacman -S lldb
```

#### Windows

```bash
# 通过 LLVM 安装
# 下载 LLVM installer: https://releases.llvm.org/
# 确保选择 "LLDB" 和 "Python bindings" 组件
```

## 基本使用

### CLI 使用

```bash
# 启动并调试程序
debugger --protocol lldb --target ./myapp threads

# 附加到运行中的进程
debugger --protocol lldb --target ./myapp --attach-pid 12345 threads

# 分析 core dump
debugger --protocol lldb --target ./myapp --core-file ./core.12345 stack --thread-id 1

# 设置断点
debugger --protocol lldb --target ./myapp breakpoint set --location main.c:42

# JSON 输出
debugger --protocol lldb --target ./myapp --json threads
```

### 程序化 API 使用

#### 基本调试流程

```typescript
import { createClient } from 'cli-debugger';

// 创建客户端并连接
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
});

// 获取版本信息
const version = await client.version();
console.log(`LLDB version: ${version.runtimeVersion}`);

// 获取线程列表
const threads = await client.threads();
console.log(`Found ${threads.length} threads`);

// 设置断点
const bpId = await client.setBreakpoint('main.c:42');

// 继续执行
await client.resume();

// 等待断点命中
const event = await client.waitForEvent();
if (event?.type === 'breakpoint') {
  console.log(`Hit breakpoint at ${event.location}`);

  // 获取调用栈
  const stack = await client.stack(event.threadId);
  for (const frame of stack) {
    console.log(`  ${frame.method} at ${frame.location}`);
  }

  // 获取局部变量
  const locals = await client.locals(event.threadId, 0);
  for (const v of locals) {
    console.log(`  ${v.name}: ${v.value}`);
  }
}

// 清理
await client.close();
```

#### 附加到运行中的进程

```typescript
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
  attachPid: 12345,  // 已运行进程的 PID
});

// 现在可以检查进程状态
const threads = await client.threads();
// ...

await client.close();
```

#### 分析 Core Dump

```typescript
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
  coreFile: '/path/to/core.12345',
});

// 检查崩溃时的状态
const threads = await client.threads();
const crashedThread = threads.find(t => t.state === 'crashed');

if (crashedThread) {
  const stack = await client.stack(crashedThread.id);
  console.log('Crash backtrace:');
  for (const frame of stack) {
    console.log(`  ${frame.location} - ${frame.method}`);
  }
}

await client.close();
```

#### 启动参数和环境变量

```typescript
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
  launchArgs: ['--config', 'config.json', '--verbose'],
  env: {
    MY_VAR: 'value',
    PATH: '/custom/path:' + process.env.PATH,
  },
  workingDir: '/custom/working/directory',
  stopAtEntry: true,  // 在程序入口停止
});
```

## DSL 使用

```typescript
import { DebugDSL } from 'cli-debugger';

const dsl = new DebugDSL({
  protocol: 'lldb',
  target: '/path/to/myapp',
});

await dsl.run(async (debug) => {
  await debug
    .thread('main')
    .suspend()
    .breakpointAt('main.c', 42)
    .inspectVariables()
    .resume();
});
```

## 支持的语言

LLDB 支持以下语言的调试：

| 语言 | 支持程度 |
|------|----------|
| C | 完整支持 |
| C++ | 完整支持 |
| Objective-C | 完整支持 (macOS) |
| Swift | 完整支持 (macOS) |
| Rust | 完整支持 (需要 DWARF 调试信息) |

## 高级功能

### 表达式求值

```typescript
// 在当前上下文求值
const result = await client.eval('x + y');
console.log(`x + y = ${result.value}`);

// 在指定线程和栈帧求值
const result2 = await client.eval('obj->field', threadId, 0);
```

### 条件断点

```typescript
// 设置条件断点
await client.setBreakpoint('main.c:100', 'x > 10');
```

### 变量修改

```typescript
// 修改变量值
await client.setField('threadId:frameIndex:varName', 'field', 42);
```

## 配置选项

### 完整配置示例

```typescript
const config = {
  // 协议类型
  protocol: 'lldb',

  // 目标程序路径 (必需)
  target: '/path/to/executable',

  // Core dump 文件 (可选)
  coreFile: '/path/to/core.dump',

  // 附加到进程 PID (可选)
  attachPid: 12345,

  // 等待进程启动 (可选)
  waitFor: false,

  // Python 解释器路径 (可选，默认 'python3')
  pythonPath: '/usr/bin/python3',

  // 超时时间 (毫秒，默认 30000)
  timeout: 60000,

  // 启动参数 (可选)
  launchArgs: ['--arg1', '--arg2'],

  // 环境变量 (可选)
  env: {
    CUSTOM_VAR: 'value',
  },

  // 工作目录 (可选)
  workingDir: '/custom/dir',

  // 在入口点停止 (可选，默认 false)
  stopAtEntry: false,
};
```

### 环境变量

可以通过环境变量配置默认值：

| 环境变量 | 说明 |
|----------|------|
| `DEBUGGER_PROTOCOL` | 默认协议 |
| `DEBUGGER_TARGET` | 默认目标程序 |
| `DEBUGGER_PYTHON_PATH` | Python 解释器路径 |
| `DEBUGGER_TIMEOUT` | 默认超时时间 |

## 故障排除

### Python 模块未找到

```
Error: lldb Python module not found
```

**解决方案**：
- 确保 LLDB 已安装
- 确保 Python 绑定已安装
- 检查 `pythonPath` 配置是否正确

### 连接超时

```
Error: Request connect timed out
```

**解决方案**：
- 检查目标程序是否存在
- 增加 `timeout` 配置值
- 检查 Python 进程是否正常启动

### 断点设置失败

```
Error: Failed to create breakpoint at main.c:100
```

**解决方案**：
- 确保目标程序包含调试信息 (使用 `-g` 编译)
- 检查文件路径和行号是否正确
- 对于优化后的代码，断点可能无法精确设置

### 变量不可见

```
Error: Variable x not found
```

**解决方案**：
- 确保使用 `-g` 编译以包含调试信息
- 变量可能被优化器优化掉
- 检查当前栈帧是否正确
