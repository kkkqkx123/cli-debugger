# LLDB 协议集成设计文档

## 概述

本文档描述如何将 LLDB 调试器集成到 `cli-debugger` 项目中。LLDB 通过 Python 3.10 API 绑定提供调试能力，本设计采用子进程桥接方案实现 TypeScript 与 Python LLDB API 的通信。

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    cli-debugger (TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│  src/protocol/lldb/                                         │
│  ├── index.ts          # 模块导出                           │
│  ├── client.ts         # LLDBClient (实现 DebugProtocol)    │
│  ├── bridge.ts         # Python 子进程桥接管理              │
│  ├── types.ts          # LLDB 特有类型定义                  │
│  └── scripts/          # Python 桥接脚本                    │
│      └── lldb_bridge.py                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ JSON-RPC over stdio
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python 3.10 + LLDB                          │
├─────────────────────────────────────────────────────────────┤
│  lldb_bridge.py                                             │
│  ├── JSON 命令解析                                          │
│  ├── LLDB SBDebugger API 调用                               │
│  └── JSON 结果输出                                          │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
src/protocol/lldb/
├── index.ts                    # 模块导出，注册协议
├── client.ts                   # LLDBClient 实现
├── bridge.ts                   # Python 子进程通信桥接
├── types.ts                    # LLDB 特有类型定义
├── protocol.ts                 # 通信协议定义 (请求/响应格式)
└── scripts/
    └── lldb_bridge.py          # Python LLDB 桥接脚本
```

## 通信协议

### JSON-RPC 风格消息格式

**请求格式**：
```json
{
  "id": 1,
  "method": "connect",
  "params": {
    "target": "/path/to/binary",
    "coreFile": null
  }
}
```

**响应格式**：
```json
{
  "id": 1,
  "result": {
    "success": true,
    "targetId": "target_0"
  }
}
```

**错误响应格式**：
```json
{
  "id": 1,
  "error": {
    "code": "CONNECTION_FAILED",
    "message": "Failed to create target"
  }
}
```

### 支持的方法列表

| 方法 | 参数 | 说明 |
|------|------|------|
| `connect` | `{ target, coreFile?, waitFor?: boolean }` | 连接调试目标 |
| `disconnect` | `{}` | 断开连接 |
| `version` | `{}` | 获取 LLDB 版本信息 |
| `threads` | `{}` | 获取所有线程 |
| `threadState` | `{ threadId }` | 获取线程状态 |
| `stack` | `{ threadId, depth? }` | 获取调用栈 |
| `suspend` | `{ threadId? }` | 暂停执行 |
| `resume` | `{ threadId? }` | 继续执行 |
| `stepInto` | `{ threadId }` | 单步进入 |
| `stepOver` | `{ threadId }` | 单步跳过 |
| `stepOut` | `{ threadId }` | 单步跳出 |
| `setBreakpoint` | `{ location, condition? }` | 设置断点 |
| `removeBreakpoint` | `{ id }` | 移除断点 |
| `clearBreakpoints` | `{}` | 清除所有断点 |
| `breakpoints` | `{}` | 获取断点列表 |
| `locals` | `{ threadId, frameIndex }` | 获取局部变量 |
| `fields` | `{ objectId }` | 获取对象字段 |
| `setField` | `{ objectId, fieldId, value }` | 设置字段值 |
| `eval` | `{ expression, threadId?, frameIndex? }` | 求值表达式 |
| `waitForEvent` | `{ timeout? }` | 等待事件 |

## TypeScript 实现

### bridge.ts - Python 子进程桥接

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import { APIError, ErrorType, ErrorCodes } from '../errors.js';

interface BridgeRequest {
  id: number;
  method: string;
  params: unknown;
}

interface BridgeResponse {
  id: number;
  result?: unknown;
  error?: { code: string; message: string };
}

export class LLDBBridge {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';

  async start(pythonPath: string, scriptPath: string): Promise<void> {
    this.process = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data) => this.handleData(data));
    this.process.stderr?.on('data', (data) => this.handleError(data));
  }

  async call<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.requestId;
    const request: BridgeRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    this.processBuffer();
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response: BridgeResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new APIError(
              ErrorType.ProtocolError,
              ErrorCodes.CommandFailed,
              response.error.message
            ));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

### client.ts - LLDBClient 实现

```typescript
import type { DebugProtocol } from '../base.js';
import type { DebugConfig } from '../../types/config.js';
import { LLDBBridge } from './bridge.js';

export class LLDBClient implements DebugProtocol {
  private config: DebugConfig;
  private bridge: LLDBBridge;
  private connected = false;

  constructor(config: DebugConfig) {
    this.config = config;
    this.bridge = new LLDBBridge();
  }

  async connect(): Promise<void> {
    // 启动 Python 桥接进程
    await this.bridge.start(
      this.config.pythonPath ?? 'python3',
      this.getScriptPath()
    );

    // 连接调试目标
    await this.bridge.call('connect', {
      target: this.config.target,
      coreFile: this.config.coreFile,
    });

    this.connected = true;
  }

  async threads(): Promise<ThreadInfo[]> {
    return this.bridge.call<ThreadInfo[]>('threads', {});
  }

  async stack(threadId: string): Promise<StackFrame[]> {
    return this.bridge.call<StackFrame[]>('stack', { threadId });
  }

  // ... 其他 DebugProtocol 方法实现
}
```

## Python 桥接脚本

### lldb_bridge.py

```python
#!/usr/bin/env python3
"""
LLDB Bridge Script
Provides JSON-RPC interface to LLDB Python API
"""

import lldb
import json
import sys
import threading

class LLDBBridge:
    def __init__(self):
        self.debugger = lldb.SBDebugger.Create()
        self.target = None
        self.process = None
        self.listener = lldb.SBListener("bridge_listener")

    def handle_connect(self, params):
        target_path = params.get('target')
        core_file = params.get('coreFile')

        if core_file:
            # Core dump 模式
            error = lldb.SBError()
            self.target = self.debugger.CreateTargetWithFileAndCore(
                target_path, core_file, None, False, error
            )
        else:
            # 正常调试模式
            error = lldb.SBError()
            self.target = self.debugger.CreateTarget(
                target_path, None, None, False, error
            )

        if not self.target or error.Fail():
            return {'success': False, 'error': str(error)}

        return {'success': True, 'targetId': str(self.target)}

    def handle_threads(self, params):
        if not self.process:
            return []

        threads = []
        for i in range(self.process.GetNumThreads()):
            thread = self.process.GetThreadAtIndex(i)
            threads.append({
                'id': thread.GetThreadID(),
                'name': thread.GetName() or f'thread-{i}',
                'state': self._get_thread_state(thread),
                'stopReason': self._get_stop_reason(thread),
            })
        return threads

    def handle_stack(self, params):
        thread_id = params.get('threadId')
        thread = self._get_thread_by_id(thread_id)
        if not thread:
            return []

        frames = []
        for i in range(thread.GetNumFrames()):
            frame = thread.GetFrameAtIndex(i)
            frames.append({
                'id': i,
                'location': f"{frame.GetFileSpec().filename}:{frame.GetLine()}",
                'method': frame.GetFunctionName() or '<unknown>',
                'line': frame.GetLine(),
            })
        return frames

    def handle_set_breakpoint(self, params):
        location = params.get('location')
        condition = params.get('condition')

        # 解析 location: "file:line" 或 "function"
        if ':' in location:
            file, line = location.rsplit(':', 1)
            bp = self.target.BreakpointCreateByLocation(file, int(line))
        else:
            bp = self.target.BreakpointCreateByName(location)

        if condition:
            bp.SetCondition(condition)

        return {
            'id': bp.GetID(),
            'location': location,
            'enabled': bp.IsEnabled(),
        }

    # ... 其他方法实现

    def _get_thread_state(self, thread):
        state_map = {
            lldb.eStateStopped: 'stopped',
            lldb.eStateRunning: 'running',
            lldb.eStateSuspended: 'suspended',
            lldb.eStateExited: 'exited',
        }
        return state_map.get(thread.GetState(), 'unknown')

    def run(self):
        """Main loop: read JSON commands from stdin"""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                method = request.get('method')
                params = request.get('params', {})

                handler = getattr(self, f'handle_{method}', None)
                if handler:
                    result = handler(params)
                    self._send_response(request['id'], result)
                else:
                    self._send_error(request['id'], 'UNKNOWN_METHOD', f'Unknown method: {method}')
            except Exception as e:
                self._send_error(request.get('id', 0), 'INTERNAL_ERROR', str(e))

    def _send_response(self, req_id, result):
        response = {'id': req_id, 'result': result}
        print(json.dumps(response), flush=True)

    def _send_error(self, req_id, code, message):
        response = {'id': req_id, 'error': {'code': code, 'message': message}}
        print(json.dumps(response), flush=True)


if __name__ == '__main__':
    bridge = LLDBBridge()
    bridge.run()
```

## 配置扩展

### DebugConfig 扩展

```typescript
// src/types/config.ts

export const LLDBConfigSchema = DebugConfigSchema.extend({
  protocol: z.literal('lldb'),
  target: z.string().min(1),           // 调试目标路径
  coreFile: z.string().optional(),     // Core dump 文件
  pythonPath: z.string().optional(),   // Python 解释器路径
  waitFor: z.boolean().default(false), // 等待进程附加
  attachPid: z.number().optional(),    // 附加到已运行进程
});

export type LLDBConfig = z.infer<typeof LLDBConfigSchema>;
```

### 使用示例

```typescript
// 连接本地程序
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
});

// Core dump 分析
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
  coreFile: '/path/to/core.dump',
});

// 附加到运行中的进程
const client = await createClient({
  protocol: 'lldb',
  target: '/path/to/myapp',
  attachPid: 12345,
});
```

## 协议注册

```typescript
// src/protocol/lldb/index.ts

export { LLDBClient } from './client.js';
export * as lldb from './types.js';

// src/protocol/index.ts (添加)
import { LLDBClient } from './lldb/client.js';
registerProtocol('lldb', (config) => new LLDBClient(config));
```

## 环境要求

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Python | >= 3.10 | LLDB Python 绑定要求 |
| LLDB | 系统自带或独立安装 | 需要包含 Python 绑定 |
| Node.js | >= 22.0.0 | 项目基础要求 |

### 环境检测

```typescript
// src/protocol/lldb/env.ts

export async function checkLLDBEnvironment(): Promise<{
  available: boolean;
  pythonPath?: string;
  lldbVersion?: string;
  error?: string;
}> {
  // 检测 Python 版本
  // 检测 lldb 模块是否可用
  // 返回检测结果
}
```

## 错误处理

| 错误码 | 说明 |
|--------|------|
| `PYTHON_NOT_FOUND` | Python 解释器未找到 |
| `LLDB_MODULE_NOT_FOUND` | lldb Python 模块未找到 |
| `TARGET_NOT_FOUND` | 调试目标文件不存在 |
| `CONNECTION_FAILED` | 连接失败 |
| `PROCESS_NOT_RUNNING` | 进程未运行 |

## 测试策略

### 单元测试

- `bridge.test.ts`: 测试 JSON-RPC 通信
- `client.test.ts`: 测试 LLDBClient 方法 (mock bridge)
- `protocol.test.ts`: 测试消息格式

### 集成测试

- 需要 LLDB 环境的真实测试
- 测试用例放在 `tests/integration/lldb/`

## 实现计划

1. **Phase 1**: 基础框架
   - 创建目录结构
   - 实现 `bridge.ts` 子进程通信
   - 实现 `lldb_bridge.py` 基础框架

2. **Phase 2**: 核心功能
   - 实现 `connect`/`disconnect`
   - 实现 `threads`/`stack`
   - 实现 `suspend`/`resume`/`step*`

3. **Phase 3**: 断点与变量
   - 实现断点管理
   - 实现变量检查

4. **Phase 4**: 完善与测试
   - 错误处理完善
   - 单元测试
   - 集成测试
   - 文档完善
