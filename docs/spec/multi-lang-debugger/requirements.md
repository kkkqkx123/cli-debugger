# 多语言调试 CLI - 需求文档

## 简介

本文档定义了一个通用的多语言调试 CLI 客户端的需求。该客户端采用**轻量插件化架构**，以 Java (JDWP) 作为第一个实现，预留扩展空间以支持其他语言的调试协议。客户端保持无状态特性，每次命令执行都是独立的（连接→执行→断开），状态由目标调试服务器维护。

---

## Requirement 1: 插件化架构基础

**User Story:** As a developer, I want the debugger to support a plugin-based architecture, so that I can add support for new languages without modifying the core framework.

**Acceptance Criteria:**
1.1 The system SHALL define a unified debug protocol interface that all language plugins must implement
1.2 The system SHALL implement a plugin registry for dynamic registration and creation of language plugins
1.3 Each plugin SHALL declare its metadata: protocol name, supported languages, capabilities
1.4 The system SHALL support loading plugins at compile time (Go packages)
1.5 The system SHALL allow selecting the active plugin via `--protocol` flag
1.6 Adding a new language plugin SHALL NOT require modifying core command logic

---

## Requirement 2: 统一 CLI 命令接口

**User Story:** As a user, I want to use consistent commands across all supported languages, so that I can debug different languages with the same CLI syntax.

**Acceptance Criteria:**
2.1 The system SHALL provide a unified command structure: `debugger <COMMAND> [OPTIONS]`
2.2 All plugins SHALL support core commands: version, threads, stack, locals, breakpoint, suspend, resume, cont, step, next, finish
2.3 The system SHALL display only available commands based on the active plugin's capabilities
2.4 Plugin-specific commands SHALL be exposed via namespaced subcommands (e.g., `debugger java:custom-cmd`)
2.5 Command output format SHALL be consistent across all plugins (text, JSON, table)
2.6 The system SHALL auto-detect the target language when `--protocol` is not specified (based on host:port or process info)

---

## Requirement 3: 无状态命令执行

**User Story:** As a user, I want each command to be completely stateless, so that I can use the debugger in scripts and automation without managing session state.

**Acceptance Criteria:**
3.1 Each command execution SHALL follow the pattern: connect → handshake → execute → disconnect
3.2 The system SHALL NOT store session state between command executions
3.3 The system SHALL NOT depend on results from previous commands (except for explicitly passed IDs)
3.4 Commands SHALL be executable in any order without requiring setup commands
3.5 The system SHALL support use in shell scripts and automation pipelines
3.6 Exit codes SHALL be consistent: 0 (success), 1 (input error), 2 (connection error), 3 (protocol error)

---

## Requirement 4: 可选的监控模式

**User Story:** As a developer monitoring real-time debug state, I want an optional watch mode that maintains a connection for periodic queries, so that I can observe changes without manual re-execution.

**Acceptance Criteria:**
4.1 Commands SHALL support a `--watch` or `-w` flag for continuous monitoring mode
4.2 Watch mode SHALL maintain a single connection with configurable refresh interval
4.3 Watch mode SHALL support a configurable timeout to prevent permanent connection
4.4 Watch mode SHALL handle Ctrl+C (SIGINT/SIGTERM) gracefully and close the connection
4.5 Watch mode SHALL fallback to polling if streaming (WebSocket) is unavailable
4.6 The system SHALL indicate the monitoring status and refresh interval in output

---

## Requirement 5: JDWP 插件（首个实现）

**User Story:** As a Java developer, I want to debug remote JVMs using JDWP protocol, so that I can inspect and control Java applications.

**Acceptance Criteria:**
5.1 The system SHALL implement JDWP protocol plugin supporting all core debug commands
5.2 The system SHALL support JDWP handshake protocol (JDWP-Handshake string exchange)
5.3 The system SHALL handle JDWP packet encoding/decoding (big-endian binary format)
5.4 The system SHALL support JDWP error code translation to user-friendly messages
5.5 The system SHALL retrieve ID sizes after connection (objectID, threadID, methodID, etc.)
5.6 JDWP SHALL be the default protocol when auto-detection identifies a Java target

---

## Requirement 6: 配置管理

**User Story:** As a user working with multiple debug targets, I want to save connection configurations in files, so that I can quickly reconnect without remembering parameters.

**Acceptance Criteria:**
6.1 The system SHALL support YAML and TOML configuration files
6.2 Configuration SHALL specify: protocol, host, port, timeout, and optional plugin-specific parameters
6.3 The system SHALL load configuration via `--config` flag or auto-discover `.debugger.yaml` in current directory
6.4 Users SHALL define named profiles in a global config file (`~/.config/debugger/config.yaml`)
6.5 CLI flags SHALL override configuration file values (highest priority)
6.6 The system SHALL validate configuration before attempting connection

---

## Requirement 7: 输出格式化

**User Story:** As a user, I want flexible output formatting including colored text, tables, and JSON, so that I can read debug information easily or integrate with other tools.

**Acceptance Criteria:**
7.1 The system SHALL support text output format by default (human-readable)
7.2 The system SHALL support JSON output format via `--json` or `-o json` flag
7.3 The system SHALL support table output format for list data (threads, breakpoints, classes)
7.4 The system SHALL support colored output for different value types (strings, numbers, booleans, errors)
7.5 The system SHALL support `--no-color` flag to disable colored output
7.6 Watch mode SHALL use terminal refresh for continuous display

---

## Requirement 8: 错误处理

**User Story:** As a user, I want clear and actionable error messages, so that I can understand and resolve debug failures quickly.

**Acceptance Criteria:**
8.1 The system SHALL provide descriptive error messages for connection failures, protocol errors, and invalid inputs
8.2 Error messages SHALL indicate whether the issue is plugin-specific or general framework error
8.3 The system SHALL include appropriate exit codes (0/1/2/3) based on error type
8.4 Errors SHALL be printed to stderr, normal output to stdout
8.5 Verbose mode (`--verbose`) SHALL show protocol-level details for troubleshooting

---

## Requirement 9: 跨平台兼容性

**User Story:** As a user on different operating systems, I want the debugger to work consistently across Windows, macOS, and Linux, so that I can use it in any development environment.

**Acceptance Criteria:**
9.1 The system SHALL be compilable and runnable on Windows, macOS, and Linux
9.2 The system SHALL use consistent command-line interface across all platforms
9.3 The system SHALL handle platform-specific process discovery and attachment
9.4 The system SHALL be distributed as a single binary with no external runtime dependencies
9.5 The system SHALL support cross-compilation via Go toolchain

---

## Requirement 10: 测试与质量保证

**User Story:** As a maintainer, I want comprehensive testing infrastructure, so that I can ensure reliability across supported languages.

**Acceptance Criteria:**
10.1 The system SHALL provide unit tests for core components with minimum 80% coverage
10.2 The system SHALL provide integration tests using a real JVM for JDWP plugin
10.3 The system SHALL mock protocol interfaces for testing command logic without live debug targets
10.4 The system SHALL provide test fixtures with sample debug sessions
10.5 CI pipeline SHALL run tests on Windows, macOS, and Linux

---

## 非功能性需求

### 架构
- NFR1: Adding a new language plugin SHALL require implementing only the debug protocol interface (no core changes)
- NFR2: Plugin code SHALL be isolated from core framework (no cross-plugin dependencies)
- NFR3: The system SHALL maintain backward compatibility when adding new plugins

### 性能
- NFR4: Connection establishment SHALL complete within 5 seconds for local targets
- NFR5: Simple commands (version, threads) SHALL return results within 1 second
- NFR6: Watch mode SHALL support configurable intervals (minimum 1 second)

### 可用性
- NFR7: The CLI SHALL provide comprehensive help documentation accessible via --help flag
- NFR8: Error messages SHALL be actionable and guide users toward resolution
- NFR9: The system SHALL display available commands based on active plugin capabilities

### 可扩展性
- NFR10: The plugin registry SHALL support programmatic registration for testing
- NFR11: Configuration SHALL allow enabling/disabling specific plugins
- NFR12: Plugin-specific commands SHALL be namespaced to avoid conflicts with core commands
