# 多语言调试 CLI

一个轻量级的多语言调试 CLI 客户端，采用插件化架构设计。

## 特性

- **插件化架构**: 支持多种调试协议（JDWP、DAP 等），易于扩展
- **统一命令接口**: 所有语言使用相同的 CLI 语法
- **无状态执行**: 每次命令独立连接，适合脚本和自动化
- **可选监控模式**: 支持实时观察调试状态变化
- **灵活输出格式**: 支持文本、JSON、表格格式
- **配置管理**: 支持 YAML/TOML 配置文件和环境变量
- **跨平台**: 支持 Windows、macOS、Linux

## 快速开始

### 构建

```bash
go build -o debugger
```

### 基本用法

```bash
# 显示帮助
debugger --help

# 查看版本
debugger version

# 连接到默认配置 (127.0.0.1:5005)
debugger threads

# 指定主机和端口
debugger --host 192.168.1.100 --port 5005 threads

# JSON 格式输出
debugger --json stack --thread-id 1

# 监控模式
debugger --watch --interval 2 threads
```

### 配置文件

创建 `.debugger.yaml` 在项目目录中：

```yaml
protocol: jdwp
host: 127.0.0.1
port: 5005
timeout: 30
output: text
```

或使用全局配置 `~/.config/debugger/config.yaml`：

```yaml
defaults:
  protocol: jdwp
  host: 127.0.0.1
  port: 5005

profiles:
  - name: dev-java
    config:
      host: 127.0.0.1
      port: 5005
```

## 项目结构

```
cli-debugger/
├── cmd/                      # CLI 命令实现
│   ├── root.go              # 根命令和全局标志
│   └── version.go           # version 命令
├── internal/
│   ├── api/                 # 协议插件层
│   │   ├── base.go          # DebugProtocol 接口定义
│   │   ├── client.go        # 插件注册与客户端工厂
│   │   └── jdwp/            # JDWP 插件（待实现）
│   ├── config/              # 配置管理
│   │   ├── config.go        # 配置结构定义
│   │   ├── loader.go        # 配置加载器
│   │   └── paths.go         # 配置路径解析
│   ├── output/              # 输出格式化
│   │   ├── formatter.go     # 格式化器接口
│   │   ├── text.go          # 文本格式化
│   │   ├── json.go          # JSON 格式化
│   │   └── table.go         # 表格格式化
│   ├── monitor/             # 监控模式（待实现）
│   │   ├── stream.go        # WebSocket 流式客户端
│   │   └── poller.go        # HTTP 轮询监控器
│   └── platform/            # 平台特定代码（待实现）
│       └── process.go       # 进程发现接口
├── pkg/
│   └── types/               # 通用类型定义
│       └── base.go          # 基础数据类型
├── configs/                 # 示例配置
│   └── example.yaml         # 示例配置文件
├── go.mod                   # Go 模块定义
└── main.go                  # 程序入口
```

## 支持的命令

| 命令 | 描述 |
|------|------|
| `version` | 显示版本信息 |
| `threads` | 获取线程列表 |
| `stack` | 获取调用栈 |
| `locals` | 获取局部变量 |
| `breakpoint` | 断点管理 |
| `suspend` | 挂起执行 |
| `resume` | 恢复执行 |
| `cont` | 继续执行 |
| `step` | 单步进入 |
| `next` | 单步跳过 |
| `finish` | 跳出当前方法 |
| `monitor` | 监控模式 |

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 输入错误 |
| 2 | 连接错误 |
| 3 | 协议错误 |

## 开发计划

### 阶段 1: 项目初始化与基础架构 ✅
- [x] 初始化 Go 项目
- [x] 定义统一调试协议接口
- [x] 实现插件注册与客户端工厂
- [x] 实现配置系统
- [x] 实现输出格式化器

### 阶段 2: JDWP 插件实现
- [ ] 实现 JDWP 协议编解码
- [ ] 实现 JDWP 握手协议
- [ ] 实现 VirtualMachine 命令集
- [ ] 实现 ThreadReference 命令集
- [ ] 实现 EventRequest 命令集

### 阶段 3: CLI 命令完善
- [ ] 实现所有核心命令
- [ ] 添加命令参数验证
- [ ] 实现错误处理和提示

### 阶段 4: 监控模式
- [ ] 实现 WebSocket 流式输出
- [ ] 实现 HTTP 轮询监控
- [ ] 添加终端刷新显示

### 阶段 5: 测试与文档
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 完善文档

## 许可证

MIT License