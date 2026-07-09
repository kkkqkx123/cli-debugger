/**
 * Extended DebugProtocol interface for advanced features
 * 
 * This file extends the base DebugProtocol interface with optional advanced features.
 * Not all protocols support all features, and implementations should throw appropriate
 * errors when unsupported features are called.
 */

import type { DebugProtocol } from "./base.js";

/**
 * Expression evaluation options
 */
export interface EvalOptions {
  timeout?: number;
  unwindOnError?: boolean;
  ignoreBreakpoints?: boolean;
}

/**
 * Expression evaluation result
 */
export interface EvalResult {
  value: unknown;
  type: string;
  error?: string;
}

/**
 * Extended breakpoint info
 */
export interface ExtendedBreakpointInfo {
  id: string;
  location: string;
  enabled: boolean;
  hitCount: number;
  ignoreCount: number;
  condition: string | null;
}

/**
 * Type information
 */
export interface TypeInfo {
  name: string;
  byteSize: number;
  isPointer: boolean;
  isArray: boolean;
  isStruct: boolean;
  isClass: boolean;
  isUnion: boolean;
  isEnumeration: boolean;
  numTemplateArgs: number;
  templateArgs: string[];
  fields: FieldInfo[];
  baseClasses: string[];
  enumValues: EnumValue[];
}

/**
 * Field information
 */
export interface FieldInfo {
  name: string;
  typeName: string;
  offset: number;
  byteSize: number;
  isStatic: boolean;
}

/**
 * Enum value
 */
export interface EnumValue {
  name: string;
  value: bigint;
}

/**
 * Symbol information
 */
export interface SymbolInfo {
  name: string;
  type: "code" | "data" | "debug" | "other";
  address: number;
  size: number;
  module: string | null;
}

/**
 * Target metadata
 */
export interface TargetMetadata {
  executable: string;
  triple: string;
  numModules: number;
  numSections: number;
  numSymbols: number;
}

/**
 * Thread batch information (optimized)
 */
export interface ThreadBatchInfo {
  threadId: string;
  functions: string[];
  files: string[];
  lines: number[];
  addresses: bigint[];
  modules: string[];
}

/**
 * Expanded variable with recursive children (for expandVariable)
 */
export interface ExpandedVariable {
  name: string;
  type: string;
  value: unknown;
  isPrimitive: boolean;
  isNull: boolean;
  objectId?: string; // Only set for non-primitive fields that can be further expanded
  children?: ExpandedVariable[];
}

/**
 * Extended DebugProtocol interface
 * 
 * This interface extends the base DebugProtocol with optional advanced features.
 * All methods in this interface are optional; implementations should throw
 * APIError with UnsupportedOperation when a feature is not supported.
 */
export interface ExtendedDebugProtocol extends DebugProtocol {
  /**
   * Expression evaluation (optional)
   * @param expression - Expression to evaluate
   * @param threadId - Thread ID for evaluation
   * @param frameIndex - Stack frame index
   * @param options - Evaluation options
   * @returns Expression evaluation result
   */
  eval?(expression: string, threadId: string, frameIndex: number, options?: EvalOptions): Promise<EvalResult>;

  /**
   * Enable breakpoint (optional)
   * @param id - Breakpoint ID
   */
  enableBreakpoint?(id: string): Promise<void>;

  /**
   * Disable breakpoint (optional)
   * @param id - Breakpoint ID
   */
  disableBreakpoint?(id: string): Promise<void>;

  /**
   * Get extended breakpoint info (optional)
   * @param id - Breakpoint ID
   * @returns Extended breakpoint information
   */
  getBreakpointInfo?(id: string): Promise<ExtendedBreakpointInfo>;

  /**
   * Get type information (optional)
   * @param typeName - Type name
   * @param includeFields - Include field information
   * @param includeTemplateArgs - Include template arguments
   * @returns Type information
   */
  getTypeInfo?(typeName: string, includeFields?: boolean, includeTemplateArgs?: boolean): Promise<TypeInfo>;

  /**
   * Get symbol information (optional)
   * @param threadId - Thread ID (for context)
   * @param frameIndex - Stack frame index (for context)
   * @param symbolName - Symbol name to search (optional)
   * @param fuzzyMatch - Enable fuzzy matching (optional)
   * @returns Symbol information
   */
  getSymbol?(threadId: string, frameIndex: number, symbolName?: string, fuzzyMatch?: boolean): Promise<SymbolInfo>;

  /**
   * Get target metadata (optional)
   * @returns Target metadata
   */
  getTargetMetadata?(): Promise<TargetMetadata>;

  /**
   * Get thread batch information (optional, optimized)
   * @param threadId - Thread ID
   * @returns Batch thread information
   */
  getThreadBatchInfo?(threadId: string): Promise<ThreadBatchInfo>;

  /**
   * Recursively expand variable fields (optional)
   * @param objectId - Object ID to expand (format depends on protocol)
   * @param depth - Maximum expansion depth (default: 1, meaning only direct fields)
   * @returns Expanded variable tree
   */
  expandVariable?(objectId: string, depth?: number): Promise<ExpandedVariable[]>;

  /**
   * Check if a feature is supported (optional)
   * @param feature - Feature name
   * @returns True if feature is supported
   */
  supportsFeature?(feature: string): boolean;
}

/**
 * Feature names for capability checking
 */
export const FeatureNames = {
  Eval: "eval",
  EnableDisableBreakpoint: "enableDisableBreakpoint",
  ExtendedBreakpointInfo: "extendedBreakpointInfo",
  TypeInfo: "typeInfo",
  SymbolInfo: "symbolInfo",
  TargetMetadata: "targetMetadata",
  ThreadBatchInfo: "threadBatchInfo",
  ExpandVariable: "expandVariable",
} as const;

export type FeatureName = typeof FeatureNames[keyof typeof FeatureNames];

/**
 * Helper function to check if a protocol supports a feature
 */
export function hasFeature(protocol: ExtendedDebugProtocol, feature: FeatureName): boolean {
  if (typeof protocol.supportsFeature === "function") {
    return protocol.supportsFeature(feature);
  }

  switch (feature) {
    case FeatureNames.Eval:
      return typeof protocol.eval === "function";
    case FeatureNames.EnableDisableBreakpoint:
      return typeof protocol.enableBreakpoint === "function" ||
             typeof protocol.disableBreakpoint === "function";
    case FeatureNames.ExtendedBreakpointInfo:
      return typeof protocol.getBreakpointInfo === "function";
    case FeatureNames.TypeInfo:
      return typeof protocol.getTypeInfo === "function";
    case FeatureNames.SymbolInfo:
      return typeof protocol.getSymbol === "function";
    case FeatureNames.TargetMetadata:
      return typeof protocol.getTargetMetadata === "function";
    case FeatureNames.ThreadBatchInfo:
      return typeof protocol.getThreadBatchInfo === "function";
    case FeatureNames.ExpandVariable:
      return typeof protocol.expandVariable === "function";
    default:
      return false;
  }
}