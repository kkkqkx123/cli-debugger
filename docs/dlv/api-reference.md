# Delve JSON-RPC API 参考

## 概述

Delve 通过 JSON-RPC 2.0 协议提供调试 API。本文档列出所有可用的 API 方法及其参数和返回值。

## 连接

### 基本格式

所有请求遵循 JSON-RPC 2.0 规范：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "RPCServer.MethodName",
  "params": [/* 参数数组 */]
}
```

响应格式：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {/* 返回值 */}
}
```

错误响应：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": 1,
    "message": "Error message"
  }
}
```

## 核心 API

### 生命周期管理

#### GetVersion

获取 Delve 版本信息。

```typescript
// 请求
{
  "method": "RPCServer.GetVersion",
  "params": []
}

// 响应
{
  "result": {
    "DelveVersion": "Version: 1.8.0",
    "APIVersion": 2,
    "Devel": false
  }
}
```

#### Detach

断开调试会话，清理资源。

```typescript
// 请求
{
  "method": "RPCServer.Detach",
  "params": [{
    "Kill": false  // 是否终止目标进程
  }]
}

// 响应
{
  "result": {}
}
```

#### Restart

重启目标程序。

```typescript
// 请求
{
  "method": "RPCServer.Restart",
  "params": [{
    "Position": "",        // 重启位置
    "ResetArgs": false,    // 是否重置参数
    "NewArgs": [],         // 新参数
    "Rerecord": false,     // 是否重新记录
    "Rebuild": false       // 是否重新构建
  }]
}

// 响应
{
  "result": {
    "DiscardedBreakpoints": []
  }
}
```

### 状态查询

#### State

获取当前调试器状态。

```typescript
// 请求
{
  "method": "RPCServer.State",
  "params": [{
    "NonBlocking": false  // 是否非阻塞模式
  }]
}

// 响应
{
  "result": {
    "Pid": 12345,
    "Running": false,
    "RunningGoroutine": null,
    "CurrentThread": {
      "id": 1,
      "pc": 0x123456,
      "file": "main.go",
      "line": 42,
      "function": {...},
      "goroutineID": 1,
      "breakPoint": null,
      "breakPointInfo": null
    },
    "SelectedGoroutine": {
      "id": 1,
      "currentLoc": {...},
      "userCurrentLoc": {...},
      "goStatementLoc": {...},
      "startLoc": {...},
      "threadId": 12345,
      "systemStack": false
    },
    "Threads": [...],
    "NextInProgress": false,
    "exited": false,
    "exitStatus": 0,
    "When": "2024-01-01T00:00:00Z"
  }
}
```

### Goroutine 管理

#### ListGoroutines

列出所有 goroutines。

```typescript
// 请求
{
  "method": "RPCServer.ListGoroutines",
  "params": [{
    "start": 0,      // 起始索引
    "count": 100,    // 数量（0 表示全部）
    "labels": {},    // 标签过滤
    "filter": null   // 过滤器
  }]
}

// 响应
{
  "result": {
    "Goroutines": [
      {
        "id": 1,
        "currentLoc": {
          "pc": 0x123456,
          "file": "main.go",
          "line": 42,
          "function": {
            "name": "main.main",
            "value": 0x123456,
            "type": 0x789,
            "goType": 0
          }
        },
        "userCurrentLoc": {...},
        "goStatementLoc": {...},
        "startLoc": {...},
        "threadId": 12345,
        "systemStack": false
      }
    ],
    "Nextg": -1,  // 下一页索引（-1 表示没有更多）
    "GroupBy": null,
    "GroupedBy": ""
  }
}
```

#### GetGoroutine

获取指定 goroutine 信息。

```typescript
// 请求
{
  "method": "RPCServer.GetGoroutine",
  "params": [{
    "id": 1
  }]
}

// 响应
{
  "result": {
    "id": 1,
    "currentLoc": {...},
    "userCurrentLoc": {...},
    // ...
  }
}
```

### 执行控制

#### Command

执行调试命令。

```typescript
// 请求
{
  "method": "RPCServer.Command",
  "params": [{
    "name": "continue",  // 命令名称
    "returnInfo": false  // 是否返回信息
  }]
}

// 可用命令：
// - "halt": 暂停
// - "continue": 继续
// - "next": 单步跳过
// - "step": 单步进入
// - "stepout": 单步跳出
// - "switchGoroutine": 切换 goroutine

// 响应
{
  "result": {
    "State": {
      "Running": true,
      // ... DebuggerState
    },
    "ReturnInfo": null
  }
}
```

### 断点管理

#### CreateBreakpoint

创建断点。

```typescript
// 请求 - 行断点
{
  "method": "RPCServer.CreateBreakpoint",
  "params": [{
    "Breakpoint": {
      "file": "main.go",
      "line": 42,
      "Cond": "",           // 条件表达式
      "hitCount": null,     // 命中次数条件
      "traceReturn": false  // 是否跟踪返回
    }
  }]
}

// 请求 - 函数断点
{
  "method": "RPCServer.CreateBreakpoint",
  "params": [{
    "Breakpoint": {
      "functionName": "main.main",
      "Cond": ""
    }
  }]
}

// 响应
{
  "result": {
    "id": 1,
    "name": "",
    "addr": 0x123456,
    "file": "main.go",
    "line": 42,
    "functionName": "main.main",
    "Cond": "",
    "hitCount": 0,
    "totalHitCount": 0,
    "disabled": false
  }
}
```

#### ClearBreakpoint

清除断点。

```typescript
// 请求
{
  "method": "RPCServer.ClearBreakpoint",
  "params": [{
    "Id": 1  // 断点 ID
  }]
}

// 响应
{
  "result": {
    "id": 1,
    // ... Breakpoint 信息
  }
}
```

#### ListBreakpoints

列出所有断点。

```typescript
// 请求
{
  "method": "RPCServer.ListBreakpoints",
  "params": []
}

// 响应
{
  "result": [
    {
      "id": 1,
      "name": "",
      "file": "main.go",
      "line": 42,
      // ...
    }
  ]
}
```

#### ToggleBreakpoint

切换断点启用状态。

```typescript
// 请求
{
  "method": "RPCServer.ToggleBreakpoint",
  "params": [{
    "Id": 1
  }]
}

// 响应
{
  "result": {}
}
```

### 堆栈跟踪

#### Stacktrace

获取堆栈跟踪。

```typescript
// 请求
{
  "method": "RPCServer.Stacktrace",
  "params": [{
    "id": 1,        // goroutine ID
    "depth": 20,    // 深度
    "full": false,  // 是否完整信息
    "defers": false, // 是否包含 defer
    "opts": 0       // 选项
  }]
}

// 响应
{
  "result": [
    {
      "pc": 0x123456,
      "file": "main.go",
      "line": 42,
      "function": {
        "name": "main.main",
        "value": 0x123456,
        "type": 0x789,
        "goType": 0
      }
    },
    // ... 更多帧
  ]
}
```

### 变量检查

#### ListLocalVars

列出局部变量。

```typescript
// 请求
{
  "method": "RPCServer.ListLocalVars",
  "params": [{
    "scope": {
      "goroutineID": 1,
      "frame": 0,
      "deferCall": 0
    },
    "cfg": {
      "FollowPointers": true,
      "MaxVariableRecurse": 1,
      "MaxStringLen": 64,
      "MaxArrayValues": 64,
      "MaxStructFields": -1
    }
  }]
}

// 响应
{
  "result": [
    {
      "name": "x",
      "addr": 0x123456,
      "type": "int",
      "realType": "int",
      "kind": 1,
      "value": "42",
      "len": 0,
      "cap": 0,
      "children": [],
      "base": 0,
      "unreadable": ""
    }
  ]
}
```

#### ListFunctionArgs

列出函数参数。

```typescript
// 请求
{
  "method": "RPCServer.ListFunctionArgs",
  "params": [{
    "scope": {
      "goroutineID": 1,
      "frame": 0,
      "deferCall": 0
    },
    "cfg": {...}
  }]
}

// 响应
{
  "result": [
    {
      "name": "a",
      "type": "int",
      "value": "10",
      // ...
    }
  ]
}
```

#### Eval

计算表达式。

```typescript
// 请求
{
  "method": "RPCServer.Eval",
  "params": [{
    "scope": {
      "goroutineID": 1,
      "frame": 0,
      "deferCall": 0
    },
    "expr": "x + y",
    "cfg": {...}
  }]
}

// 响应
{
  "result": {
    "name": "x + y",
    "type": "int",
    "value": "30",
    // ...
  }
}
```

#### Set

设置变量值。

```typescript
// 请求
{
  "method": "RPCServer.Set",
  "params": [{
    "scope": {
      "goroutineID": 1,
      "frame": 0,
      "deferCall": 0
    },
    "symbol": "x",
    "value": "100"
  }]
}

// 响应
{
  "result": {}
}
```

### 信息查询

#### ListSources

列出源文件。

```typescript
// 请求
{
  "method": "RPCServer.ListSources",
  "params": [{
    "filter": ""  // 过滤器
  }]
}

// 响应
{
  "result": [
    "main.go",
    "utils.go",
    // ...
  ]
}
```

#### ListFunctions

列出函数。

```typescript
// 请求
{
  "method": "RPCServer.ListFunctions",
  "params": [{
    "filter": "",
    "followCalls": false
  }]
}

// 响应
{
  "result": [
    {
      "name": "main.main",
      "type": 0x123,
      "value": 0x456
    },
    // ...
  ]
}
```

#### ListPackages

列出包。

```typescript
// 请求
{
  "method": "RPCServer.ListPackagesBuildInfo",
  "params": [{
    "includeFiles": false,
    "filter": ""
  }]
}

// 响应
{
  "result": [
    {
      "name": "main",
      "directory": "/path/to/main",
      "files": []
    }
  ]
}
```

#### ListTypes

列出类型。

```typescript
// 请求
{
  "method": "RPCServer.ListTypes",
  "params": [{
    "filter": ""
  }]
}

// 响应
{
  "result": [
    {
      "name": "main.MyStruct",
      "kind": 1,
      "size": 16,
      "package": "main"
    }
  ]
}
```

## 类型定义

### Location

```typescript
interface Location {
  pc: number;        // 程序计数器
  file: string;      // 文件路径
  line: number;      // 行号
  function?: {       // 函数信息
    name: string;    // 函数名
    value: number;   // 函数地址
    type: number;    // 类型 ID
    goType: number;  // Go 类型
  };
}
```

### Goroutine

```typescript
interface Goroutine {
  id: number;              // goroutine ID
  currentLoc: Location;    // 当前位置
  userCurrentLoc: Location; // 用户代码位置
  goStatementLoc: Location; // go 语句位置
  startLoc: Location;      // 起始位置
  threadId: number;        // 线程 ID
  systemStack: boolean;    // 是否系统栈
}
```

### Thread

```typescript
interface Thread {
  id: number;           // 线程 ID
  pc: number;           // 程序计数器
  file: string;         // 文件路径
  line: number;         // 行号
  function?: Function;  // 函数信息
  goroutineID: number;  // goroutine ID
  breakPoint?: Breakpoint; // 断点信息
}
```

### Breakpoint

```typescript
interface Breakpoint {
  id: number;           // 断点 ID
  name: string;         // 断点名称
  addr: number;         // 地址
  file: string;         // 文件路径
  line: number;         // 行号
  functionName: string; // 函数名
  Cond: string;         // 条件表达式
  hitCount: number;     // 命中次数
  totalHitCount: number; // 总命中次数
  disabled: boolean;    // 是否禁用
}
```

### Variable

```typescript
interface Variable {
  name: string;         // 变量名
  addr: number;         // 地址
  type: string;         // 类型
  realType: string;     // 实际类型
  kind: number;         // 种类
  value: string;        // 值
  len: number;          // 长度
  cap: number;          // 容量
  children: Variable[]; // 子变量
  base: number;         // 基地址
  unreadable: string;   // 不可读原因
}
```

### EvalScope

```typescript
interface EvalScope {
  goroutineID: number;  // goroutine ID
  frame: number;        // 帧索引
  deferredCall: number; // defer 调用索引
}
```

### LoadConfig

```typescript
interface LoadConfig {
  FollowPointers: boolean;     // 是否跟随指针
  MaxVariableRecurse: number;  // 最大递归深度
  MaxStringLen: number;        // 最大字符串长度
  MaxArrayValues: number;      // 最大数组值数
  MaxStructFields: number;     // 最大结构体字段数
}
```

## 错误处理

### 错误代码

| 代码 | 描述 |
|------|------|
| 1 | 内部错误 |
| 2 | 参数错误 |
| 3 | 找不到 |
| 4 | 不可读 |
| 5 | 不支持 |

### 错误响应示例

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": 3,
    "message": "Could not find function main.nonexistent",
    "data": null
  }
}
```

## 使用示例

### TypeScript 客户端

```typescript
import { DlvClient } from 'cli-debugger';

async function example() {
  const client = new DlvClient({
    protocol: 'dlv',
    host: '127.0.0.1',
    port: 4040,
    timeout: 10000
  });

  await client.connect();

  try {
    // 获取版本
    const version = await client.version();
    console.log('Delve version:', version.runtimeVersion);

    // 获取 goroutines
    const threads = await client.threads();
    console.log('Goroutines:', threads.length);

    // 设置断点
    const bpId = await client.setBreakpoint('main.go:42');
    console.log('Breakpoint set:', bpId);

    // 继续执行
    await client.resume();

    // 等待事件
    const event = await client.waitForEvent(30000);
    if (event?.type === 'breakpoint') {
      console.log('Hit breakpoint at:', event.location);

      // 获取堆栈
      const stack = await client.stack(event.threadId);
      console.log('Stack depth:', stack.length);

      // 获取局部变量
      const locals = await client.locals(event.threadId, 0);
      console.log('Local variables:', locals);
    }

    // 继续执行
    await client.resume();
  } finally {
    await client.close();
  }
}
```

### 原始 JSON-RPC

```javascript
const net = require('net');

const client = new net.Socket();
client.connect(4040, '127.0.0.1', () => {
  // 发送 GetVersion 请求
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'RPCServer.GetVersion',
    params: []
  }) + '\n';

  client.write(request);
});

client.on('data', (data) => {
  const response = JSON.parse(data.toString());
  console.log('Response:', response);
  client.destroy();
});
```

## 参考资料

- [JSON-RPC 2.0 规范](https://www.jsonrpc.org/specification)
- [Delve API 文档](https://github.com/go-delve/delve/blob/master/Documentation/api/json-rpc/README.md)
- [Delve Go API](https://pkg.go.dev/github.com/go-delve/delve/service/rpc2)
