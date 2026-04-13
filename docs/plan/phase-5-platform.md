# 第五阶段: 平台层实现计划

## 概述

实现跨平台进程发现和管理功能,支持 Windows、macOS、Linux。

## 参考模块

### Go 版本参考 (`ref/internal/platform/`)

- **process.go**: 进程发现接口和通用实现
- **process_windows.go**: Windows 特定实现
- **process_unix.go**: Unix 特定实现
- **process_other.go**: 其他平台实现

## 目录结构

```
src/platform/
├── index.ts              # 模块导出
├── interface.ts          # ProcessDiscoverer 接口
├── process.ts            # 通用实现
├── process-windows.ts    # Windows 特定
├── process-unix.ts       # Unix 特定 (macOS/Linux)
└── process-other.ts      # 其他平台
```

## 核心实现

### 1. interface.ts - ProcessDiscoverer 接口

**功能**:

- 定义进程发现接口
- 支持按端口、名称查找进程

**参考实现** (`ref/internal/platform/process.go`):

```go
type ProcessInfo struct {
    PID  int    `json:"pid"`
    Name string `json:"name"`
}

type ProcessDiscoverer interface {
    FindProcesses() ([]ProcessInfo, error)
    FindProcessByPort(port int) (*ProcessInfo, error)
    FindProcessByName(name string) ([]ProcessInfo, error)
}
```

**TypeScript 实现**:

```typescript
/**
 * Process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  command?: string;
  user?: string;
}

/**
 * Process discoverer interface
 */
export interface ProcessDiscoverer {
  /**
   * Find all running processes
   */
  findProcesses(): Promise<ProcessInfo[]>;

  /**
   * Find process listening on a specific port
   */
  findProcessByPort(port: number): Promise<ProcessInfo | null>;

  /**
   * Find processes by name (case-insensitive)
   */
  findProcessByName(name: string): Promise<ProcessInfo[]>;

  /**
   * Check if a port is in use
   */
  isPortInUse(port: number): Promise<boolean>;
}
```

### 2. process.ts - 通用实现

**功能**:

- 提供平台检测
- 导出平台特定实现
- 通用辅助函数

**TypeScript 实现**:

```typescript
import process from "node:process";
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";

let discoverer: ProcessDiscoverer | null = null;

/**
 * Get platform-specific process discoverer
 */
export function getProcessDiscoverer(): ProcessDiscoverer {
  if (!discoverer) {
    const platform = process.platform;

    switch (platform) {
      case "win32":
        discoverer =
          new (require("./process-windows.js").WindowsProcessDiscoverer)();
        break;
      case "darwin":
      case "linux":
        discoverer = new (require("./process-unix.js").UnixProcessDiscoverer)();
        break;
      default:
        discoverer =
          new (require("./process-other.js").OtherProcessDiscoverer)();
        break;
    }
  }

  return discoverer;
}

/**
 * Check if a string contains a substring (case-insensitive)
 */
export function containsCaseInsensitive(str: string, substr: string): boolean {
  return str.toLowerCase().includes(substr.toLowerCase());
}

/**
 * Parse PID from string
 */
export function parsePid(s: string): number | null {
  const pid = parseInt(s.trim(), 10);
  return isNaN(pid) ? null : pid;
}
```

### 3. process-windows.ts - Windows 实现

**功能**:

- 使用 Windows 命令查找进程
- 支持 netstat、tasklist、wmic

**参考实现** (`ref/internal/platform/process_windows.go`):

```go
func (d *WindowsProcessDiscoverer) FindProcessByPort(port int) (*ProcessInfo, error) {
    // Use netstat to find PID
    output, err := runCommand("netstat", "-ano")
    if err != nil {
        return nil, err
    }

    // Parse output to find PID
    lines := strings.Split(output, "\n")
    for _, line := range lines {
        if strings.Contains(line, fmt.Sprintf(":%d", port)) {
            fields := strings.Fields(line)
            if len(fields) >= 5 {
                pid := parsePID(fields[4])
                if pid > 0 {
                    return d.FindProcessByPID(pid)
                }
            }
        }
    }

    return nil, nil
}
```

**TypeScript 实现**:

```typescript
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";
import { containsCaseInsensitive, parsePid } from "./process.js";

const execAsync = promisify(exec);

export class WindowsProcessDiscoverer implements ProcessDiscoverer {
  async findProcesses(): Promise<ProcessInfo[]> {
    const { stdout } = await execAsync("tasklist /FO CSV /NH");
    return this.parseTasklist(stdout);
  }

  async findProcessByPort(port: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync("netstat -ano");
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          const fields = line.trim().split(/\s+/);
          const pidField = fields[fields.length - 1];
          const pid = parsePid(pidField);

          if (pid !== null && pid > 0) {
            return this.findProcessByPid(pid);
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async findProcessByName(name: string): Promise<ProcessInfo[]> {
    const processes = await this.findProcesses();
    return processes.filter((p) => containsCaseInsensitive(p.name, name));
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync("netstat -ano");
      return stdout.includes(`:${port}`);
    } catch {
      return false;
    }
  }

  private async findProcessByPid(pid: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(
        `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
      );
      const processes = this.parseTasklist(stdout);
      return processes[0] ?? null;
    } catch {
      return null;
    }
  }

  private parseTasklist(output: string): ProcessInfo[] {
    const processes: ProcessInfo[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      // Format: "ImageName","PID","SessionName","Session#","MemUsage"
      const match = line.match(/"([^"]+)","(\d+)"/);
      if (match) {
        processes.push({
          name: match[1],
          pid: parseInt(match[2], 10),
        });
      }
    }

    return processes;
  }
}
```

### 4. process-unix.ts - Unix 实现

**功能**:

- 使用 Unix 命令查找进程
- 支持 ps、lsof、netstat

**参考实现** (`ref/internal/platform/process_unix.go`):

```go
func (d *UnixProcessDiscoverer) FindProcessByPort(port int) (*ProcessInfo, error) {
    // Try lsof first
    output, err := runCommand("lsof", "-i", fmt.Sprintf(":%d", port), "-t")
    if err == nil {
        pid := parsePID(strings.TrimSpace(output))
        if pid > 0 {
            return d.FindProcessByPID(pid)
        }
    }

    // Fallback to netstat
    output, err = runCommand("netstat", "-tlnp")
    if err != nil {
        return nil, err
    }

    // Parse netstat output
    // ...
}
```

**TypeScript 实现**:

```typescript
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";
import { containsCaseInsensitive, parsePid } from "./process.js";

const execAsync = promisify(exec);

export class UnixProcessDiscoverer implements ProcessDiscoverer {
  async findProcesses(): Promise<ProcessInfo[]> {
    const { stdout } = await execAsync("ps -e -o pid,comm");
    return this.parsePs(stdout);
  }

  async findProcessByPort(port: number): Promise<ProcessInfo | null> {
    try {
      // Try lsof first
      const { stdout: lsofOut } = await execAsync(`lsof -i :${port} -t`);
      const pid = parsePid(lsofOut.trim());

      if (pid !== null && pid > 0) {
        return this.findProcessByPid(pid);
      }
    } catch {
      // lsof not available or port not found
    }

    try {
      // Fallback to netstat
      const { stdout } = await execAsync(
        "netstat -tlnp 2>/dev/null || ss -tlnp",
      );
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (line.includes(`:${port}`)) {
          // Parse PID from netstat/ss output
          const match = line.match(/(\d+)\/(\S+)/);
          if (match) {
            const pid = parseInt(match[1], 10);
            return this.findProcessByPid(pid);
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  async findProcessByName(name: string): Promise<ProcessInfo[]> {
    const processes = await this.findProcesses();
    return processes.filter((p) => containsCaseInsensitive(p.name, name));
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async findProcessByPid(pid: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o pid,comm`);
      const processes = this.parsePs(stdout);
      return processes[0] ?? null;
    } catch {
      return null;
    }
  }

  private parsePs(output: string): ProcessInfo[] {
    const processes: ProcessInfo[] = [];
    const lines = output.split("\n").slice(1); // Skip header

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const pid = parsePid(parts[0]);
        if (pid !== null) {
          processes.push({
            pid,
            name: parts[1],
          });
        }
      }
    }

    return processes;
  }
}
```

### 5. process-other.ts - 其他平台实现

**功能**:

- 提供基本的进程发现功能
- 适用于不支持的平台

**TypeScript 实现**:

```typescript
import type { ProcessDiscoverer, ProcessInfo } from "./interface.js";

export class OtherProcessDiscoverer implements ProcessDiscoverer {
  async findProcesses(): Promise<ProcessInfo[]> {
    // Not supported on this platform
    return [];
  }

  async findProcessByPort(_port: number): Promise<ProcessInfo | null> {
    // Not supported on this platform
    return null;
  }

  async findProcessByName(_name: string): Promise<ProcessInfo[]> {
    // Not supported on this platform
    return [];
  }

  async isPortInUse(port: number): Promise<boolean> {
    // Basic check using net module
    return new Promise((resolve) => {
      const server = require("net").createServer();

      server.once("error", () => resolve(true));
      server.once("listening", () => {
        server.close();
        resolve(false);
      });

      server.listen(port);
    });
  }
}
```

### 6. index.ts - 模块导出

```typescript
export type { ProcessInfo, ProcessDiscoverer } from "./interface.js";
export { getProcessDiscoverer } from "./process.js";
export { WindowsProcessDiscoverer } from "./process-windows.js";
export { UnixProcessDiscoverer } from "./process-unix.js";
export { OtherProcessDiscoverer } from "./process-other.js";

/**
 * Create a process discoverer for the current platform
 */
export function createProcessDiscoverer(): ProcessDiscoverer {
  return getProcessDiscoverer();
}
```

## 测试计划

### 单元测试 (`src/platform/__tests__/`)

1. **process.test.ts**: 测试通用功能
   - 测试平台检测
   - 测试辅助函数

2. **process-windows.test.ts**: 测试 Windows 实现
   - 测试进程查找
   - 测试端口查找
   - Mock 命令执行

3. **process-unix.test.ts**: 测试 Unix 实现
   - 测试进程查找
   - 测试端口查找
   - Mock 命令执行

## 实现顺序

1. ✅ 创建 `src/platform/` 目录
2. ✅ 实现 `interface.ts`
3. ✅ 实现 `process.ts`
4. ✅ 实现 `process-windows.ts`
5. ✅ 实现 `process-unix.ts`
6. ✅ 实现 `process-other.ts`
7. ✅ 创建 `index.ts`
8. ✅ 编写单元测试
9. ✅ 验证构建和测试

## 注意事项

1. **跨平台**: 使用 process.platform 检测平台
2. **命令执行**: 使用 child_process.exec 执行系统命令
3. **错误处理**: 命令失败时返回空结果而不是抛出错误
4. **性能**: 缓存进程列表以减少命令执行
5. **权限**: 某些命令可能需要管理员权限
6. **兼容性**: 处理不同 Unix 系统的命令差异 (macOS vs Linux)

## 平台特定注意事项

### Windows

- 使用 `tasklist` 列出进程
- 使用 `netstat -ano` 查找端口
- 输出格式为 CSV

### macOS

- 使用 `ps` 列出进程
- 使用 `lsof` 查找端口
- 支持 `netstat` 作为备选

### Linux

- 使用 `ps` 列出进程
- 使用 `lsof` 或 `ss` 查找端口
- 支持 `netstat` 作为备选

### 其他平台

- 提供基本功能
- 端口检查使用 net 模块
