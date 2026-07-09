/**
 * Tests for ExtendedDebugProtocol features
 *
 * Tests the supportsFeature, hasFeature, and all extended protocol methods
 * across protocol implementations.
 */

import { describe, it, expect } from "vitest";
import { FeatureNames, hasFeature } from "../extended.js";
import type { ExtendedDebugProtocol } from "../extended.js";

describe("FeatureNames", () => {
  it("should define all expected feature names", () => {
    expect(FeatureNames.Eval).toBe("eval");
    expect(FeatureNames.EnableDisableBreakpoint).toBe("enableDisableBreakpoint");
    expect(FeatureNames.ExtendedBreakpointInfo).toBe("extendedBreakpointInfo");
    expect(FeatureNames.TypeInfo).toBe("typeInfo");
    expect(FeatureNames.SymbolInfo).toBe("symbolInfo");
    expect(FeatureNames.TargetMetadata).toBe("targetMetadata");
    expect(FeatureNames.ThreadBatchInfo).toBe("threadBatchInfo");
    expect(FeatureNames.ExpandVariable).toBe("expandVariable");
  });
});

describe("hasFeature", () => {
  const mockProtocol: ExtendedDebugProtocol = {
    connect: async () => {},
    close: async () => {},
    isConnected: () => true,
    version: async () => ({ protocolVersion: "1.0", runtimeVersion: "1.0", runtimeName: "mock", description: "" }),
    capabilities: async () => ({} as any),
    protocolName: () => "mock",
    supportedLanguages: () => ["mock"],
    threads: async () => [],
    stack: async (_threadId: string) => [],
    threadState: async (_threadId: string) => "running" as const,
    suspend: async () => {},
    resume: async () => {},
    stepInto: async (_threadId: string) => {},
    stepOver: async (_threadId: string) => {},
    stepOut: async (_threadId: string) => {},
    setBreakpoint: async (_location: string, _type?: string, _condition?: string) => "bp-1",
    removeBreakpoint: async (_id: string) => {},
    clearBreakpoints: async () => {},
    breakpoints: async () => [],
    locals: async (_threadId: string, _frameIndex: number) => [],
    fields: async (_objectId: string) => [],
    setField: async (_objectId: string, _name: string, _value: unknown) => {},
    waitForEvent: async () => null,
    eval: async (_expression: string, _options?: any) => ({ value: "", type: "string" }),
    enableBreakpoint: async (_id: string) => {},
    disableBreakpoint: async (_id: string) => {},
    getBreakpointInfo: async (_id: string) => ({ id: "bp-1", location: "", enabled: true, hitCount: 0, ignoreCount: 0, condition: null }),
    getTypeInfo: async (_typeName: string) => ({ name: "", byteSize: 0, isPointer: false, isArray: false, isStruct: false, isClass: false, isUnion: false, isEnumeration: false, numTemplateArgs: 0, templateArgs: [], fields: [], baseClasses: [], enumValues: [] }),
    getSymbol: async (_threadId: string, _frameIndex: number) => ({ name: "", type: "code", address: 0, size: 0, module: "" }),
    getTargetMetadata: async () => ({ executable: "", triple: "", numModules: 0, numSections: 0, numSymbols: 0 }),
    getThreadBatchInfo: async (_threadId: string) => ({ threadId: "", functions: [], files: [], lines: [], addresses: [], modules: [] }),
    expandVariable: async (_objectId: string, _depth?: number) => [],
  };

  it("should return true when protocol has a direct method", () => {
    expect(hasFeature(mockProtocol, "eval")).toBe(true);
  });

  it("should return false when protocol lacks a method", () => {
    const noEval = { ...mockProtocol, eval: undefined as any };
    expect(hasFeature(noEval, "eval")).toBe(false);
  });

  it("should prefer supportsFeature when available", () => {
    const withSupports = {
      ...mockProtocol,
      supportsFeature: (f: string) => f === "eval",
    };
    expect(hasFeature(withSupports, "eval")).toBe(true);
    expect(hasFeature(withSupports, "typeInfo")).toBe(false);
  });

  it("should return false for undefined methods", () => {
    const noExpand = { ...mockProtocol, expandVariable: undefined as any };
    expect(hasFeature(noExpand, "expandVariable")).toBe(false);
  });
});

describe("hasFeature with expandVariable", () => {
  const mockProtocol: ExtendedDebugProtocol = {
    connect: async () => {},
    close: async () => {},
    isConnected: () => true,
    version: async () => ({ protocolVersion: "1.0", runtimeVersion: "1.0", runtimeName: "mock", description: "" }),
    capabilities: async () => ({} as any),
    protocolName: () => "mock",
    supportedLanguages: () => ["mock"],
    threads: async () => [],
    stack: async (_threadId: string) => [],
    threadState: async (_threadId: string) => "running" as const,
    suspend: async () => {},
    resume: async () => {},
    stepInto: async (_threadId: string) => {},
    stepOver: async (_threadId: string) => {},
    stepOut: async (_threadId: string) => {},
    setBreakpoint: async (_location: string, _type?: string, _condition?: string) => "bp-1",
    removeBreakpoint: async (_id: string) => {},
    clearBreakpoints: async () => {},
    breakpoints: async () => [],
    locals: async (_threadId: string, _frameIndex: number) => [],
    fields: async (_objectId: string) => [],
    setField: async (_objectId: string, _name: string, _value: unknown) => {},
    waitForEvent: async () => null,
    eval: undefined as any,
    enableBreakpoint: undefined as any,
    disableBreakpoint: undefined as any,
    getBreakpointInfo: undefined as any,
    getTypeInfo: undefined as any,
    getSymbol: undefined as any,
    getTargetMetadata: undefined as any,
    getThreadBatchInfo: undefined as any,
    expandVariable: async (_objectId: string, _depth?: number) => [],
  };

  it("should detect expandVariable method", () => {
    expect(hasFeature(mockProtocol, "expandVariable")).toBe(true);
  });

  it("should reject missing expandVariable", () => {
    const noExpand = { ...mockProtocol, expandVariable: undefined as any };
    expect(hasFeature(noExpand, "expandVariable")).toBe(false);
  });
});