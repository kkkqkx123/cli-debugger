import { describe, it, expect } from 'vitest';
import { JDWPClient } from '../client.js';

describe('client', () => {
  const config = {
    protocol: 'jdwp',
    host: '127.0.0.1',
    port: 5005,
    timeout: 5000,
  };

  describe('protocolName', () => {
    it('should get protocol name', () => {
      const client = new JDWPClient(config);
      expect(client.protocolName()).toBe('jdwp');
    });
  });

  describe('supportedLanguages', () => {
    it('should get supported languages', () => {
      const client = new JDWPClient(config);
      expect(client.supportedLanguages()).toEqual(['java', 'kotlin', 'scala']);
    });
  });

  describe('isConnected', () => {
    it('should check is connected', () => {
      const client = new JDWPClient(config);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('supportsFeature', () => {
    it('should return true for all 8 extended features', () => {
      const client = new JDWPClient(config);
      expect(client.supportsFeature('eval')).toBe(true);
      expect(client.supportsFeature('enableDisableBreakpoint')).toBe(true);
      expect(client.supportsFeature('extendedBreakpointInfo')).toBe(true);
      expect(client.supportsFeature('typeInfo')).toBe(true);
      expect(client.supportsFeature('symbolInfo')).toBe(true);
      expect(client.supportsFeature('targetMetadata')).toBe(true);
      expect(client.supportsFeature('threadBatchInfo')).toBe(true);
      expect(client.supportsFeature('expandVariable')).toBe(true);
    });

    it('should return false for unknown features', () => {
      const client = new JDWPClient(config);
      expect(client.supportsFeature('nonexistent' as any)).toBe(false);
    });
  });
});
