import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { ConfigLoader } from "../loader.js";
import type { PathLike } from "node:fs";

vi.mock("node:fs/promises");
vi.mock("../../paths.js", () => ({
  getConfigPath: () => "/mock/config/path",
}));

describe("loader", () => {
  let loader: ConfigLoader;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    loader = new ConfigLoader();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("load", () => {
    it("should load with default configuration", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const result = await loader.load();

      expect(result.connection.protocol).toBe("jdwp");
      expect(result.connection.host).toBe("127.0.0.1");
      expect(result.connection.port).toBe(5005);
      expect(result.output.format).toBe("text");
      expect(result.monitor.enabled).toBe(false);
    });

    it("should merge CLI options", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const result = await loader.load({
        cliOptions: {
          connection: {
            protocol: "jdwp",
            host: "192.168.1.100",
            port: 8000,
            timeout: 30000,
          },
        },
      });

      expect(result.connection.host).toBe("192.168.1.100");
      expect(result.connection.port).toBe(8000);
      expect(result.connection.protocol).toBe("jdwp");
    });
  });

  describe("loadFromEnv", () => {
    it("should load protocol from environment variable", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_PROTOCOL"] = "dap";

      const result = await loader.load();

      expect(result.connection.protocol).toBe("dap");
    });

    it("should load host from environment variable", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_HOST"] = "10.0.0.1";

      const result = await loader.load();

      expect(result.connection.host).toBe("10.0.0.1");
    });

    it("should load port from environment variable", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_PORT"] = "8080";

      const result = await loader.load();

      expect(result.connection.port).toBe(8080);
    });

    it("should load output format from environment variable", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_OUTPUT"] = "json";

      const result = await loader.load();

      expect(result.output.format).toBe("json");
    });

    it("should load verbose from environment variable", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_VERBOSE"] = "true";

      const result = await loader.load();

      expect(result.verbose).toBe(true);
    });
  });

  describe("loadGlobalConfig", () => {
    it("should load global config from TOML file", async () => {
      const tomlContent = `
[defaults.connection]
protocol = "jdwp"
host = "global.example.com"
port = 6000
timeout = 50000

[defaults.output]
format = "json"
color = false

[defaults.monitor]
enabled = true
interval = 2000
timeout = 120000
`;
      vi.mocked(fs.readFile).mockImplementation(
        async (filePath: PathLike | fs.FileHandle) => {
          const filePathStr = filePath.toString();
          if (filePathStr.includes("config.toml")) {
            return tomlContent;
          }
          throw new Error("File not found");
        },
      );

      const result = await loader.load();

      expect(result.connection.host).toBe("global.example.com");
      expect(result.connection.port).toBe(6000);
      expect(result.output.format).toBe("json");
      expect(result.monitor.enabled).toBe(true);
    });

    it("should ignore missing global config", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const result = await loader.load();

      expect(result).toBeDefined();
      expect(result.connection.protocol).toBe("jdwp");
    });
  });

  describe("loadProjectConfig", () => {
    it("should load project config from TOML file", async () => {
      const tomlContent = `
[connection]
protocol = "dap"
host = "project.example.com"
port = 7000

[output]
format = "table"
color = true
`;
      vi.mocked(fs.readFile).mockImplementation(
        async (filePath: PathLike | fs.FileHandle) => {
          const filePathStr = filePath.toString();
          if (filePathStr.endsWith(".debugger.toml")) {
            return tomlContent;
          }
          throw new Error("File not found");
        },
      );

      const result = await loader.load();

      expect(result.connection.protocol).toBe("dap");
      expect(result.connection.host).toBe("project.example.com");
      expect(result.connection.port).toBe(7000);
      expect(result.output.format).toBe("table");
    });

    it("should ignore missing project config", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const result = await loader.load();

      expect(result).toBeDefined();
    });
  });

  describe("config priority", () => {
    it("should prioritize CLI options over environment variables", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_HOST"] = "env.example.com";

      const result = await loader.load({
        cliOptions: {
          connection: {
            protocol: "jdwp",
            host: "cli.example.com",
            port: 5005,
            timeout: 30000,
          },
        },
      });

      expect(result.connection.host).toBe("cli.example.com");
    });

    it("should prioritize environment variables over defaults", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      process.env["DEBUGGER_PROTOCOL"] = "custom-protocol";

      const result = await loader.load();

      expect(result.connection.protocol).toBe("custom-protocol");
    });
  });
});
