/**
 * Client factory and protocol registry
 */

import type { DebugProtocol, ProtocolFactory } from './base.js';
import type { DebugConfig } from '../types/config.js';
import { DebugConfigSchema } from '../types/config.js';
import { APIError, ErrorType, ErrorCodes } from './errors.js';

/** Protocol registry */
const registry = new Map<string, ProtocolFactory>();

/**
 * Register a protocol plugin
 * @param name - Protocol name
 * @param factory - Protocol factory function
 * @throws APIError if protocol is already registered
 */
export function registerProtocol(name: string, factory: ProtocolFactory): void {
  if (!name || name.trim() === '') {
    throw new APIError(
      ErrorType.InputError,
      ErrorCodes.InvalidInput,
      'Protocol name cannot be empty'
    );
  }

  if (!factory) {
    throw new APIError(
      ErrorType.InputError,
      ErrorCodes.InvalidInput,
      'Protocol factory cannot be null'
    );
  }

  if (registry.has(name)) {
    throw new APIError(
      ErrorType.InputError,
      ErrorCodes.InvalidInput,
      `Protocol '${name}' is already registered`
    );
  }

  registry.set(name, factory);
}

/**
 * Unregister a protocol plugin
 * @param name - Protocol name
 * @returns true if protocol was unregistered, false if it didn't exist
 */
export function unregisterProtocol(name: string): boolean {
  return registry.delete(name);
}

/**
 * Create a debugging client
 * @param config - Debug configuration
 * @returns Connected debug protocol client
 * @throws APIError if protocol is not registered or connection fails
 */
export async function createClient(config: DebugConfig): Promise<DebugProtocol> {
  // Validate configuration
  const validatedConfig = DebugConfigSchema.parse(config);

  const factory = registry.get(validatedConfig.protocol);

  if (!factory) {
    throw new APIError(
      ErrorType.InputError,
      ErrorCodes.UnsupportedCommand,
      `Protocol '${validatedConfig.protocol}' is not registered. Available protocols: ${getRegisteredProtocols().join(', ')}`
    );
  }

  const client = factory(validatedConfig);
  await client.connect();
  return client;
}

/**
 * Create a client without connecting
 * @param config - Debug configuration
 * @returns Unconnected debug protocol client
 * @throws APIError if protocol is not registered
 */
export function createClientWithoutConnect(
  config: DebugConfig
): DebugProtocol {
  // Validate configuration
  const validatedConfig = DebugConfigSchema.parse(config);

  const factory = registry.get(validatedConfig.protocol);

  if (!factory) {
    throw new APIError(
      ErrorType.InputError,
      ErrorCodes.UnsupportedCommand,
      `Protocol '${validatedConfig.protocol}' is not registered. Available protocols: ${getRegisteredProtocols().join(', ')}`
    );
  }

  return factory(validatedConfig);
}

/**
 * Get the list of registered protocols
 * @returns Array of protocol names
 */
export function getRegisteredProtocols(): string[] {
  return Array.from(registry.keys());
}

/**
 * Check if a protocol is registered
 * @param name - Protocol name
 * @returns true if protocol is registered
 */
export function hasProtocol(name: string): boolean {
  return registry.has(name);
}

/**
 * Get protocol factory
 * @param name - Protocol name
 * @returns Protocol factory or undefined
 */
export function getProtocolFactory(name: string): ProtocolFactory | undefined {
  return registry.get(name);
}

/**
 * Clear all registered protocols
 * Mainly useful for testing
 */
export function clearRegistry(): void {
  registry.clear();
}
