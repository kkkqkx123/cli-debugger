import { describe, it, expect, vi } from 'vitest';
import {
  getSignature,
  getFields,
  getMethods,
  getSourceFile,
  getStaticFieldValues,
  getValuesWithTags,
  setStaticFieldValue,
  getStatus,
  getInterfaces,
  getClassObject,
  getInstances,
  getClassFileVersion,
  getClassLoader,
} from '../reference-type.js';
import { ErrorType, ErrorCodes } from '../../errors.js';

describe('reference-type', () => {
  const mockExecutor = {
    sendPacket: vi.fn().mockResolvedValue(undefined),
    readReply: vi.fn().mockResolvedValue({
      errorCode: 0,
      message: '',
      data: Buffer.alloc(0),
    }),
    idSizes: {
      fieldIDSize: 8,
      methodIDSize: 8,
      objectIDSize: 8,
      referenceTypeIDSize: 8,
      frameIDSize: 8,
    },
  };

  describe('getSignature', () => {
    it('should get signature success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('x', 'utf8'),
        ]),
      });
      const signature = await getSignature(mockExecutor, '1');
      expect(signature).toBe('x');
    });
  });

  describe('getFields', () => {
    it('should get fields success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('x', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('I', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
        ]),
      });
      const fields = await getFields(mockExecutor, '1');
      expect(fields).toEqual([
        {
          fieldID: '1',
          name: 'x',
          signature: 'I',
          modifiers: 1,
        },
      ]);
    });
  });

  describe('getMethods', () => {
    it('should get methods success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('x', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('I', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
        ]),
      });
      const methods = await getMethods(mockExecutor, '1');
      expect(methods).toEqual([
        {
          methodID: '1',
          name: 'x',
          signature: 'I',
          modifiers: 1,
        },
      ]);
    });
  });

  describe('getSourceFile', () => {
    it('should get source file success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('x', 'utf8'),
        ]),
      });
      const sourceFile = await getSourceFile(mockExecutor, '1');
      expect(sourceFile).toBe('x');
    });
  });

  describe('getStaticFieldValues', () => {
    it('should get static field values success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 123]),
        ]),
      });
      const values = await getStaticFieldValues(mockExecutor, '1', ['1']);
      expect(values).toEqual([123]);
    });
  });

  describe('getValuesWithTags', () => {
    it('should get values with tags success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0x49]),
          Buffer.from([0, 0, 0, 123]),
        ]),
      });
      const result = await getValuesWithTags(mockExecutor, '1', ['1']);
      expect(result).toEqual({
        tags: [0x49],
        values: [123],
      });
    });
  });

  describe('setStaticFieldValue', () => {
    it('should set static field value success', async () => {
      await setStaticFieldValue(mockExecutor, '1', '1', 123);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should get status success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 1]),
      });
      const status = await getStatus(mockExecutor, '1');
      expect(status).toBe(1);
    });
  });

  describe('getInterfaces', () => {
    it('should get interfaces success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      });
      const interfaces = await getInterfaces(mockExecutor, '1');
      expect(interfaces).toEqual(['1']);
    });
  });

  describe('getClassObject', () => {
    it('should get class object success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const classObject = await getClassObject(mockExecutor, '1');
      expect(classObject).toBe('1');
    });
  });

  describe('getInstances', () => {
    it('should get instances success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
        ]),
      });
      const instances = await getInstances(mockExecutor, '1', 10);
      expect(instances).toEqual(['1']);
    });
  });

  describe('getClassFileVersion', () => {
    it('should get class file version success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 61]),
          Buffer.from([0, 0, 0, 0]),
        ]),
      });
      const version = await getClassFileVersion(mockExecutor, '1');
      expect(version).toEqual({
        majorVersion: 61,
        minorVersion: 0,
      });
    });
  });

  describe('getClassLoader', () => {
    it('should get class loader success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      });
      const classLoader = await getClassLoader(mockExecutor, '1');
      expect(classLoader).toBe('1');
    });
  });
});
