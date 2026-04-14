import { describe, it, expect, vi } from 'vitest';
import {
  getVersion,
  getIDSizes,
  getAllClasses,
  getAllThreads,
  classByName,
  suspendVM,
  resumeVM,
  dispose,
  exit,
  createString,
  getCapabilities,
  getCapabilitiesInfo,
  getClassPaths,
  holdEvents,
  releaseEvents,
  redefineClasses,
} from '../vm.js';
import { ErrorType, ErrorCodes } from '../../errors.js';

describe('vm', () => {
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

  describe('getVersion', () => {
    it('should get version success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('hello', 'utf8'),
          Buffer.from([0, 0, 0, 1, 0, 0, 0, 9]),
          Buffer.from([0, 0, 0, 3]),
          Buffer.from('1.8', 'utf8'),
          Buffer.from([0, 0, 0, 4]),
          Buffer.from('java', 'utf8'),
        ]),
      });
      const version = await getVersion(mockExecutor);
      expect(version).toEqual({
        protocolVersion: '1.9',
        runtimeVersion: '1.8',
        runtimeName: 'java',
        description: 'hello',
      });
    });

    it('should get version error', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 1,
        message: 'error',
        data: Buffer.alloc(0),
      });
      await expect(getVersion(mockExecutor)).rejects.toMatchObject({
        type: ErrorType.ProtocolError,
        code: ErrorCodes.ProtocolError,
      });
    });
  });

  describe('getIDSizes', () => {
    it('should get id sizes success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 8]),
      });
      const idSizes = await getIDSizes(mockExecutor);
      expect(idSizes).toEqual({
        fieldIDSize: 8,
        methodIDSize: 8,
        objectIDSize: 8,
        referenceTypeIDSize: 8,
        frameIDSize: 8,
      });
    });

    it('should get id sizes too short', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 8]),
      });
      await expect(getIDSizes(mockExecutor)).rejects.toMatchObject({
        type: ErrorType.ProtocolError,
        code: ErrorCodes.DecodeError,
      });
    });
  });

  describe('getAllClasses', () => {
    it('should get all classes success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 2]),
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
          Buffer.from([0, 0, 0, 2]),
        ]),
      });
      const classes = await getAllClasses(mockExecutor);
      expect(classes).toEqual([
        {
          tag: 0x4c,
          refID: '1',
          status: 1,
        },
        {
          tag: 0x4c,
          refID: '2',
          status: 2,
        },
      ]);
    });
  });

  describe('getAllThreads', () => {
    it('should get all threads success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 2]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
        ]),
      });
      const threads = await getAllThreads(mockExecutor);
      expect(threads).toEqual(['1', '2']);
    });
  });

  describe('classByName', () => {
    it('should find class by name success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0x4c]),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 1]),
        ]),
      });
      const cls = await classByName(mockExecutor, 'com.example.Main');
      expect(cls).toEqual({
        tag: 0x4c,
        refID: '1',
        status: 1,
      });
    });

    it('should find class by name not found', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([0, 0, 0, 0]),
      });
      const cls = await classByName(mockExecutor, 'com.example.NotFound');
      expect(cls).toBeNull();
    });
  });

  describe('suspendVM', () => {
    it('should suspend vm success', async () => {
      await suspendVM(mockExecutor);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('resumeVM', () => {
    it('should resume vm success', async () => {
      await resumeVM(mockExecutor);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose success', async () => {
      await dispose(mockExecutor);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('exit', () => {
    it('should exit success', async () => {
      await exit(mockExecutor, 0);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('createString', () => {
    it('should create string success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([Buffer.from([0x4c]), Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])]),
      });
      const str = await createString(mockExecutor, 'hello');
      expect(str).toBe('L:1');
    });
  });

  describe('getCapabilities', () => {
    it('should get capabilities success', async () => {
      const capabilities = await getCapabilities(mockExecutor);
      expect(capabilities).toEqual({
        supportsVersion: true,
        supportsThreads: true,
        supportsStack: true,
        supportsLocals: true,
        supportsBreakpoints: true,
        supportsSuspend: true,
        supportsResume: true,
        supportsStep: true,
        supportsCont: true,
        supportsNext: true,
        supportsFinish: true,
        supportsEvents: true,
        supportsWatchMode: true,
        supportsStreaming: true,
      });
    });
  });

  describe('getCapabilitiesInfo', () => {
    it('should get capabilities info success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      });
      const capabilities = await getCapabilitiesInfo(mockExecutor);
      expect(capabilities).toEqual({
        canWatchFieldModification: true,
        canWatchFieldAccess: true,
        canGetBytecodes: true,
        canGetSyntheticAttribute: true,
        canGetOwnedMonitorInfo: true,
        canGetCurrentContendedMonitor: true,
        canGetMonitorInfo: true,
        canRedefineClasses: true,
        canAddMethod: true,
        canUnrestrictedlyRedefineClasses: true,
        canPopFrames: true,
        canUseInstanceFilters: true,
        canGetSourceDebugExtension: true,
        canRequestVMDeathEvent: true,
        canSetDefaultStratum: true,
        canGetInstanceInfo: true,
        canRequestMonitorEvents: true,
        canGetMonitorFrameInfo: true,
        canGetConstantPool: true,
        canSetNativeMethodPrefix: true,
        canRedefineClassesWhenMismatched: true,
      });
    });
  });

  describe('getClassPaths', () => {
    it('should get class paths success', async () => {
      mockExecutor.readReply.mockResolvedValueOnce({
        errorCode: 0,
        message: '',
        data: Buffer.concat([
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('hello', 'utf8'),
          Buffer.from([0, 0, 0, 1]),
          Buffer.from([0, 0, 0, 5]),
          Buffer.from('world', 'utf8'),
        ]),
      });
      const paths = await getClassPaths(mockExecutor);
      expect(paths).toEqual({
        classpath: ['hello'],
        bootClasspath: ['world'],
      });
    });
  });

  describe('holdEvents', () => {
    it('should hold events success', async () => {
      await holdEvents(mockExecutor);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('releaseEvents', () => {
    it('should release events success', async () => {
      await releaseEvents(mockExecutor);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });

  describe('redefineClasses', () => {
    it('should redefine classes success', async () => {
      await redefineClasses(mockExecutor, [
        {
          refTypeID: '1',
          classBytes: Buffer.from([1, 2, 3]),
        },
      ]);
      expect(mockExecutor.sendPacket).toHaveBeenCalled();
    });
  });
});
