/**
 * Unit tests for Delve type definitions and helper functions
 */

import { describe, it, expect } from "vitest";
import {
  VariableKind,
  isPrimitiveKind,
  isCompositeKind,
  getDefaultLoadConfig,
} from "../types.js";

describe("VariableKind", () => {
  it("should have correct enum values", () => {
    expect(VariableKind.Invalid).toBe(0);
    expect(VariableKind.Bool).toBe(1);
    expect(VariableKind.Int).toBe(2);
    expect(VariableKind.Float).toBe(3);
    expect(VariableKind.String).toBe(4);
    expect(VariableKind.Array).toBe(5);
    expect(VariableKind.Slice).toBe(6);
    expect(VariableKind.Struct).toBe(7);
    expect(VariableKind.Pointer).toBe(8);
    expect(VariableKind.Interface).toBe(9);
    expect(VariableKind.Map).toBe(10);
    expect(VariableKind.Complex).toBe(11);
    expect(VariableKind.Chan).toBe(12);
    expect(VariableKind.Func).toBe(13);
    expect(VariableKind.UnsafePointer).toBe(14);
  });
});

describe("isPrimitiveKind", () => {
  it("should return true for primitive types", () => {
    expect(isPrimitiveKind(VariableKind.Bool)).toBe(true);
    expect(isPrimitiveKind(VariableKind.Int)).toBe(true);
    expect(isPrimitiveKind(VariableKind.Float)).toBe(true);
    expect(isPrimitiveKind(VariableKind.String)).toBe(true);
    expect(isPrimitiveKind(VariableKind.Complex)).toBe(true);
  });

  it("should return false for composite types", () => {
    expect(isPrimitiveKind(VariableKind.Array)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Slice)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Struct)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Map)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Interface)).toBe(false);
  });

  it("should return false for other types", () => {
    expect(isPrimitiveKind(VariableKind.Invalid)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Pointer)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Chan)).toBe(false);
    expect(isPrimitiveKind(VariableKind.Func)).toBe(false);
    expect(isPrimitiveKind(VariableKind.UnsafePointer)).toBe(false);
  });
});

describe("isCompositeKind", () => {
  it("should return true for composite types", () => {
    expect(isCompositeKind(VariableKind.Array)).toBe(true);
    expect(isCompositeKind(VariableKind.Slice)).toBe(true);
    expect(isCompositeKind(VariableKind.Struct)).toBe(true);
    expect(isCompositeKind(VariableKind.Map)).toBe(true);
    expect(isCompositeKind(VariableKind.Interface)).toBe(true);
  });

  it("should return false for primitive types", () => {
    expect(isCompositeKind(VariableKind.Bool)).toBe(false);
    expect(isCompositeKind(VariableKind.Int)).toBe(false);
    expect(isCompositeKind(VariableKind.Float)).toBe(false);
    expect(isCompositeKind(VariableKind.String)).toBe(false);
    expect(isCompositeKind(VariableKind.Complex)).toBe(false);
  });

  it("should return false for other types", () => {
    expect(isCompositeKind(VariableKind.Invalid)).toBe(false);
    expect(isCompositeKind(VariableKind.Pointer)).toBe(false);
    expect(isCompositeKind(VariableKind.Chan)).toBe(false);
    expect(isCompositeKind(VariableKind.Func)).toBe(false);
    expect(isCompositeKind(VariableKind.UnsafePointer)).toBe(false);
  });
});

describe("getDefaultLoadConfig", () => {
  it("should return default load configuration", () => {
    const config = getDefaultLoadConfig();

    expect(config).toEqual({
      followPointers: true,
      maxVariableRecurse: 1,
      maxStringLen: 64,
      maxArrayValues: 64,
      maxStructFields: -1,
    });
  });

  it("should return a new object each time", () => {
    const config1 = getDefaultLoadConfig();
    const config2 = getDefaultLoadConfig();

    expect(config1).not.toBe(config2);
    expect(config1).toEqual(config2);
  });
});
