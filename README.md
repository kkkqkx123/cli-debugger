# CLI Debugger

多语言调试 CLI 客户端,采用插件化架构,使用 TypeScript 实现。

## 项目状态

✅ 已完成核心接口和类型定义
🚧 JDWP 协议实现进行中

## 项目结构

```
cli-debugger/
├── src/                           # 源代码
│   ├── index.ts                   # 主入口
│   └── protocol/                  # 协议层
│       ├── index.ts               # 模块导出
│       ├── types.ts               # 类型定义
│       ├── base.ts                # DebugProtocol 接口
│       ├── errors.ts              # 错误类型
│       └── client.ts              # 客户端工厂
├── test/                          # 测试文件
│   └── protocol/
│       └── client.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 核心接口

### DebugProtocol

所有协议插件必须实现的核心接口:

```typescript
interface DebugProtocol {
  // 生命周期
  connect(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;

  // 元数据
  version(): Promise<VersionInfo>;
  capabilities(): Promise<Capabilities>;
  protocolName(): string;
  supportedLanguages(): string[];

  // 线程管理
  threads(): Promise<ThreadInfo[]>;
  stack(threadId: string): Promise<StackFrame[]>;
  threadState(threadId: string): Promise<string>;

  // 执行控制
  suspend(threadId?: string): Promise<void>;
  resume(threadId?: string): Promise<void>;
  stepInto(threadId: string): Promise<void>;
  stepOver(threadId: string): Promise<void>;
  stepOut(threadId: string): Promise<void>;

  // 断点管理
  setBreakpoint(location: string, condition?: string): Promise<string>;
  removeBreakpoint(id: string): Promise<void>;
  clearBreakpoints(): Promise<void>;
  breakpoints(): Promise<BreakpointInfo[]>;

  // 变量检查
  locals(threadId: string, frameIndex: number): Promise<Variable[]>;
  fields(objectId: string): Promise<Variable[]>;

  // 事件处理
  waitForEvent(timeout?: number): Promise<DebugEvent | null>;
}
```

## 使用示例

### 注册协议

```typescript
import { registerProtocol, createClient } from 'cli-debugger';

// 注册自定义协议
registerProtocol('my-protocol', (config) => new MyProtocolClient(config));

// 创建客户端
const client = await createClient({
  protocol: 'my-protocol',
  host: 'localhost',
  port: 5005,
});
```

### 使用客户端

```typescript
// 获取所有线程
const threads = await client.threads();

// 暂停线程
await client.suspend(threads[0].id);

// 获取调用栈
const stack = await client.stack(threads[0].id);

// 获取局部变量
const locals = await client.locals(threads[0].id, 0);

// 恢复线程
await client.resume(threads[0].id);

// 关闭连接
await client.close();
```

## 开发

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm run test
```

### 类型检查

```bash
npm run typecheck
```

## 技术栈

- **TypeScript 5.9.3** - 类型安全的 JavaScript 超集
- **Zod 4.3.6** - 运行时类型验证
- **Vitest 4.0.18** - 快速的单元测试框架
- **Node.js >= 22.0.0** - 运行时环境

## License

MIT
