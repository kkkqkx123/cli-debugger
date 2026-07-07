/**
 * Configuration Builder
 *
 * Fluent API for building debug configurations programmatically.
 */

import type { DebugConfig } from "../../types/config.js";
import { DebugConfigSchema } from "../../types/config.js";

/**
 * Fluent configuration builder for debug connections.
 *
 * @example
 * ```ts
 * const config = new ConfigBuilder()
 *   .protocol('jdwp')
 *   .host('127.0.0.1')
 *   .port(5005)
 *   .timeout(30000)
 *   .build();
 * ```
 */
export class ConfigBuilder {
  private config: Partial<DebugConfig> = {};

  /** Set the debug protocol */
  protocol(name: string): this {
    this.config.protocol = name;
    return this;
  }

  /** Set the host address */
  host(host: string): this {
    this.config.host = host;
    return this;
  }

  /** Set the port number */
  port(port: number): this {
    this.config.port = port;
    return this;
  }

  /** Set the connection timeout in milliseconds */
  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }

  /**
   * Build and validate the configuration.
   * @returns Validated DebugConfig
   */
  build(): DebugConfig {
    return DebugConfigSchema.parse(this.config);
  }

  /**
   * Create a ConfigBuilder with preset values.
   */
  static create(): ConfigBuilder {
    return new ConfigBuilder();
  }
}