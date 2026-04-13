# 第二阶段: 配置层实现计划

## 概述

实现配置管理系统,支持多源配置加载、验证和合并。

## 参考模块

### Go 版本参考 (`ref/internal/config/`)

- **config.go**: 配置结构定义和验证
- **loader.go**: 配置加载器 (Viper wrapper)
- **paths.go**: 跨平台路径解析

## 目录结构

```
src/config/
├── index.ts           # 模块导出
├── loader.ts          # 配置加载器
├── validator.ts       # 配置验证
└── paths.ts           # 路径解析
```

## 核心实现

### 1. paths.ts - 跨平台路径解析

**功能**:

- 解析配置文件路径
- 解析缓存目录路径
- 解析日志目录路径
- 支持跨平台 (Windows/macOS/Linux)

**参考实现** (`ref/internal/config/paths.go`):

```go
// GetConfigPath returns the path to the config directory
func GetConfigPath() string {
    if configPath := os.Getenv("DEBUGGER_CONFIG_PATH"); configPath != "" {
        return configPath
    }

    homeDir, _ := os.UserHomeDir()
    return filepath.Join(homeDir, ".config", "debugger")
}

// GetCachePath returns the path to the cache directory
func GetCachePath() string {
    if cachePath := os.Getenv("DEBUGGER_CACHE_PATH"); cachePath != "" {
        return cachePath
    }

    homeDir, _ := os.UserHomeDir()
    return filepath.Join(homeDir, ".cache", "debugger")
}
```

**TypeScript 实现**:

```typescript
import os from "node:os";
import path from "node:path";
import process from "node:process";

export function getConfigPath(): string {
  const envPath = process.env.DEBUGGER_CONFIG_PATH;
  if (envPath) return envPath;

  const homeDir = os.homedir();
  return path.join(homeDir, ".config", "debugger");
}

export function getCachePath(): string {
  const envPath = process.env.DEBUGGER_CACHE_PATH;
  if (envPath) return envPath;

  const homeDir = os.homedir();
  return path.join(homeDir, ".cache", "debugger");
}

export function getLogPath(): string {
  const envPath = process.env.DEBUGGER_LOG_PATH;
  if (envPath) return envPath;

  return path.join(getCachePath(), "logs");
}
```

### 2. validator.ts - 配置验证

**功能**:

- 使用 Zod schema 验证配置
- 提供详细的验证错误信息
- 支持部分验证 (允许未知字段)

**实现**:

```typescript
import { ZodError } from "zod";
import type { AppConfig, GlobalConfig } from "../types/config.js";
import { AppConfigSchema, GlobalConfigSchema } from "../types/config.js";
import { APIError, ErrorType, ErrorCodes } from "../protocol/errors.js";

export function validateAppConfig(config: unknown): AppConfig {
  try {
    return AppConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Configuration validation failed:\n${messages.join("\n")}`,
        error,
      );
    }
    throw error;
  }
}

export function validateGlobalConfig(config: unknown): GlobalConfig {
  try {
    return GlobalConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Global configuration validation failed:\n${messages.join("\n")}`,
        error,
      );
    }
    throw error;
  }
}
```

### 3. loader.ts - 配置加载器

**功能**:

- 多源配置加载 (优先级: CLI > 环境变量 > 项目配置 > 全局配置 > 默认值)
- 支持 TOML/JSON 配置文件
- 配置合并和覆盖
- Profile 切换

**参考实现** (`ref/internal/config/loader.go`):

```go
type Loader struct {
    v *viper.Viper
}

func NewLoader() *Loader {
    v := viper.New()
    // Set defaults
    v.SetDefault("protocol", "jdwp")
    v.SetDefault("host", "127.0.0.1")
    v.SetDefault("port", 5005)
    // ...
    return &Loader{v: v}
}

func (l *Loader) Load() (*Config, error) {
    // 1. Load global config
    // 2. Load project config
    // 3. Read environment variables
    // 4. Bind flags
    // 5. Unmarshal and validate
}
```

**TypeScript 实现**:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import toml from "@iarna/toml"; // 需要添加依赖
import type { AppConfig, GlobalConfig, Profile } from "../types/config.js";
import { createDefaultConfig } from "../types/config.js";
import { validateAppConfig, validateGlobalConfig } from "./validator.js";
import { getConfigPath } from "./paths.js";

export class ConfigLoader {
  private config: AppConfig;

  constructor() {
    this.config = createDefaultConfig();
  }

  /**
   * Load configuration from all sources
   * Priority: CLI > Env > Project > Global > Defaults
   */
  async load(options?: LoadOptions): Promise<AppConfig> {
    // 1. Load global config
    await this.loadGlobalConfig();

    // 2. Load project config
    await this.loadProjectConfig();

    // 3. Load from environment variables
    this.loadFromEnv();

    // 4. Load from CLI options
    if (options?.cliOptions) {
      this.mergeConfig(options.cliOptions);
    }

    // 5. Validate final config
    return validateAppConfig(this.config);
  }

  private async loadGlobalConfig(): Promise<void> {
    const configPath = path.join(getConfigPath(), "config.toml");
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const globalConfig = validateGlobalConfig(toml.load(content));
      this.mergeConfig(globalConfig.defaults);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  private async loadProjectConfig(): Promise<void> {
    const configPath = path.join(process.cwd(), ".debugger.toml");
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = toml.load(content);
      this.mergeConfig(config);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  private loadFromEnv(): void {
    const envMapping = {
      DEBUGGER_PROTOCOL: "connection.protocol",
      DEBUGGER_HOST: "connection.host",
      DEBUGGER_PORT: "connection.port",
      DEBUGGER_TIMEOUT: "connection.timeout",
      DEBUGGER_OUTPUT: "output.format",
      DEBUGGER_COLOR: "output.color",
      DEBUGGER_WATCH: "monitor.enabled",
      DEBUGGER_INTERVAL: "monitor.interval",
      DEBUGGER_VERBOSE: "verbose",
    };

    for (const [envKey, configPath] of Object.entries(envMapping)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        this.setConfigValue(configPath, value);
      }
    }
  }

  private mergeConfig(partial: Partial<AppConfig>): void {
    // Deep merge logic
  }

  private setConfigValue(path: string, value: string): void {
    // Set nested value by path
  }
}

export interface LoadOptions {
  cliOptions?: Partial<AppConfig>;
  profile?: string;
}
```

### 4. index.ts - 模块导出

```typescript
export { ConfigLoader } from "./loader.js";
export type { LoadOptions } from "./loader.js";
export { validateAppConfig, validateGlobalConfig } from "./validator.js";
export { getConfigPath, getCachePath, getLogPath } from "./paths.js";
```

## 依赖添加

需要添加以下依赖:

```json
{
  "dependencies": {
    "@iarna/toml": "^2.2.5"
  }
}
```

## 测试计划

### 单元测试 (`src/config/__tests__/`)

1. **paths.test.ts**: 测试路径解析
   - 测试默认路径
   - 测试环境变量覆盖
   - 测试跨平台兼容性

2. **validator.test.ts**: 测试配置验证
   - 测试有效配置
   - 测试无效配置
   - 测试部分配置

3. **loader.test.ts**: 测试配置加载
   - 测试默认配置
   - 测试环境变量加载
   - 测试配置文件加载
   - 测试配置合并
   - 测试优先级

## 实现顺序

1. ✅ 创建 `src/config/` 目录
2. ✅ 实现 `paths.ts`
3. ✅ 实现 `validator.ts`
4. ✅ 实现 `loader.ts`
5. ✅ 创建 `index.ts`
6. ✅ 添加依赖
7. ✅ 编写单元测试
8. ✅ 验证构建和测试

## 注意事项

1. **环境变量**: 统一使用 `DEBUGGER_` 前缀
2. **配置文件**: 支持 TOML、JSON 格式
3. **错误处理**: 使用 `APIError` 抛出验证错误
4. **类型安全**: 使用 Zod 进行运行时验证
5. **跨平台**: 确保路径解析在所有平台正常工作
