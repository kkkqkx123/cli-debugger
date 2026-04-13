import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfigPath, getCachePath, getLogPath } from '../paths.js';

describe('paths', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfigPath', () => {
    it('should return env path when DEBUGGER_CONFIG_PATH is set', () => {
      process.env.DEBUGGER_CONFIG_PATH = '/custom/config/path';
      expect(getConfigPath()).toBe('/custom/config/path');
    });

    it('should return default path when env is not set', () => {
      delete process.env.DEBUGGER_CONFIG_PATH;
      const result = getConfigPath();
      expect(result).toContain('.config');
      expect(result).toContain('debugger');
    });
  });

  describe('getCachePath', () => {
    it('should return env path when DEBUGGER_CACHE_PATH is set', () => {
      process.env.DEBUGGER_CACHE_PATH = '/custom/cache/path';
      expect(getCachePath()).toBe('/custom/cache/path');
    });

    it('should return default path when env is not set', () => {
      delete process.env.DEBUGGER_CACHE_PATH;
      const result = getCachePath();
      expect(result).toContain('.cache');
      expect(result).toContain('debugger');
    });
  });

  describe('getLogPath', () => {
    it('should return env path when DEBUGGER_LOG_PATH is set', () => {
      process.env.DEBUGGER_LOG_PATH = '/custom/log/path';
      expect(getLogPath()).toBe('/custom/log/path');
    });

    it('should return default log path under cache directory', () => {
      delete process.env.DEBUGGER_LOG_PATH;
      delete process.env.DEBUGGER_CACHE_PATH;
      const result = getLogPath();
      expect(result).toContain('logs');
    });

    it('should use custom cache path when DEBUGGER_CACHE_PATH is set', () => {
      process.env.DEBUGGER_CACHE_PATH = '/custom/cache';
      delete process.env.DEBUGGER_LOG_PATH;
      const result = getLogPath();
      expect(result).toContain('/custom/cache');
      expect(result).toContain('logs');
    });
  });
});
