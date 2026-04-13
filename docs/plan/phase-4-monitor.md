# 第四阶段: 监控层实现计划

## 概述

实现实时监控调试状态的系统,支持轮询和流式两种监控模式。

## 参考模块

### Go 版本参考 (`ref/internal/monitor/`)

- **poller.go**: 轮询监控实现
- **stream.go**: WebSocket 流式监控

## 目录结构

```
src/monitor/
├── index.ts           # 模块导出
├── interface.ts       # Monitor 接口定义
├── poller.ts          # 轮询监控
└── stream.ts          # WebSocket 流式监控
```

## 核心实现

### 1. interface.ts - Monitor 接口

**功能**:

- 定义监控接口
- 支持启动、停止、配置

**参考实现** (`ref/internal/monitor/poller.go`):

```go
type Monitor interface {
    Start(ctx context.Context) error
    Stop()
    SetInterval(interval time.Duration)
    SetTimeout(timeout time.Duration)
    SetCommand(fn func(ctx context.Context) error)
}
```

**TypeScript 实现**:

```typescript
/**
 * Monitor interface for observing debug state changes
 */
export interface Monitor {
  /**
   * Start monitoring
   */
  start(): Promise<void>;

  /**
   * Stop monitoring
   */
  stop(): void;

  /**
   * Set refresh interval (in milliseconds)
   */
  setInterval(interval: number): void;

  /**
   * Set total timeout (in milliseconds)
   */
  setTimeout(timeout: number): void;

  /**
   * Set the command to execute on each tick
   */
  setCommand(command: () => Promise<void>): void;

  /**
   * Wait for monitoring to complete
   */
  wait(): Promise<void>;
}

/** Monitor options */
export interface MonitorOptions {
  interval?: number;
  timeout?: number;
  command?: () => Promise<void>;
}
```

### 2. poller.ts - 轮询监控

**功能**:

- 定时轮询执行命令
- 支持超时和中断
- 错误处理和恢复

**参考实现** (`ref/internal/monitor/poller.go`):

```go
type Poller struct {
    interval  time.Duration
    timeout   time.Duration
    command   func(ctx context.Context) error
    mu        sync.Mutex
    cancel    context.CancelFunc
    done      chan struct{}
}

func (p *Poller) Start(ctx context.Context) error {
    // Create context with timeout
    monitorCtx, cancel := context.WithTimeout(ctx, p.timeout)
    defer cancel()

    // Listen for interrupt signals
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
    defer signal.Stop(sigChan)

    // Run first command immediately
    if err := cmd(monitorCtx); err != nil {
        return err
    }

    // Start polling loop
    ticker := time.NewTicker(p.interval)
    defer ticker.Stop()

    for {
        select {
        case <-monitorCtx.Done():
            return monitorCtx.Err()
        case <-sigChan:
            return nil
        case <-ticker.C:
            if err := cmd(monitorCtx); err != nil {
                // Continue monitoring despite errors
            }
        }
    }
}
```

**TypeScript 实现**:

```typescript
import process from "node:process";
import type { Monitor, MonitorOptions } from "./interface.js";

export class Poller implements Monitor {
  private interval: number;
  private timeout: number;
  private command?: () => Promise<void>;
  private abortController?: AbortController;
  private donePromise?: Promise<void>;
  private running = false;

  constructor(options?: MonitorOptions) {
    this.interval = options?.interval ?? 1000;
    this.timeout = options?.timeout ?? 60000;
    this.command = options?.command;
  }

  setInterval(interval: number): void {
    if (interval < 100) {
      interval = 100; // Minimum 100ms
    }
    this.interval = interval;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setCommand(command: () => Promise<void>): void {
    this.command = command;
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Monitor is already running");
    }

    if (!this.command) {
      throw new Error("Monitor command not set");
    }

    this.running = true;
    this.abortController = new AbortController();

    this.donePromise = this.runLoop();
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async wait(): Promise<void> {
    if (this.donePromise) {
      await this.donePromise;
    }
  }

  private async runLoop(): Promise<void> {
    const startTime = Date.now();
    const command = this.command!;

    // Setup signal handlers
    const signalHandler = () => {
      console.error("\n[Monitor] Interrupted, stopping...");
      this.stop();
    };

    process.on("SIGINT", signalHandler);
    process.on("SIGTERM", signalHandler);

    try {
      // Run first command immediately
      await this.executeCommand(command);

      // Start polling loop
      while (!this.abortController?.signal.aborted) {
        // Check timeout
        if (Date.now() - startTime >= this.timeout) {
          console.error("\n[Monitor] Timeout reached, stopping...");
          break;
        }

        // Wait for interval
        await this.sleep(this.interval);

        // Check if aborted during sleep
        if (this.abortController?.signal.aborted) {
          break;
        }

        // Execute command
        await this.executeCommand(command);
      }
    } finally {
      process.off("SIGINT", signalHandler);
      process.off("SIGTERM", signalHandler);
      this.running = false;
    }
  }

  private async executeCommand(command: () => Promise<void>): Promise<void> {
    try {
      await command();
    } catch (error) {
      console.error("\n[Monitor] Command error:", error);
      // Continue monitoring despite errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, ms);

      // Allow aborting during sleep
      this.abortController?.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}
```

### 3. stream.ts - WebSocket 流式监控

**功能**:

- WebSocket 实时推送
- 自动重连
- 事件过滤

**TypeScript 实现**:

```typescript
import WebSocket from "ws";
import type { Monitor, MonitorOptions } from "./interface.js";
import type { DebugEvent } from "../types/debug.js";

export interface StreamOptions extends MonitorOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  onEvent?: (event: DebugEvent) => void;
}

export class StreamMonitor implements Monitor {
  private url: string;
  private reconnect: boolean;
  private reconnectInterval: number;
  private onEvent?: (event: DebugEvent) => void;
  private ws?: WebSocket;
  private abortController?: AbortController;
  private running = false;

  constructor(options: StreamOptions) {
    this.url = options.url;
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
    this.onEvent = options.onEvent;
  }

  setInterval(_interval: number): void {
    // Not applicable for stream monitor
  }

  setTimeout(_timeout: number): void {
    // Not applicable for stream monitor
  }

  setCommand(_command: () => Promise<void>): void {
    // Not applicable for stream monitor
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Monitor is already running");
    }

    this.running = true;
    this.abortController = new AbortController();

    await this.connect();
  }

  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.running = false;
  }

  async wait(): Promise<void> {
    // Wait until stopped
    while (this.running) {
      await this.sleep(100);
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        console.error("[Stream] Connected to", this.url);
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as DebugEvent;
          this.onEvent?.(event);
        } catch (error) {
          console.error("[Stream] Failed to parse event:", error);
        }
      });

      this.ws.on("close", () => {
        console.error("[Stream] Connection closed");
        if (this.reconnect && !this.abortController?.signal.aborted) {
          setTimeout(() => {
            this.connect().catch(console.error);
          }, this.reconnectInterval);
        } else {
          this.running = false;
        }
      });

      this.ws.on("error", (error: Error) => {
        console.error("[Stream] Error:", error);
        reject(error);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 4. index.ts - 模块导出

```typescript
export type { Monitor, MonitorOptions } from "./interface.js";
export { Poller } from "./poller.js";
export type { StreamOptions } from "./stream.js";
export { StreamMonitor } from "./stream.js";

/**
 * Create a poller monitor
 */
export function createPoller(options?: MonitorOptions): Poller {
  return new Poller(options);
}

/**
 * Create a stream monitor
 */
export function createStreamMonitor(options: StreamOptions): StreamMonitor {
  return new StreamMonitor(options);
}
```

## 依赖添加

需要添加以下依赖:

```json
{
  "dependencies": {
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"
  }
}
```

## 测试计划

### 单元测试 (`src/monitor/__tests__/`)

1. **poller.test.ts**: 测试轮询监控
   - 测试启动和停止
   - 测试间隔执行
   - 测试超时
   - 测试错误处理

2. **stream.test.ts**: 测试流式监控
   - 测试 WebSocket 连接
   - 测试事件接收
   - 测试重连机制

## 实现顺序

1. ✅ 创建 `src/monitor/` 目录
2. ✅ 实现 `interface.ts`
3. ✅ 实现 `poller.ts`
4. ✅ 实现 `stream.ts`
5. ✅ 创建 `index.ts`
6. ✅ 添加依赖
7. ✅ 编写单元测试
8. ✅ 验证构建和测试

## 注意事项

1. **AbortController**: 使用 AbortController 替代 Go 的 context.Context
2. **信号处理**: 正确处理 SIGINT 和 SIGTERM
3. **错误恢复**: 监控错误不应中断监控循环
4. **资源清理**: 确保停止时清理所有资源
5. **WebSocket**: 使用 ws 库实现 WebSocket 客户端
