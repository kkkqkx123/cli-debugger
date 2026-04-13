/**
 * Configuration type definitions
 * Uses Zod for runtime validation
 */

import { z } from 'zod';

/** Debug connection configuration schema */
export const DebugConfigSchema = z.object({
  protocol: z.string().min(1).default('jdwp'),
  host: z.string().min(1).default('127.0.0.1'),
  port: z.number().int().positive().default(5005),
  timeout: z.number().int().positive().default(30000),
});

/** Debug connection configuration type */
export type DebugConfig = z.infer<typeof DebugConfigSchema>;
/** Partial debug configuration (for external API calls) */
export type PartialDebugConfig = Partial<DebugConfig>;

/** Output configuration schema */
export const OutputConfigSchema = z.object({
  format: z.enum(['text', 'json', 'table']).default('text'),
  color: z.boolean().default(true),
});

/** Output configuration type */
export type OutputConfig = z.infer<typeof OutputConfigSchema>;

/** Monitor configuration schema */
export const MonitorConfigSchema = z.object({
  enabled: z.boolean().default(false),
  interval: z.number().int().positive().default(1000),
  timeout: z.number().int().positive().default(60000),
});

/** Monitor configuration type */
export type MonitorConfig = z.infer<typeof MonitorConfigSchema>;

/** Full application configuration schema */
export const AppConfigSchema = z.object({
  // Connection settings
  connection: DebugConfigSchema,
  // Output settings
  output: OutputConfigSchema,
  // Monitor settings
  monitor: MonitorConfigSchema,
  // Debug settings
  verbose: z.boolean().default(false),
  // Plugin-specific settings
  plugins: z.record(z.string(), z.unknown()).default({}),
});

/** Full application configuration type */
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** Profile configuration schema */
export const ProfileSchema = z.object({
  name: z.string().min(1),
  config: AppConfigSchema,
});

/** Profile configuration type */
export type Profile = z.infer<typeof ProfileSchema>;

/** Global configuration schema (for config file) */
export const GlobalConfigSchema = z.object({
  defaults: AppConfigSchema,
  profiles: z.array(ProfileSchema).default([]),
  plugins: z.record(z.string(), z.unknown()).default({}),
});

/** Global configuration type */
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

/**
 * Create default configuration
 */
export function createDefaultConfig(): AppConfig {
  return {
    connection: {
      protocol: 'jdwp',
      host: '127.0.0.1',
      port: 5005,
      timeout: 30000,
    },
    output: {
      format: 'text',
      color: true,
    },
    monitor: {
      enabled: false,
      interval: 1000,
      timeout: 60000,
    },
    verbose: false,
    plugins: {},
  };
}
