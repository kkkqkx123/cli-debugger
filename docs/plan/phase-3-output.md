# 第三阶段: 输出层实现计划

## 概述

实现统一的输出格式化系统,支持 text、json、table 三种格式。

## 参考模块

### Go 版本参考 (`ref/internal/output/`)

- **formatter.go**: Formatter 接口定义和工厂函数
- **text.go**: 文本格式化实现
- **json.go**: JSON 格式化实现
- **table.go**: 表格格式化实现

## 目录结构

```
src/output/
├── index.ts           # 模块导出
├── interface.ts       # Formatter 接口定义
├── text.ts            # 文本格式化
├── json.ts            # JSON 格式化
└── table.ts           # 表格格式化
```

## 核心实现

### 1. interface.ts - Formatter 接口

**功能**:
- 定义统一的输出格式化接口
- 支持多种输出类型
- 支持写入流

**参考实现** (`ref/internal/output/formatter.go`):
```go
type Formatter interface {
    FormatVersion(info *types.VersionInfo) error
    FormatThreads(threads []*types.ThreadInfo) error
    FormatStack(frames []*types.StackFrame) error
    FormatVariables(variables []*types.Variable) error
    FormatBreakpoints(breakpoints []*types.BreakpointInfo) error
    FormatEvent(event *types.DebugEvent) error
    FormatError(err error) error
    FormatVerboseError(err error) error
    SetWriter(writer io.Writer)
}
```

**TypeScript 实现**:
```typescript
import type { Writable } from 'node:stream';
import type {
  VersionInfo,
  ThreadInfo,
  StackFrame,
  Variable,
  BreakpointInfo,
  DebugEvent,
} from '../types/index.js';

/**
 * Output formatter interface
 */
export interface Formatter {
  // Format version information
  formatVersion(info: VersionInfo): Promise<void>;

  // Format thread list
  formatThreads(threads: ThreadInfo[]): Promise<void>;

  // Format call stack
  formatStack(frames: StackFrame[]): Promise<void>;

  // Format variable list
  formatVariables(variables: Variable[]): Promise<void>;

  // Format breakpoint list
  formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void>;

  // Format debug event
  formatEvent(event: DebugEvent): Promise<void>;

  // Format error
  formatError(error: Error): Promise<void>;

  // Format verbose error (with stack trace)
  formatVerboseError(error: Error): Promise<void>;

  // Set output stream
  setWriter(writer: Writable): void;
}

/** Formatter type */
export type FormatterType = 'text' | 'json' | 'table';

/** Formatter factory options */
export interface FormatterOptions {
  type: FormatterType;
  color?: boolean;
  writer?: Writable;
}
```

### 2. text.ts - 文本格式化

**功能**:
- 人类可读的文本输出
- 支持彩色输出
- 格式化对齐

**参考实现** (`ref/internal/output/text.go`):
```go
type TextFormatter struct {
    writer io.Writer
    color  bool
}

func (f *TextFormatter) FormatThreads(threads []*types.ThreadInfo) error {
    for _, t := range threads {
        fmt.Fprintf(f.writer, "Thread %s: %s (state: %s, suspended: %v)\n",
            t.ID, t.Name, t.State, t.IsSuspended)
    }
    return nil
}
```

**TypeScript 实现**:
```typescript
import type { Writable } from 'node:stream';
import process from 'node:process';
import chalk from 'chalk';
import type { Formatter } from './interface.js';
import type {
  VersionInfo,
  ThreadInfo,
  StackFrame,
  Variable,
  BreakpointInfo,
  DebugEvent,
} from '../types/index.js';

export class TextFormatter implements Formatter {
  private writer: Writable = process.stdout;
  private useColor: boolean;

  constructor(options?: { color?: boolean }) {
    this.useColor = options?.color ?? true;
  }

  setWriter(writer: Writable): void {
    this.writer = writer;
  }

  async formatVersion(info: VersionInfo): Promise<void> {
    this.write(`Protocol: ${info.protocolVersion}\n`);
    this.write(`Runtime: ${info.runtimeName} ${info.runtimeVersion}\n`);
    this.write(`Description: ${info.description}\n`);
  }

  async formatThreads(threads: ThreadInfo[]): Promise<void> {
    if (threads.length === 0) {
      this.write('No threads found\n');
      return;
    }

    for (const thread of threads) {
      const status = thread.isSuspended
        ? this.colorize(chalk.yellow, '[SUSPENDED]')
        : this.colorize(chalk.green, '[RUNNING]');
      this.write(
        `Thread ${thread.id}: ${thread.name} ${status} (state: ${thread.state})\n`
      );
    }
  }

  async formatStack(frames: StackFrame[]): Promise<void> {
    if (frames.length === 0) {
      this.write('No stack frames\n');
      return;
    }

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const native = frame.isNative ? this.colorize(chalk.gray, '[native]') : '';
      this.write(
        `  #${i} ${frame.method} at ${frame.location}:${frame.line} ${native}\n`
      );
    }
  }

  async formatVariables(variables: Variable[]): Promise<void> {
    if (variables.length === 0) {
      this.write('No variables\n');
      return;
    }

    for (const v of variables) {
      const type = this.colorize(chalk.gray, v.type);
      const value = v.isNull
        ? this.colorize(chalk.red, 'null')
        : String(v.value);
      this.write(`  ${v.name}: ${type} = ${value}\n`);
    }
  }

  async formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void> {
    if (breakpoints.length === 0) {
      this.write('No breakpoints\n');
      return;
    }

    for (const bp of breakpoints) {
      const status = bp.enabled
        ? this.colorize(chalk.green, '[enabled]')
        : this.colorize(chalk.red, '[disabled]');
      this.write(
        `Breakpoint ${bp.id}: ${bp.location} ${status} (hits: ${bp.hitCount})\n`
      );
    }
  }

  async formatEvent(event: DebugEvent): Promise<void> {
    this.write(
      `Event: ${event.type} at ${event.location} (thread: ${event.threadId})\n`
    );
  }

  async formatError(error: Error): Promise<void> {
    this.write(this.colorize(chalk.red, `Error: ${error.message}\n`));
  }

  async formatVerboseError(error: Error): Promise<void> {
    await this.formatError(error);
    if (error.stack) {
      this.write(this.colorize(chalk.gray, error.stack) + '\n');
    }
  }

  private write(text: string): void {
    this.writer.write(text);
  }

  private colorize(color: chalk.Chalk, text: string): string {
    return this.useColor ? color(text) : text;
  }
}
```

### 3. json.ts - JSON 格式化

**功能**:
- 结构化 JSON 输出
- 美化输出
- 支持流式输出

**TypeScript 实现**:
```typescript
import type { Writable } from 'node:stream';
import process from 'node:process';
import type { Formatter } from './interface.js';

export class JsonFormatter implements Formatter {
  private writer: Writable = process.stdout;

  setWriter(writer: Writable): void {
    this.writer = writer;
  }

  async formatVersion(info: VersionInfo): Promise<void> {
    this.write({ type: 'version', data: info });
  }

  async formatThreads(threads: ThreadInfo[]): Promise<void> {
    this.write({ type: 'threads', data: threads });
  }

  async formatStack(frames: StackFrame[]): Promise<void> {
    this.write({ type: 'stack', data: frames });
  }

  async formatVariables(variables: Variable[]): Promise<void> {
    this.write({ type: 'variables', data: variables });
  }

  async formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void> {
    this.write({ type: 'breakpoints', data: breakpoints });
  }

  async formatEvent(event: DebugEvent): Promise<void> {
    this.write({ type: 'event', data: event });
  }

  async formatError(error: Error): Promise<void> {
    this.write({
      type: 'error',
      data: {
        name: error.name,
        message: error.message,
      },
    });
  }

  async formatVerboseError(error: Error): Promise<void> {
    this.write({
      type: 'error',
      data: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  private write(data: unknown): void {
    this.writer.write(JSON.stringify(data, null, 2) + '\n');
  }
}
```

### 4. table.ts - 表格格式化

**功能**:
- 表格化输出
- 列对齐
- 支持彩色

**TypeScript 实现**:
```typescript
import type { Writable } from 'node:stream';
import process from 'node:process';
import chalk from 'chalk';
import type { Formatter } from './interface.js';

export class TableFormatter implements Formatter {
  private writer: Writable = process.stdout;
  private useColor: boolean;

  constructor(options?: { color?: boolean }) {
    this.useColor = options?.color ?? true;
  }

  setWriter(writer: Writable): void {
    this.writer = writer;
  }

  async formatThreads(threads: ThreadInfo[]): Promise<void> {
    const rows = threads.map(t => [
      t.id,
      t.name,
      t.state,
      t.isSuspended ? 'Yes' : 'No',
      String(t.priority),
    ]);

    this.writeTable(
      ['ID', 'Name', 'State', 'Suspended', 'Priority'],
      rows
    );
  }

  async formatStack(frames: StackFrame[]): Promise<void> {
    const rows = frames.map((f, i) => [
      String(i),
      f.method,
      f.location,
      String(f.line),
      f.isNative ? 'Yes' : 'No',
    ]);

    this.writeTable(
      ['#', 'Method', 'Location', 'Line', 'Native'],
      rows
    );
  }

  async formatVariables(variables: Variable[]): Promise<void> {
    const rows = variables.map(v => [
      v.name,
      v.type,
      v.isNull ? 'null' : String(v.value),
      v.isPrimitive ? 'Yes' : 'No',
    ]);

    this.writeTable(
      ['Name', 'Type', 'Value', 'Primitive'],
      rows
    );
  }

  async formatBreakpoints(breakpoints: BreakpointInfo[]): Promise<void> {
    const rows = breakpoints.map(bp => [
      bp.id,
      bp.location,
      bp.enabled ? 'Yes' : 'No',
      String(bp.hitCount),
      bp.condition || '-',
    ]);

    this.writeTable(
      ['ID', 'Location', 'Enabled', 'Hits', 'Condition'],
      rows
    );
  }

  // ... 其他方法实现

  private writeTable(headers: string[], rows: string[][]): void {
    // Calculate column widths
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => r[i].length))
    );

    // Write header
    const headerLine = headers
      .map((h, i) => h.padEnd(widths[i]))
      .join(' | ');
    this.writer.write(this.colorize(chalk.bold, headerLine) + '\n');

    // Write separator
    const separator = widths.map(w => '-'.repeat(w)).join('-+-');
    this.writer.write(separator + '\n');

    // Write rows
    for (const row of rows) {
      const line = row
        .map((cell, i) => cell.padEnd(widths[i]))
        .join(' | ');
      this.writer.write(line + '\n');
    }
  }

  private colorize(color: chalk.Chalk, text: string): string {
    return this.useColor ? color(text) : text;
  }
}
```

### 5. index.ts - 模块导出和工厂函数

```typescript
import type { Writable } from 'node:stream';
import type { Formatter, FormatterType, FormatterOptions } from './interface.js';
import { TextFormatter } from './text.js';
import { JsonFormatter } from './json.js';
import { TableFormatter } from './table.js';

export type { Formatter, FormatterType, FormatterOptions } from './interface.js';
export { TextFormatter } from './text.js';
export { JsonFormatter } from './json.js';
export { TableFormatter } from './table.js';

/**
 * Create a formatter
 */
export function createFormatter(options: FormatterOptions): Formatter {
  const { type, color = true, writer } = options;

  let formatter: Formatter;

  switch (type) {
    case 'json':
      formatter = new JsonFormatter();
      break;
    case 'table':
      formatter = new TableFormatter({ color });
      break;
    case 'text':
    default:
      formatter = new TextFormatter({ color });
      break;
  }

  if (writer) {
    formatter.setWriter(writer);
  }

  return formatter;
}
```

## 依赖添加

需要添加以下依赖:

```json
{
  "dependencies": {
    "chalk": "^5.3.0"
  }
}
```

## 测试计划

### 单元测试 (`src/output/__tests__/`)

1. **text.test.ts**: 测试文本格式化
   - 测试各种类型的格式化
   - 测试彩色输出
   - 测试空数据处理

2. **json.test.ts**: 测试 JSON 格式化
   - 测试 JSON 输出格式
   - 测试数据序列化

3. **table.test.ts**: 测试表格格式化
   - 测试表格对齐
   - 测试列宽计算

4. **factory.test.ts**: 测试工厂函数
   - 测试创建各种格式化器
   - 测试 writer 设置

## 实现顺序

1. ✅ 创建 `src/output/` 目录
2. ✅ 实现 `interface.ts`
3. ✅ 实现 `text.ts`
4. ✅ 实现 `json.ts`
5. ✅ 实现 `table.ts`
6. ✅ 创建 `index.ts` 和工厂函数
7. ✅ 添加依赖
8. ✅ 编写单元测试
9. ✅ 验证构建和测试

## 注意事项

1. **流式输出**: 使用 Node.js Writable stream
2. **彩色输出**: 使用 chalk 库,支持禁用
3. **类型安全**: 所有方法返回 Promise<void>
4. **错误处理**: 格式化错误不应中断程序
5. **性能**: 避免不必要的数据转换
