/**
 * Configuration validation utilities
 */

import { ZodError } from 'zod';
import type { AppConfig, GlobalConfig } from '../types/config.js';
import {
  AppConfigSchema,
  GlobalConfigSchema,
} from '../types/config.js';
import { APIError, ErrorType, ErrorCodes } from '../protocol/errors.js';

/**
 * Validate application configuration
 * @throws APIError if validation fails
 */
export function validateAppConfig(config: unknown): AppConfig {
  try {
    return AppConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Configuration validation failed:\n${messages.join('\n')}`,
        error as Error
      );
    }
    throw error;
  }
}

/**
 * Validate global configuration
 * @throws APIError if validation fails
 */
export function validateGlobalConfig(config: unknown): GlobalConfig {
  try {
    return GlobalConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new APIError(
        ErrorType.InputError,
        ErrorCodes.InvalidInput,
        `Global configuration validation failed:\n${messages.join('\n')}`,
        error as Error
      );
    }
    throw error;
  }
}
