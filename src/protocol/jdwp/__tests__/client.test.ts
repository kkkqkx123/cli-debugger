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
});
