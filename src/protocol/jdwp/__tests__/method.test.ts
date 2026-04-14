import { describe, it, expect, vi } from 'vitest';
import {
  getLineTable,
  getVariableTable,
  getBytecodes,
  isObsolete,
  getVariableTableWithGeneric,
} from '../method.js';

describe('method', () => {
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

  describe('getLineTable', () => {
    it('should get line table success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 42]),
        ]),
      });
      const lineTable = await getLineTable(mockExecutor, '1', '1');
      expect(lineTable).toEqual([
        {
          lineCodeIndex: 1n,
          lineNumber: 42,
        },
      ]);
    });
  });

  describe('getVariableTable', () => {
    it('should get variable table success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('x', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('I', 'utf8'),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 1]),
        ]),
      });
      const variableTable = await getVariableTable(mockExecutor, '1', '1');
      expect(variableTable).toEqual([
        {
          slot: 0,
          name: 'x',
          signature: 'I',
          codeIndex: 0n,
        },
      ]);
    });
  });

  describe('getBytecodes', () => {
    it('should get bytecodes success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 3]),
          Buffer.from([1, 2, 3]),
        ]),
      });
      const bytecodes = await getBytecodes(mockExecutor, '1', '1');
      expect(bytecodes).toEqual(Buffer.from([1, 2, 3]));
    });
  });

  describe('isObsolete', () => {
    it('should check is obsolete success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([1]),
      });
      const obsolete = await isObsolete(mockExecutor, '1', '1');
      expect(obsolete).toBe(true);
    });
  });

  describe('getVariableTableWithGeneric', () => {
    it('should get variable table with generic success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('x', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from('I', 'utf8'),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from([0, 0, 0, 1]),
        ]),
      });
      const variableTable = await getVariableTableWithGeneric(mockExecutor, '1', '1');
      expect(variableTable).toEqual([
        {
          slot: 0,
          name: 'x',
          signature: 'I',
          codeIndex: 0n,
        },
      ]);
    });
  });
});
