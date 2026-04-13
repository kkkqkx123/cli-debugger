import { describe, it, expect } from "vitest";
import { validateAppConfig, validateGlobalConfig } from "../validator.js";
import { APIError } from "../../protocol/errors.js";

describe("validator", () => {
  describe("validateAppConfig", () => {
    it("should validate a complete valid configuration", () => {
      const config = {
        connection: {
          protocol: "jdwp",
          host: "127.0.0.1",
          port: 5005,
          timeout: 30000,
        },
        output: {
          format: "text" as const,
          color: true,
        },
        monitor: {
          enabled: false,
          interval: 1000,
          timeout: 60000,
        },
        verbose: false,
        plugins: {},
      };

      const result = validateAppConfig(config);
      expect(result).toEqual(config);
    });

    it("should validate configuration with defaults", () => {
      const config = {
        connection: {
          protocol: "jdwp",
          host: "127.0.0.1",
          port: 5005,
          timeout: 30000,
        },
        output: {
          format: "text",
          color: true,
        },
        monitor: {
          enabled: false,
          interval: 1000,
          timeout: 60000,
        },
      };

      const result = validateAppConfig(config);
      expect(result.connection.protocol).toBe("jdwp");
      expect(result.output.format).toBe("text");
    });

    it("should throw APIError for invalid configuration", () => {
      const invalidConfig = {
        connection: {
          protocol: "",
          host: "127.0.0.1",
          port: -1,
        },
      };

      expect(() => validateAppConfig(invalidConfig)).toThrow(APIError);
    });

    it("should include validation details in error message", () => {
      const invalidConfig = {};

      try {
        validateAppConfig(invalidConfig);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        const apiError = error as APIError;
        expect(apiError.message).toContain("Configuration validation failed");
      }
    });
  });

  describe("validateGlobalConfig", () => {
    it("should validate a complete valid global configuration", () => {
      const config = {
        defaults: {
          connection: {
            protocol: "jdwp",
            host: "127.0.0.1",
            port: 5005,
            timeout: 30000,
          },
          output: {
            format: "text" as const,
            color: true,
          },
          monitor: {
            enabled: false,
            interval: 1000,
            timeout: 60000,
          },
          verbose: false,
          plugins: {},
        },
        profiles: [],
        plugins: {},
      };

      const result = validateGlobalConfig(config);
      expect(result).toEqual(config);
    });

    it("should validate global config with profiles", () => {
      const config = {
        defaults: {
          connection: {
            protocol: "jdwp",
            host: "127.0.0.1",
            port: 5005,
            timeout: 30000,
          },
          output: {
            format: "text",
            color: true,
          },
          monitor: {
            enabled: false,
            interval: 1000,
            timeout: 60000,
          },
        },
        profiles: [
          {
            name: "dev",
            config: {
              connection: {
                protocol: "jdwp",
                host: "localhost",
                port: 5005,
                timeout: 30000,
              },
              output: {
                format: "text",
                color: true,
              },
              monitor: {
                enabled: false,
                interval: 1000,
                timeout: 60000,
              },
            },
          },
        ],
      };

      const result = validateGlobalConfig(config);
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].name).toBe("dev");
    });

    it("should throw APIError for invalid global configuration", () => {
      const invalidConfig = {
        defaults: {},
      };

      expect(() => validateGlobalConfig(invalidConfig)).toThrow(APIError);
    });
  });
});
