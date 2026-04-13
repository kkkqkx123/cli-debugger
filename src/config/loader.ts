/**
 * Configuration loader with multi-source config merging
 * Priority: CLI > Env > Project > Global > Defaults
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import TOML from '@iarna/toml';
import type { AppConfig } from '../types/config.js';
import { createDefaultConfig } from '../types/config.js';
import { validateAppConfig } from './validator.js';
import { getConfigPath } from './paths.js';

/** Options for configuration loading */
export interface LoadOptions {
  cliOptions?: Partial<AppConfig>;
  profile?: string;
}

/**
 * Configuration loader
 * Loads and merges configuration from multiple sources
 */
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
    // 1. Start with defaults
    this.config = createDefaultConfig();

    // 2. Load global config
    await this.loadGlobalConfig();

    // 3. Load project config
    await this.loadProjectConfig();

    // 4. Load from environment variables
    this.loadFromEnv();

    // 5. Load from CLI options
    if (options?.cliOptions) {
      this.mergeConfig(options.cliOptions);
    }

    // 6. Validate final config
    return validateAppConfig(this.config);
  }

  /**
   * Load global configuration from ~/.config/debugger/config.toml
   */
  private async loadGlobalConfig(): Promise<void> {
    const configPath = path.join(getConfigPath(), 'config.toml');
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = TOML.parse(content);
      if (parsed && typeof parsed === 'object' && 'defaults' in parsed) {
        const globalConfig = parsed as { defaults: Partial<AppConfig> };
        this.mergeConfig(globalConfig.defaults);
      }
    } catch {
      // Ignore if file doesn't exist or is invalid
    }
  }

  /**
   * Load project configuration from .debugger.toml in current working directory
   */
  private async loadProjectConfig(): Promise<void> {
    const configPath = path.join(process.cwd(), '.debugger.toml');
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = TOML.parse(content);
      this.mergeConfig(parsed as Partial<AppConfig>);
    } catch {
      // Ignore if file doesn't exist or is invalid
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): void {
    const envMapping: Record<string, string> = {
      DEBUGGER_PROTOCOL: 'connection.protocol',
      DEBUGGER_HOST: 'connection.host',
      DEBUGGER_PORT: 'connection.port',
      DEBUGGER_TIMEOUT: 'connection.timeout',
      DEBUGGER_OUTPUT: 'output.format',
      DEBUGGER_COLOR: 'output.color',
      DEBUGGER_WATCH: 'monitor.enabled',
      DEBUGGER_INTERVAL: 'monitor.interval',
      DEBUGGER_VERBOSE: 'verbose',
    };

    for (const [envKey, configPath] of Object.entries(envMapping)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        this.setConfigValue(configPath, value);
      }
    }
  }

  /**
   * Deep merge partial config into current config
   */
  private mergeConfig(partial: Partial<AppConfig>): void {
    if (partial.connection) {
      if (partial.connection.protocol !== undefined) {
        this.config.connection.protocol = partial.connection.protocol;
      }
      if (partial.connection.host !== undefined) {
        this.config.connection.host = partial.connection.host;
      }
      if (partial.connection.port !== undefined) {
        this.config.connection.port = partial.connection.port;
      }
      if (partial.connection.timeout !== undefined) {
        this.config.connection.timeout = partial.connection.timeout;
      }
    }

    if (partial.output) {
      if (partial.output.format !== undefined) {
        this.config.output.format = partial.output.format;
      }
      if (partial.output.color !== undefined) {
        this.config.output.color = partial.output.color;
      }
    }

    if (partial.monitor) {
      if (partial.monitor.enabled !== undefined) {
        this.config.monitor.enabled = partial.monitor.enabled;
      }
      if (partial.monitor.interval !== undefined) {
        this.config.monitor.interval = partial.monitor.interval;
      }
      if (partial.monitor.timeout !== undefined) {
        this.config.monitor.timeout = partial.monitor.timeout;
      }
    }

    if (partial.verbose !== undefined) {
      this.config.verbose = partial.verbose;
    }

    if (partial.plugins) {
      this.config.plugins = { ...this.config.plugins, ...partial.plugins };
    }
  }

  /**
   * Set a nested configuration value by dot-separated path
   */
  private setConfigValue(pathStr: string, value: string): void {
    const keys = pathStr.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key || !(key in current) || typeof current[key] !== 'object') {
        return;
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    if (!lastKey || !(lastKey in current)) {
      return;
    }

    // Convert string value to appropriate type
    const existingValue = current[lastKey];
    if (typeof existingValue === 'number') {
      const num = Number(value);
      if (!isNaN(num)) {
        current[lastKey] = num;
      }
    } else if (typeof existingValue === 'boolean') {
      current[lastKey] = value.toLowerCase() === 'true' || value === '1';
    } else {
      current[lastKey] = value;
    }
  }
}
