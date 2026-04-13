# JDWP CLI 客户端需求文档

## 简介

本文档定义了一个基于 Go 语言实现的无状态 JDWP (Java Debug Wire Protocol) CLI 客户端的需求。该客户端采用命令式操作模式，每次命令执行都是独立的、无状态的，状态由目标 JVM 的 JDWP 服务端维护。客户端通过 TCP 连接与远程 JVM 通信，同步获取命令执行结果并作为命令返回值输出。

---

## Requirement 1: JDWP 协议基础通信

**User Story:** As a developer, I want the CLI client to establish connections with remote JVMs using the JDWP protocol, so that I can execute debug commands remotely.

**Acceptance Criteria:**
1.1 The system SHALL implement JDWP handshake protocol by exchanging "JDWP-Handshake" string with the target JVM
1.2 The system SHALL encode command packets in the format: [4-byte length][4-byte ID][1-byte flags][1-byte command set][1-byte command][data]
1.3 The system SHALL decode reply packets in the format: [4-byte length][4-byte ID][1-byte flags][2-byte error code][data]
1.4 The system SHALL handle JDWP error codes and provide meaningful error messages to the user
1.5 The system SHALL create a new TCP connection for each command execution and close it after completion
1.6 The system SHALL retrieve ID sizes (objectID, threadID, methodID, etc.) after connection establishment

---

## Requirement 2: CLI 命令解析与执行框架

**User Story:** As a user, I want to execute debug commands through a clear CLI interface with proper argument parsing, so that I can interact with remote JVMs easily.

**Acceptance Criteria:**
2.1 The system SHALL accept commands in the format: `jdwp-cli <COMMAND> [OPTIONS] --host <IP> --port <PORT>`
2.2 The system SHALL require --host and --port parameters for all commands that need JVM connection
2.3 The system SHALL support at least the following core commands: version, threads, classes, suspend, resume, cont, step, next
2.4 The system SHALL provide help text when executed with --help flag
2.5 The system SHALL return exit code 0 on success and non-zero on failure
2.6 The system SHALL format output in human-readable text format by default

---

## Requirement 3: 虚拟机信息查询

**User Story:** As a developer, I want to query basic information about the target JVM, so that I can understand the runtime environment.

**Acceptance Criteria:**
3.1 The system SHALL provide a `version` command that returns JDWP version, JVM version, and JVM name
3.2 The system SHALL provide a `threads` command that lists all thread IDs and their names
3.3 The system SHALL provide a `classes` command that searches for classes by signature or name pattern
3.4 The system SHALL provide a `capabilities` command that shows the debugging capabilities of the target JVM
3.5 The system SHALL provide a `classpath` command that displays the classpath and boot classpath

---

## Requirement 4: 断点管理

**User Story:** As a developer, I want to set, remove, and clear breakpoints in the target JVM, so that I can control execution flow during debugging.

**Acceptance Criteria:**
4.1 The system SHALL provide a `breakpoint add` command that accepts class name and line number to set line breakpoints
4.2 The system SHALL provide a `breakpoint add` command that accepts class name and method name to set method breakpoints
4.3 The system SHALL provide a `breakpoint remove` command that accepts a breakpoint ID to remove a specific breakpoint
4.4 The system SHALL provide a `breakpoint clear` command that removes all breakpoints
4.5 The system SHALL return the assigned breakpoint ID when successfully adding a breakpoint
4.6 The system SHALL handle the case where the specified class or method does not exist and return an appropriate error

---

## Requirement 5: 执行控制

**User Story:** As a developer, I want to control the execution of the target JVM (continue, step, etc.), so that I can debug code step by step.

**Acceptance Criteria:**
5.1 The system SHALL provide a `suspend` command to suspend the entire VM
5.2 The system SHALL provide a `resume` command to resume the entire VM
5.3 The system SHALL provide a `cont` command to continue execution after a breakpoint hit
5.4 The system SHALL provide a `step` command to step into method calls
5.5 The system SHALL provide a `next` command to step over (execute next line without entering methods)
5.6 The system SHALL provide a `finish` command to step out of the current method
5.7 The execution control commands SHALL wait for the corresponding event to occur before returning (blocking until event or timeout)
5.8 The system SHALL implement a configurable timeout (default 30 seconds) for execution control commands to prevent indefinite blocking

---

## Requirement 6: 栈帧与变量查看

**User Story:** As a developer, I want to inspect the call stack and local variables when execution is suspended, so that I can understand the current program state.

**Acceptance Criteria:**
6.1 The system SHALL provide a `stack` command that displays the call stack frames for a specified thread
6.2 The system SHALL require --thread parameter for the stack command to specify which thread to inspect
6.3 The system SHALL provide a `locals` command that displays local variables for a specified thread and frame
6.4 The system SHALL require --thread and --frame parameters for the locals command
6.5 The system SHALL display variable names, types, and values in the locals output
6.6 The system SHALL handle cases where the thread is not suspended and return an appropriate error

---

## Requirement 7: 字段值查看与修改

**User Story:** As a developer, I want to view and modify field values of classes and objects, so that I can inspect and change program state during debugging.

**Acceptance Criteria:**
7.1 The system SHALL provide a `field get` command to retrieve static field values of a class
7.2 The system SHALL provide a `field get` command to retrieve instance field values (requires object ID)
7.3 The system SHALL provide a `field list` command to list all fields of a class with their signatures
7.4 The system SHALL handle field value formatting based on the field type (primitive types vs object references)

---

## Requirement 8: 事件监听与处理

**User Story:** As a developer, I want the CLI client to handle JDWP events (breakpoint hits, step completion, etc.), so that I can receive feedback when execution control commands are issued.

**Acceptance Criteria:**
8.1 The system SHALL listen for JDWP event packets after issuing execution control commands
8.2 The system SHALL parse Composite event packets containing breakpoint hits, step completions, and other debug events
8.3 The system SHALL display event information including event type, thread ID, and location when an event occurs
8.4 The system SHALL handle multiple events in a single Composite packet
8.5 The system SHALL gracefully handle connection loss and VM termination events

---

## Requirement 9: 无状态特性

**User Story:** As a user, I want each CLI command to be completely stateless and independent, so that I can use the client in scripts and automation without managing session state.

**Acceptance Criteria:**
9.1 The system SHALL NOT store any session state between command executions
9.2 Each command execution SHALL follow the pattern: connect → handshake → execute → disconnect
9.3 The system SHALL NOT depend on results from previous command executions (except for explicitly passed IDs)
9.4 The system SHALL allow commands to be executed in any order without requiring setup commands
9.5 The system SHALL support use in shell scripts and automation pipelines

---

## Requirement 10: 错误处理与输出格式化

**User Story:** As a user, I want clear error messages and flexible output formatting, so that I can understand failures and integrate the CLI with other tools.

**Acceptance Criteria:**
10.1 The system SHALL provide descriptive error messages for connection failures, JDWP errors, and invalid inputs
10.2 The system SHALL support --json flag to output results in JSON format for programmatic consumption
10.3 The system SHALL output human-readable text format by default
10.4 The system SHALL include appropriate exit codes (0 for success, 1 for general errors, 2 for connection errors, 3 for JDWP protocol errors)
10.5 The system SHALL print errors to stderr and normal output to stdout

---

## Requirement 11: 跨平台兼容性

**User Story:** As a user working on different operating systems, I want the CLI client to work consistently across Windows, macOS, and Linux, so that I can use it in any development environment.

**Acceptance Criteria:**
11.1 The system SHALL be compilable and runnable on Windows, macOS, and Linux
11.2 The system SHALL handle path separators and file operations correctly on each platform
11.3 The system SHALL use consistent command-line interface across all platforms
11.4 The system SHALL be distributed as a single binary with no external dependencies

---

## 非功能性需求

### 性能

- NFR1: Connection establishment and command execution SHALL complete within reasonable time (typically < 1 second for simple queries)
- NFR2: The system SHALL handle network timeouts gracefully with configurable timeout values

### 可维护性

- NFR3: The code SHALL be organized in clear layers (protocol, client, CLI)
- NFR4: The system SHALL use standard Go libraries where possible to minimize dependencies

### 可用性

- NFR5: The CLI SHALL provide comprehensive help documentation accessible via --help flag
- NFR6: Error messages SHALL be actionable and guide users toward resolution
