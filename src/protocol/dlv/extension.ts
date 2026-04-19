/**
 * Go-specific debug extension interface
 */

import type { DebugProtocol } from "../base.js";
import type { StackFrame, Variable } from "../../types/debug.js";
import type {
  DlvGoroutine,
  DlvListGoroutinesParams,
  DlvDeferredCall,
  DlvCheckpoint,
  DlvLibrary,
} from "./types.js";

/**
 * Go-specific debug extension interface
 */
export interface GoDebugExtension {
  // ==================== Goroutine Extensions ====================

  /**
   * List goroutines with advanced filtering
   */
  goroutinesFiltered(
    params: DlvListGoroutinesParams,
  ): Promise<DlvGoroutine[]>;

  /**
   * Get goroutine labels
   */
  goroutineLabels(goroutineId: number): Promise<Record<string, string>>;

  /**
   * Execute command on all goroutines
   */
  execOnAllGoroutines(
    command: string,
    filter?: DlvListGoroutinesParams,
  ): Promise<Map<number, unknown>>;

  // ==================== Deferred Calls ====================

  /**
   * List deferred calls in frame
   */
  deferredCalls(
    threadId: string,
    frameIndex: number,
  ): Promise<DlvDeferredCall[]>;

  // ==================== Package Variables ====================

  /**
   * List package variables
   */
  packageVars(filter?: string): Promise<Variable[]>;

  /**
   * List package constants
   */
  packageConstants(filter?: string): Promise<Variable[]>;

  // ==================== Reverse Execution ====================

  /**
   * Step backward (requires recording mode)
   */
  stepBack(threadId: string): Promise<void>;

  /**
   * Rewind execution (requires recording mode)
   */
  rewind(): Promise<void>;

  // ==================== Checkpoints ====================

  /**
   * Create checkpoint
   */
  createCheckpoint(note?: string): Promise<DlvCheckpoint>;

  /**
   * List checkpoints
   */
  listCheckpoints(): Promise<DlvCheckpoint[]>;

  /**
   * Clear checkpoint
   */
  clearCheckpoint(id: number): Promise<void>;

  // ==================== Stack Navigation ====================

  /**
   * Move up in call stack
   */
  frameUp(steps?: number): Promise<StackFrame | null>;

  /**
   * Move down in call stack
   */
  frameDown(steps?: number): Promise<StackFrame | null>;

  /**
   * Set current frame
   */
  setFrame(index: number): Promise<void>;

  // ==================== Instruction Level ====================

  /**
   * Step single instruction
   */
  stepInstruction(threadId: string): Promise<void>;

  /**
   * Next instruction (skip calls)
   */
  nextInstruction(threadId: string): Promise<void>;

  // ==================== Function Arguments ====================

  /**
   * Get function arguments
   */
  args(threadId: string, frameIndex: number): Promise<Variable[]>;

  // ==================== Information Queries ====================

  /**
   * List functions
   */
  listFunctions(filter?: string): Promise<string[]>;

  /**
   * List packages
   */
  listPackages(filter?: string): Promise<string[]>;

  /**
   * List source files
   */
  listSources(filter?: string): Promise<string[]>;

  /**
   * List types
   */
  listTypes(filter?: string): Promise<string[]>;

  /**
   * List dynamic libraries
   */
  listLibraries(): Promise<DlvLibrary[]>;

  // ==================== Memory & Registers ====================

  /**
   * Examine memory at address
   */
  examineMemory(address: number, length: number): Promise<{
    address: number;
    memory: number[];
    isLittleEndian: boolean;
  }>;

  /**
   * Get CPU registers
   */
  registers(includeFp?: boolean): Promise<
    Array<{ name: string; value: string }>
  >;

  // ==================== Disassembly ====================

  /**
   * Disassemble code
   */
  disassemble(
    startPC?: number,
    endPC?: number,
  ): Promise<Array<{ pc: number; text: string; bytes: number[] }>>;

  // ==================== Configuration ====================

  /**
   * Get debugger configuration
   */
  getConfig(): Promise<Record<string, unknown>>;

  /**
   * Set debugger configuration
   */
  setConfig(key: string, value: unknown): Promise<void>;

  // ==================== Process Control ====================

  /**
   * Restart process
   */
  restart(position?: string): Promise<void>;

  /**
   * Rebuild and restart
   */
  rebuild(): Promise<void>;

  /**
   * Dump core
   */
  dumpCore(outputPath: string): Promise<void>;
}

/**
 * Combined interface for full Go debugging support
 */
export interface GoDebugProtocol extends DebugProtocol, GoDebugExtension {}
