# JDWP 协议单元测试用例设计

## 概述

本文档定义了 `src/protocol/jdwp` 目录下各模块的单元测试用例设计。测试重点覆盖核心协议实现、编解码器、命令执行器和事件处理等关键功能。

## 测试原则

- **隔离性**: 每个测试用例独立运行，不依赖外部服务或网络连接
- **Mock 策略**: 使用 Mock 模拟网络 I/O 和 JDWP 响应
- **覆盖边界**: 测试正常路径、错误路径和边界条件
- **可读性**: 测试用例名称清晰描述测试意图

---

## 1. `client.ts` - JDWP 客户端核心

### 测试文件: `client.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `connect_success` | 成功建立连接 | 有效主机和端口 | 连接成功，`isConnected()` 返回 `true` | Socket 连接成功，握手成功，返回 IDSizes |
| `connect_already_connected` | 重复连接 | 已连接状态 | 直接返回，不重复连接 | - |
| `connect_socket_error` | Socket 连接失败 | 无效主机 | 抛出 `ConnectionError` | Socket 触发 `error` 事件 |
| `connect_timeout` | 连接超时 | 超时配置 | 抛出 `ConnectionError` | Socket 触发 `timeout` 事件 |
| `connect_handshake_timeout` | 握手超时 | 握手响应延迟 | 抛出 `ConnectionError` | Handshake 超时 |
| `connect_handshake_invalid` | 握手响应无效 | 错误的握手字符串 | 抛出 `ProtocolError` | 握手字符串不匹配 |
| `close_success` | 成功关闭连接 | 已连接状态 | `isConnected()` 返回 `false` | Socket `end` 回调执行 |
| `close_not_connected` | 关闭未连接的连接 | 未连接状态 | 直接返回 | - |
| `version_success` | 获取版本信息 | - | 返回 `VersionInfo` 对象 | 返回有效的版本数据 |
| `version_error` | 获取版本失败 | - | 抛出 `ProtocolError` | 返回错误码 |
| `capabilities_success` | 获取能力信息 | - | 返回 `Capabilities` 对象 | 返回有效数据 |
| `threads_success` | 获取线程列表 | - | 返回 `ThreadInfo[]` | 返回线程 ID 列表和线程状态 |
| `threads_suspend_error` | 获取线程时挂起失败 | - | 抛出 `ProtocolError` | `suspendVM` 返回错误 |
| `stack_success` | 获取线程堆栈 | 已挂起的线程 ID | 返回 `StackFrame[]` | 返回有效的堆栈帧数据 |
| `stack_not_suspended` | 获取未挂起线程堆栈 | 未挂起的线程 ID | 抛出 `CommandError` | 返回 `suspendStatus: 0` |
| `suspend_thread_success` | 挂起指定线程 | 线程 ID | 成功挂起 | 返回成功响应 |
| `suspend_vm_success` | 挂起整个 VM | - | 成功挂起 | 返回成功响应 |
| `resume_thread_success` | 恢复指定线程 | 线程 ID | 成功恢复 | 返回成功响应 |
| `resume_vm_success` | 恢复整个 VM | - | 成功恢复 | 返回成功响应 |
| `step_into_success` | 单步进入 | 线程 ID | 成功执行并等待事件 | 返回步骤事件 |
| `step_over_success` | 单步跳过 | 线程 ID | 成功执行并等待事件 | 返回步骤事件 |
| `step_out_success` | 单步跳出 | 线程 ID | 成功执行并等待事件 | 返回步骤事件 |
| `set_line_breakpoint_success` | 设置行断点 | `className.method:line` | 返回断点 ID | 返回有效的断点请求 ID |
| `set_line_breakpoint_class_not_found` | 设置断点时类未找到 | 无效类名 | 抛出 `CommandError` | `classByName` 返回 `null` |
| `set_line_breakpoint_method_not_found` | 设置断点时方法未找到 | 无效方法名 | 抛出 `CommandError` | 方法列表为空 |
| `set_line_breakpoint_line_not_found` | 设置断点时行号未找到 | 无效行号 | 抛出 `CommandError` | 行表为空或行号不存在 |
| `set_method_entry_breakpoint_success` | 设置方法入口断点 | `className.method` | 返回断点 ID | 返回有效的断点请求 ID |
| `set_method_exit_breakpoint_success` | 设置方法退出断点 | `className.method` | 返回断点 ID | 返回有效的断点请求 ID |
| `set_exception_breakpoint_all` | 设置所有异常断点 | `*` | 返回断点 ID | 返回有效的断点请求 ID |
| `set_exception_breakpoint_specific` | 设置特定异常断点 | 异常类名 | 返回断点 ID | 返回有效的断点请求 ID |
| `set_field_access_breakpoint_success` | 设置字段访问断点 | `className.fieldName` | 返回断点 ID | 返回有效的断点请求 ID |
| `set_field_modify_breakpoint_success` | 设置字段修改断点 | `ClassName.fieldName` | 返回断点 ID | 返回有效的断点请求 ID |
| `set_class_load_breakpoint_success` | 设置类加载断点 | 类名模式 | 返回断点 ID | 返回有效的断点请求 ID |
| `set_class_unload_breakpoint_success` | 设置类卸载断点 | 类名模式 | 返回断点 ID | 返回有效的断点请求 ID |
| `set_thread_start_breakpoint_success` | 设置线程启动断点 | 线程 ID | 返回断点 ID | 返回有效的断点请求 ID |
| `set_thread_death_breakpoint_success` | 设置线程死亡断点 | 线程 ID | 返回断点 ID | 返回有效的断点请求 ID |
| `remove_breakpoint_success` | 移除断点 | 断点 ID | 成功移除 | 返回成功响应 |
| `remove_breakpoint_not_found` | 移除不存在的断点 | 无效断点 ID | 直接返回 | - |
| `clear_breakpoints_success` | 清除所有断点 | - | 成功清除 | 返回成功响应 |
| `breakpoints_success` | 获取断点列表 | - | 返回 `BreakpointInfo[]` | - |
| `locals_success` | 获取局部变量 | 线程 ID 和帧索引 | 返回 `Variable[]` | 返回有效的变量表和值 |
| `locals_not_suspended` | 获取未挂起线程的局部变量 | 未挂起的线程 ID | 抛出 `CommandError` | 返回 `suspendStatus: 0` |
| `locals_invalid_frame_index` | 使用无效帧索引获取局部变量 | 超出范围的帧索引 | 抛出 `InputError` | 帧计数小于索引 |
| `fields_success` | 获取对象字段 | 对象 ID | 返回 `Variable[]` | 返回有效的字段列表和值 |
| `fields_invalid_object_id` | 使用无效对象 ID 获取字段 | 格式错误的 ID | 抛出 `InputError` | - |
| `set_field_success` | 设置字段值 | 对象 ID、字段 ID、值 | 成功设置 | 返回成功响应 |
| `set_field_static` | 设置静态字段 | 静态字段 ID 和值 | 成功设置 | 返回成功响应 |
| `set_field_instance` | 设置实例字段 | 实例字段 ID 和值 | 成功设置 | 返回成功响应 |
| `wait_for_event_success` | 等待事件 | - | 返回 `DebugEvent` | 返回有效的事件数据 |
| `wait_for_event_timeout` | 等待事件超时 | 超时时间 | 返回 `null` | 无事件数据 |

---

## 2. `handshake.ts` - JDWP 握手协议

### 测试文件: `handshake.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `perform_handshake_success` | 成功握手 | Socket 和超时时间 | 握手成功 | Socket 接收 `JDWP-Handshake`，发送响应 |
| `perform_handshake_timeout` | 握手超时 | Socket 和短超时 | 抛出 `ConnectionError` | Socket 不发送数据 |
| `perform_handshake_invalid_response` | 握手响应无效 | Socket | 抛出 `ProtocolError` | Socket 发送错误字符串 |
| `perform_handshake_socket_error` | Socket 错误 | Socket | 抛出 `ConnectionError` | Socket 触发 `error` 事件 |
| `perform_handshake_connection_closed` | 连接关闭 | Socket | 抛出 `ConnectionError` | Socket 触发 `close` 事件 |
| `perform_handshake_write_error` | 写入响应失败 | Socket | 抛出 `ConnectionError` | Socket `write` 回调返回错误 |

---

## 3. `codec.ts` - 编解码器

### 测试文件: `codec.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 |
|---------|------|------|---------|
| `get_next_packet_id` | 获取下一个包 ID | - | 递增的包 ID |
| `reset_packet_id_counter` | 重置包 ID 计数器 | - | 计数器重置为 1 |
| `encode_command_packet` | 编码命令包 | ID、命令集、命令、数据 | 有效的命令包 Buffer |
| `create_command_packet` | 创建命令包（无数据） | 命令集、命令 | 有效的命令包 Buffer |
| `create_command_packet_with_data` | 创建命令包（带数据） | 命令集、命令、数据 | 有效的命令包 Buffer |
| `decode_reply_packet_success` | 解码成功响应 | 有效的响应数据 | `ReplyPacket` 对象 |
| `decode_reply_packet_too_short` | 解码过短的包 | 长度 < 11 的数据 | 抛出错误 |
| `decode_reply_packet_invalid_flag` | 解码无效标志 | 标志 ≠ `REPLY_FLAG` | 抛出错误 |
| `encode_id` | 编码 ID | ID 字符串和大小 | 编码后的 Buffer |
| `encode_string` | 编码字符串 | 字符串 | 长度前缀 + UTF-8 字符串 |
| `decode_string_success` | 解码字符串 | 有效的字符串数据 | `{ value, remaining }` |
| `decode_string_too_short` | 解码过短的字符串 | 长度 < 4 的数据 | 抛出错误 |
| `decode_string_insufficient_data` | 解码数据不足 | 声明长度 > 实际长度 | 抛出错误 |
| `encode_uint32` | 编码 uint32 | 数字 | 4 字节大端序 Buffer |
| `encode_int32` | 编码 int32 | 数字 | 4 字节大端序 Buffer |
| `encode_uint64` | 编码 uint64 | bigint | 8 字节大端序 Buffer |
| `encode_int64` | 编码 int64 | bigint | 8 字节大端序 Buffer |
| `encode_byte` | 编码字节 | 数字 | 1 字节 Buffer |
| `encode_boolean` | 编码布尔值 | 布尔值 | 1 字节 Buffer (0/1) |
| `is_primitive_tag_byte` | 判断字节类型 | `0x42` | `true` |
| `is_primitive_tag_char` | 判断字符类型 | `0x43` | `true` |
| `is_primitive_tag_double` | 判断双精度类型 | `0x44` | `true` |
| `is_primitive_tag_float` | 判断浮点类型 | `0x46` | `true` |
| `is_primitive_tag_int` | 判断整数类型 | `0x49` | `true` |
| `is_primitive_tag_long` | 判断长整型 | `0x4a` | `true` |
| `is_primitive_tag_short` | 判断短整型 | `0x53` | `true` |
| `is_primitive_tag_boolean` | 判断布尔类型 | `0x5a` | `true` |
| `is_primitive_tag_object` | 判断对象类型 | `0x4c` | `false` |
| `encode_value_null` | 编码 null 值 | `null` | 对象引用 (tag 0x4c + 零 ID) |
| `encode_value_boolean` | 编码布尔值 | `true` / `false` | 布尔编码 |
| `encode_value_integer` | 编码整数 | 整数 | int32 编码 |
| `encode_value_float` | 编码浮点数 | 浮点数 | float 编码 |
| `encode_value_bigint` | 编码长整型 | bigint | int64 编码 |
| `encode_value_string` | 编码字符串 | 字符串 | 对象引用 (tag 0x4c + ID) |
| `encode_value_unknown` | 编码未知类型 | 未知类型 | null 对象引用 |

---

## 4. `reader.ts` - 包读取器

### 测试文件: `reader.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 |
|---------|------|------|---------|
| `reader_position` | 获取当前位置 | - | 当前读取位置 |
| `reader_remaining` | 获取剩余字节数 | - | 剩余字节数 |
| `reader_has_more` | 检查是否有更多数据 | - | `true` / `false` |
| `reader_read_byte` | 读取字节 | - | 字节值 |
| `reader_read_byte_at_end` | 读取字节（超出范围） | - | `0` |
| `reader_read_int` | 读取 int32 | - | 整数值 |
| `reader_read_int_at_end` | 读取 int32（超出范围） | - | `0` |
| `reader_read_uint32` | 读取 uint32 | - | 无符号整数值 |
| `reader_read_uint32_at_end` | 读取 uint32（超出范围） | - | `0` |
| `reader_read_int64` | 读取 int64 | - | bigint 值 |
| `reader_read_int64_at_end` | 读取 int64（超出范围） | - | `0n` |
| `reader_read_uint64` | 读取 uint64 | - | 无符号 bigint 值 |
| `reader_read_uint64_at_end` | 读取 uint64（超出范围） | - | `0n` |
| `reader_read_id_4bytes` | 读取 4 字节 ID | 大小 4 | ID 字符串 |
| `reader_read_id_8bytes` | 读取 8 字节 ID | 大小 8 | ID 字符串 |
| `reader_read_id_custom` | 读取自定义大小 ID | 自定义大小 | ID 字符串 |
| `reader_read_id_at_end` | 读取 ID（超出范围） | - | `"0"` |
| `reader_read_string_success` | 读取字符串 | 有效的字符串数据 | 字符串值 |
| `reader_read_string_invalid_length` | 读取字符串（无效长度） | 负长度 | `""` |
| `reader_read_string_insufficient_data` | 读取字符串（数据不足） | 长度 > 剩余数据 | `""` |
| `reader_read_bytes_success` | 读取字节数组 | 有效的字节数据 | Buffer |
| `reader_read_bytes_invalid_length` | 读取字节数组（无效长度） | 负长度 | 空Buffer |
| `reader_read_bytes_insufficient_data` | 读取字节数组（数据不足） | 长度 > 剩余数据 | 空Buffer |
| `reader_read_value_byte` | 读取字节值 | tag `0x42` | 字节值 |
| `reader_read_value_char` | 读取字符值 | tag `0x43` | uint32 值 |
| `reader_read_value_double` | 读取双精度值 | tag `0x44` | double 值 |
| `reader_read_value_float` | 读取浮点值 | tag `0x46` | float 值 |
| `reader_read_value_int` | 读取整数值 | tag `0x49` | int32 值 |
| `reader_read_value_long` | 读取长整型值 | tag `0x4a` | bigint 值 |
| `reader_read_value_object` | 读取对象值 | tag `0x4c` | `"tag:id"` 格式字符串 |
| `reader_read_value_short` | 读取短整型值 | tag `0x53` | int16 值 |
| `reader_read_value_boolean` | 读取布尔值 | tag `0x5a` | `true` / `false` |
| `reader_read_value_void` | 读取 void 值 | tag `0x56` | `null` |
| `reader_read_value_array` | 读取数组值 | tag `0x5b` | `"tag:id"` 格式字符串 |
| `reader_read_value_unknown` | 读取未知类型值 | 未知 tag | `"unknown(tag)"` 格式字符串 |
| `reader_read_tagged_value` | 读取带标签的值 | - | `{ tag, value }` |
| `reader_read_location` | 读取位置信息 | IDSizes | `{ typeTag, classID, methodID, codeIndex }` |
| `reader_skip` | 跳过字节 | 跳过字节数 | 位置更新 |
| `reader_read_remaining` | 读取剩余数据 | - | 剩余 Buffer |

---

## 5. `vm.ts` - VirtualMachine 命令集

### 测试文件: `vm.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_version_success` | 获取版本信息 | - | `VersionInfo` 对象 | 返回有效的版本数据 |
| `get_version_error` | 获取版本失败 | - | 抛出 `ProtocolError` | 返回错误码 |
| `get_id_sizes_success` | 获取 ID 大小 | - | `IDSizes` 对象 | 返回有效的 ID 大小数据 |
| `get_id_sizes_too_short` | ID 大小响应过短 | - | 抛出 `ProtocolError` | 返回长度 < 20 的数据 |
| `get_all_classes_success` | 获取所有类 | - | `ClassInfo[]` | 返回有效的类列表 |
| `get_all_threads_success` | 获取所有线程 | - | `string[]` (线程 ID 列表) | 返回有效的线程 ID 列表 |
| `class_by_name_success` | 按名称查找类 | 类名 | `ClassInfo` | 返回有效的类信息 |
| `class_by_name_not_found` | 按名称查找类（未找到） | 不存在的类名 | `null` | 返回 `count: 0` |
| `suspend_vm_success` | 挂起 VM | - | 成功 | 返回成功响应 |
| `resume_vm_success` | 恢复 VM | - | 成功 | 返回成功响应 |
| `dispose_success` | 释放调试会话 | - | 成功 | 返回成功响应 |
| `exit_success` | 退出 VM | 退出码 | 成功 | 返回成功响应 |
| `create_string_success` | 创建字符串 | 字符串 | `"tag:id"` 格式字符串 | 返回有效的字符串 ID |
| `get_capabilities_success` | 获取能力 | - | `Capabilities` 对象 | 返回成功响应 |
| `get_capabilities_info_success` | 获取详细能力信息 | - | `VMCapabilitiesInfo` 对象 | 返回有效的能力标志 |
| `get_class_paths_success` | 获取类路径 | - | `ClassPathsInfo` 对象 | 返回有效的类路径列表 |
| `hold_events_success` | 暂停事件 | - | 成功 | 返回成功响应 |
| `release_events_success` | 释放事件 | - | 成功 | 返回成功响应 |
| `redefine_classes_success` | 重定义类 | `ClassDef[]` | 成功 | 返回成功响应 |

---

## 6. `thread.ts` - ThreadReference 命令集

### 测试文件: `thread.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_thread_name_success` | 获取线程名称 | 线程 ID | 线程名称字符串 | 返回有效的线程名称 |
| `get_thread_status_success` | 获取线程状态 | 线程 ID | `{ threadStatus, suspendStatus }` | 返回有效的状态值 |
| `get_thread_state_success` | 获取线程状态字符串 | 线程 ID | 状态字符串 | 返回有效的状态值 |
| `suspend_thread_success` | 挂起线程 | 线程 ID | 成功 | 返回成功响应 |
| `resume_thread_success` | 恢复线程 | 线程 ID | 成功 | 返回成功响应 |
| `get_thread_frames_success` | 获取线程帧 | 线程 ID、起始帧、长度 | `StackFrameInfo[]` | 返回有效的帧数据 |
| `get_thread_frame_count_success` | 获取线程帧计数 | 线程 ID | 帧计数 | 返回有效的帧计数 |
| `get_thread_stack_success` | 获取线程堆栈 | 线程 ID | `StackFrame[]` | 返回有效的堆栈数据 |
| `get_thread_stack_empty` | 获取空堆栈 | 线程 ID | `[]` | 返回 `frameCount: 0` |
| `get_thread_group_success` | 获取线程组 | 线程 ID | 线程组 ID | 返回有效的线程组 ID |
| `get_owned_monitors_success` | 获取持有的监视器 | 线程 ID | `string[]` (监视器 ID 列表) | 返回有效的监视器列表 |
| `get_current_contended_monitor_success` | 获取当前竞争的监视器 | 线程 ID | 监视器 ID | 返回有效的监视器 ID |
| `stop_thread_success` | 停止线程 | 线程 ID、异常 ID | 成功 | 返回成功响应 |
| `interrupt_thread_success` | 中断线程 | 线程 ID | 成功 | 返回成功响应 |
| `get_suspend_count_success` | 获取挂起计数 | 线程 ID | 挂起计数 | 返回有效的挂起计数 |
| `force_early_return_success` | 强制提前返回 | 线程 ID、帧 ID、值 | 成功 | 返回成功响应 |

---

## 7. `stack-frame.ts` - StackFrame 命令集

### 测试文件: `stack-frame.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_stack_frame_values_success` | 获取栈帧值 | 线程 ID、帧 ID、槽数 | `Variable[]` | 返回有效的变量值 |
| `set_stack_frame_values_success` | 设置栈帧值 | 线程 ID、帧 ID、值映射 | 成功 | 返回成功响应 |
| `get_this_object_success` | 获取 this 对象 | 线程 ID、帧 ID | `{ tag, objectID }` | 返回有效的对象信息 |
| `pop_frames_success` | 弹出帧 | 线程 ID、帧 ID | 成功 | 返回成功响应 |

---

## 8. `method.ts` - Method 命令集

### 测试文件: `method.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_line_table_success` | 获取行表 | refTypeID、methodID | `LineLocation[]` | 返回有效的行表数据 |
| `get_variable_table_success` | 获取变量表 | refTypeID、methodID | `VariableInfo[]` | 返回有效的变量表 |
| `get_bytecodes_success` | 获取字节码 | refTypeID、methodID | Buffer (字节码) | 返回有效的字节码 |
| `is_obsolete_success` | 检查是否过时 | refTypeID、methodID | `true` / `false` | 返回有效的过时标志 |
| `get_variable_table_with_generic_success` | 获取带泛型的变量表 | refTypeID、methodID | `VariableInfo[]` | 返回有效的变量表 |

---

## 9. `reference-type.ts` - ReferenceType 命令集

### 测试文件: `reference-type.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_signature_success` | 获取类签名 | refTypeID | 签名字符串 | 返回有效的签名 |
| `get_fields_success` | 获取字段列表 | refTypeID | `FieldInfo[]` | 返回有效的字段列表 |
| `get_methods_success` | 获取方法列表 | refTypeID | `MethodInfo[]` | 返回有效的方法列表 |
| `get_source_file_success` | 获取源文件名 | refTypeID | 源文件名字符串 | 返回有效的源文件名 |
| `get_static_field_values_success` | 获取静态字段值 | refTypeID、字段 ID 列表 | `unknown[]` | 返回有效的字段值 |
| `get_values_with_tags_success` | 获取带标签的静态字段值 | refTypeID、字段 ID 列表 | `{ tags[], values[] }` | 返回有效的字段值和标签 |
| `set_static_field_value_success` | 设置静态字段值 | refTypeID、字段 ID、值 | 成功 | 返回成功响应 |
| `get_status_success` | 获取类状态 | refTypeID | 状态值 | 返回有效的状态值 |
| `get_interfaces_success` | 获取实现的接口 | refTypeID | `string[]` (接口 ID 列表) | 返回有效的接口列表 |
| `get_class_object_success` | 获取类对象 | refTypeID | 类对象 ID | 返回有效的类对象 ID |
| `get_instances_success` | 获取类实例 | refTypeID、最大实例数 | `string[]` (实例 ID 列表) | 返回有效的实例列表 |
| `get_class_file_version_success` | 获取类文件版本 | refTypeID | `{ majorVersion, minorVersion }` | 返回有效的版本信息 |
| `get_class_loader_success` | 获取类加载器 | refTypeID | 类加载器 ID | 返回有效的类加载器 ID |

---

## 10. `object-reference.ts` - ObjectReference 命令集

### 测试文件: `object-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_reference_type_success` | 获取对象引用类型 | 对象 ID | `{ tag, refTypeID }` | 返回有效的引用类型信息 |
| `get_instance_field_values_success` | 获取实例字段值 | 对象 ID、字段 ID 列表 | `unknown[]` | 返回有效的字段值 |
| `set_instance_field_values_success` | 设置实例字段值 | 对象 ID、字段值映射 | 成功 | 返回成功响应 |
| `set_instance_field_value_success` | 设置单个实例字段值 | 对象 ID、字段 ID、值 | 成功 | 返回成功响应 |
| `get_monitor_info_success` | 获取监视器信息 | 对象 ID | `MonitorInfo` | 返回有效的监视器信息 |
| `invoke_instance_method_success` | 调用实例方法 | 对象 ID、线程 ID、方法 ID、参数、选项 | `{ returnValue, exception }` | 返回有效的调用结果 |
| `disable_collection_success` | 禁用垃圾回收 | 对象 ID | 成功 | 返回成功响应 |
| `enable_collection_success` | 启用垃圾回收 | 对象 ID | 成功 | 返回成功响应 |
| `is_collected_success` | 检查是否已回收 | 对象 ID | `true` / `false` | 返回有效的回收标志 |
| `get_referring_objects_success` | 获取引用对象 | 对象 ID、最大引用数 | `string[]` (引用对象 ID 列表) | 返回有效的引用对象列表 |

---

## 11. `class-type.ts` - ClassType 命令集

### 测试文件: `class-type.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_superclass_success` | 获取父类 | 类 ID | 父类 ID | 返回有效的父类 ID |
| `set_static_field_values_success` | 设置静态字段值 | 类 ID、字段值映射 | 成功 | 返回成功响应 |
| `invoke_static_method_success` | 调用静态方法 | 类 ID、线程 ID、方法 ID、参数、选项 | `{ returnValue, exception }` | 返回有效的调用结果 |
| `new_instance_success` | 创建新实例 | 类 ID、线程 ID、方法 ID、参数、选项 | `{ newInstance, exception }` | 返回有效的实例信息 |

---

## 12. `array-reference.ts` - ArrayReference 命令集

### 测试文件: `array-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_array_length_success` | 获取数组长度 | 数组 ID | 数组长度 | 返回有效的长度值 |
| `get_array_values_success` | 获取数组值 | 数组 ID、起始索引、长度 | `unknown[]` | 返回有效的数组值 |
| `set_array_values_success` | 设置数组值 | 数组 ID、起始索引、值列表 | 成功 | 返回成功响应 |

---

## 13. `string-reference.ts` - StringReference 命令集

### 测试文件: `string-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_string_value_success` | 获取字符串值 | 字符串 ID | 字符串值 | 返回有效的字符串值 |

---

## 14. `thread-group-reference.ts` - ThreadGroupReference 命令集

### 测试文件: `thread-group-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_thread_group_name_success` | 获取线程组名称 | 线程组 ID | 线程组名称 | 返回有效的线程组名称 |
| `get_parent_thread_group_success` | 获取父线程组 | 线程组 ID | 父线程组 ID | 返回有效的父线程组 ID |
| `get_thread_group_children_success` | 获取线程组子元素 | 线程组 ID | `{ childGroups[], childThreads[] }` | 返回有效的子元素列表 |

---

## 15. `class-loader-reference.ts` - ClassLoaderReference 命令集

### 测试文件: `class-loader-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_visible_classes_success` | 获取可见类 | 类加载器 ID | `{ classes[] }` | 返回有效的类列表 |

---

## 16. `class-object-reference.ts` - ClassObjectReference 命令集

### 测试文件: `class-object-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_reflected_type_success` | 获取反射类型 | 类对象 ID | refTypeID | 返回有效的反射类型 ID |

---

## 17. `module-reference.ts` - ModuleReference 命令集

### 测试文件: `module-reference.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `get_module_name_success` | 获取模块名称 | 模块 ID | 模块名称字符串 | 返回有效的模块名称 |
| `get_module_class_loader_success` | 获取模块类加载器 | 模块 ID | 类加载器 ID | 返回有效的类加载器 ID |

---

## 18. `event.ts` - EventRequest 命令集

### 测试文件: `event.test.ts`

| 测试用例 | 描述 | 输入 | 预期输出 | Mock 行为 |
|---------|------|------|---------|-----------|
| `set_breakpoint_request_success` | 设置断点请求 | 类 ID、方法 ID、代码索引、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `clear_breakpoint_request_success` | 清除断点请求 | 请求 ID | 成功 | 返回成功响应 |
| `clear_all_breakpoints_success` | 清除所有断点 | - | 成功 | 返回成功响应 |
| `set_step_request_success` | 设置单步请求 | 线程 ID、步骤类型、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_class_prepare_request_success` | 设置类准备请求 | 挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_thread_start_request_success` | 设置线程启动请求 | 挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_thread_death_request_success` | 设置线程死亡请求 | 挂起策略 | 请求 ID | 返回有效的请求 ID |
| `parse_event_breakpoint` | 解析断点事件 | 事件数据、IDSizes | `DebugEvent` (type: "breakpoint") | - |
| `parse_event_step` | 解析单步事件 | 事件数据、IDSizes | `DebugEvent` (type: "step") | - |
| `parse_event_exception` | 解析异常事件 | 事件数据、IDSizes | `DebugEvent` (type: "exception") | - |
| `parse_event_thread_start` | 解析线程启动事件 | 事件数据、IDSizes | `DebugEvent` (type: "thread_start") | - |
| `parse_event_thread_death` | 解析线程死亡事件 | 事件数据、IDSizes | `DebugEvent` (type: "thread_death") | - |
| `parse_event_class_prepare` | 解析类准备事件 | 事件数据、IDSizes | `DebugEvent` (type: "class_prepare") | - |
| `parse_event_class_unload` | 解析类卸载事件 | 事件数据、IDSizes | `DebugEvent` (type: "class_unload") | - |
| `parse_event_class_load` | 解析类加载事件 | 事件数据、IDSizes | `DebugEvent` (type: "class_load") | - |
| `parse_event_field_access` | 解析字段访问事件 | 事件数据、IDSizes | `DebugEvent` (type: "field_access") | - |
| `parse_event_field_modification` | 解析字段修改事件 | 事件数据、IDSizes | `DebugEvent` (type: "field_modification") | - |
| `parse_event_vm_start` | 解析 VM 启动事件 | 事件数据、IDSizes | `DebugEvent` (type: "vm_start") | - |
| `parse_event_vm_death` | 解析 VM 死亡事件 | 事件数据、IDSizes | `DebugEvent` (type: "vm_death") | - |
| `parse_event_method_entry` | 解析方法入口事件 | 事件数据、IDSizes | `DebugEvent` (type: "method_entry") | - |
| `parse_event_method_exit` | 解析方法退出事件 | 事件数据、IDSizes | `DebugEvent` (type: "method_exit") | - |
| `parse_event_unknown` | 解析未知事件 | 事件数据、IDSizes | `DebugEvent` (type: "unknown(...)") | - |
| `parse_event_no_events` | 解析无事件 | 空事件数据、IDSizes | `null` | - |
| `set_method_request_entry_success` | 设置方法入口请求 | 事件类型、类 ID、方法 ID、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_method_request_exit_success` | 设置方法退出请求 | 事件类型、类 ID、方法 ID、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_exception_request_all_success` | 设置所有异常请求 | `null`、caught、uncaught、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_exception_request_specific_success` | 设置特定异常请求 | 异常 refTypeID、caught、uncaught、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_field_request_access_success` | 设置字段访问请求 | 事件类型、声明类、字段 ID、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_field_request_modify_success` | 设置字段修改请求 | 事件类型、声明类、字段 ID、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_class_request_load_success` | 设置类加载请求 | 事件类型、类模式、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_class_request_unload_success` | 设置类卸载请求 | 事件类型、类模式、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_thread_request_start_success` | 设置线程启动请求 | 事件类型、线程 ID、挂起策略 | 请求 ID | 返回有效的请求 ID |
| `set_thread_request_death_success` | 设置线程死亡请求 | 事件类型、线程 ID、挂起策略 | 请求 ID | 返回有效的请求 ID |

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 | 优先级 |
|------|-----------|--------|
| `client.ts` | ≥ 80% | 高 |
| `handshake.ts` | ≥ 90% | 高 |
| `codec.ts` | ≥ 95% | 高 |
| `reader.ts` | ≥ 95% | 高 |
| `vm.ts` | ≥ 80% | 中 |
| `thread.ts` | ≥ 80% | 中 |
| `stack-frame.ts` | ≥ 80% | 中 |
| `method.ts` | ≥ 80% | 中 |
| `reference-type.ts` | ≥ 80% | 中 |
| `object-reference.ts` | ≥ 80% | 中 |
| `class-type.ts` | ≥ 80% | 低 |
| `array-reference.ts` | ≥ 80% | 低 |
| `string-reference.ts` | ≥ 90% | 低 |
| `thread-group-reference.ts` | ≥ 80% | 低 |
| `class-loader-reference.ts` | ≥ 80% | 低 |
| `class-object-reference.ts` | ≥ 90% | 低 |
| `module-reference.ts` | ≥ 80% | 低 |
| `event.ts` | ≥ 85% | 高 |

---

## Mock 工具设计

### JDWPExecutor Mock

```typescript
interface MockJDWPExecutor {
  sendPacket: vi.Mock<Promise<void>>;
  readReply: vi.Mock<Promise<{ errorCode: number; message: string; data: Buffer }>>;
  idSizes: IDSizes;
}

function createMockExecutor(overrides?: Partial<MockJDWPExecutor>): MockJDWPExecutor {
  return {
    sendPacket: vi.fn().mockResolvedValue(undefined),
    readReply: vi.fn().mockResolvedValue({
      errorCode: 0,
      message: '',
      data: Buffer.alloc(0),
    }),
    idSizes: {
      fieldIDSize: 8,
      methodIDSize: 8,
      objectIDSize: 8,
      referenceTypeIDSize: 8,
      frameIDSize: 8,
    },
    ...overrides,
  };
}
```

### Socket Mock

```typescript
function createMockSocket(): Partial<net.Socket> {
  return {
    write: vi.fn((data, callback) => callback?.()),
    on: vi.fn(),
    setTimeout: vi.fn(),
    destroy: vi.fn(),
    end: vi.fn((callback) => callback?.()),
  };
}
```

---

## 测试执行

```bash
# 运行所有 JDWP 测试
npm test -- src/protocol/jdwp

# 运行特定模块测试
npm test -- src/protocol/jdwp/__tests__/client.test.ts

# 生成覆盖率报告
npm test -- --coverage src/protocol/jdwp
```

---

## 注意事项

1. **全局状态**: `codec.ts` 中的 `packetIdCounter` 是全局变量，测试间需要调用 `resetPacketIdCounter()` 重置
2. **异步测试**: 所有涉及网络 I/O 的测试必须使用 `async/await`
3. **错误处理**: 每个命令函数的错误路径都需要单独测试
4. **边界条件**: 测试空列表、零长度、无效 ID 等边界情况
5. **类型安全**: 使用 TypeScript 严格模式，确保类型正确性

---

## 更新日志

- 2026-04-14: 初始版本，完成所有模块的测试用例设计
