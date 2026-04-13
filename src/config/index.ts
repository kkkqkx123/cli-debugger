/**
 * Configuration module
 * Provides configuration loading, validation, and path resolution
 */

export { ConfigLoader } from './loader.js';
export type { LoadOptions } from './loader.js';
export { validateAppConfig, validateGlobalConfig } from './validator.js';
export { getConfigPath, getCachePath, getLogPath } from './paths.js';
