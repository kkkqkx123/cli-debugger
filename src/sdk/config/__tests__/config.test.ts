/**
 * Tests for SDK Config Module
 */

import { describe, it, expect } from "vitest";
import { ConfigBuilder, Presets, detectProtocol } from "../index.js";

describe("ConfigBuilder", () => {
  it("should build a minimal config", () => {
    const config = new ConfigBuilder().protocol("jdwp").build();
    expect(config.protocol).toBe("jdwp");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(5005);
    expect(config.timeout).toBe(30000);
  });

  it("should allow overriding host", () => {
    const config = new ConfigBuilder()
      .protocol("dlv")
      .host("10.0.0.1")
      .port(2345)
      .build();
    expect(config.protocol).toBe("dlv");
    expect(config.host).toBe("10.0.0.1");
    expect(config.port).toBe(2345);
  });

  it("should allow setting timeout", () => {
    const config = new ConfigBuilder()
      .protocol("jdwp")
      .timeout(60000)
      .build();
    expect(config.timeout).toBe(60000);
  });

  it("should support static create method", () => {
    const builder = ConfigBuilder.create();
    expect(builder).toBeInstanceOf(ConfigBuilder);
  });

  it("should be chainable", () => {
    const builder = new ConfigBuilder();
    const result = builder.protocol("lldb").host("localhost").port(12345);
    expect(result).toBe(builder);
  });
});

describe("Presets", () => {
  it("should provide jdwp preset", () => {
    const config = Presets.jdwp();
    expect(config.protocol).toBe("jdwp");
    expect(config.port).toBe(5005);
    expect(config.host).toBe("127.0.0.1");
  });

  it("should provide jdwp preset with custom port", () => {
    const config = Presets.jdwp(8000);
    expect(config.port).toBe(8000);
  });

  it("should provide dlv preset", () => {
    const config = Presets.dlv();
    expect(config.protocol).toBe("dlv");
    expect(config.port).toBe(2345);
  });

  it("should provide lldb preset", () => {
    const config = Presets.lldb();
    expect(config.protocol).toBe("lldb");
    expect(config.port).toBe(12345);
  });

  it("should provide py-debug preset", () => {
    const config = Presets.pyDebug();
    expect(config.protocol).toBe("py-debug");
    expect(config.port).toBe(5678);
  });

  it("should provide js-debug preset", () => {
    const config = Presets.jsDebug();
    expect(config.protocol).toBe("js-debug");
    expect(config.port).toBe(9229);
  });
});

describe("detectProtocol", () => {
  it("should detect Go files", () => {
    expect(detectProtocol("main.go")).toBe("dlv");
    expect(detectProtocol("/path/to/app.go")).toBe("dlv");
  });

  it("should detect Java files", () => {
    expect(detectProtocol("App.java")).toBe("jdwp");
    expect(detectProtocol("App.class")).toBe("jdwp");
    expect(detectProtocol("app.jar")).toBe("jdwp");
  });

  it("should detect Python files", () => {
    expect(detectProtocol("script.py")).toBe("py-debug");
    expect(detectProtocol("/path/to/module.py")).toBe("py-debug");
  });

  it("should detect JS/TS files", () => {
    expect(detectProtocol("app.js")).toBe("js-debug");
    expect(detectProtocol("app.ts")).toBe("js-debug");
    expect(detectProtocol("app.mjs")).toBe("js-debug");
    expect(detectProtocol("app.cjs")).toBe("js-debug");
    expect(detectProtocol("app.mts")).toBe("js-debug");
    expect(detectProtocol("app.cts")).toBe("js-debug");
  });

  it("should detect native binaries", () => {
    expect(detectProtocol("/path/to/binary")).toBe("lldb");
    expect(detectProtocol("output.out")).toBe("lldb");
    expect(detectProtocol("program.bin")).toBe("lldb");
    expect(detectProtocol("app.exe")).toBe("lldb");
    expect(detectProtocol("module.elf")).toBe("lldb");
  });

  it("should return undefined for unknown extensions", () => {
    expect(detectProtocol("readme.md")).toBeUndefined();
    expect(detectProtocol("data.json")).toBeUndefined();
    expect(detectProtocol("style.css")).toBeUndefined();
  });
});