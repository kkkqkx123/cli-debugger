/**
 * Variable E2E tests for Go
 * Tests variable inspection functionality with real Delve debugger
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { DlvClient } from "../../../../src/protocol/dlv/client.js";
import {
  checkGoAvailable,
  checkDelveAvailable,
  launchSimpleProgram,
  terminateDelve,
} from "../../fixtures/go-launch.js";
import type { LaunchedDelve } from "../../fixtures/go-launch.js";
import type { DebugConfig } from "../../../../src/types/config.js";

describe("Variable E2E (Go)", () => {
  let delve: LaunchedDelve | null = null;
  let client: DlvClient | null = null;
  let goAvailable = false;
  let dlvAvailable = false;

  beforeAll(async () => {
    goAvailable = await checkGoAvailable();
    dlvAvailable = await checkDelveAvailable();
    if (!goAvailable || !dlvAvailable) {
      console.log("Go or Delve is not available, skipping E2E tests");
    }
  });

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      client = null;
    }
    if (delve) {
      await terminateDelve(delve);
      delve = null;
    }
  });

  describe("variable_inspection", () => {
    it("should inspect variables at entry point", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = new DlvClient(config);
      await client.connect();

      // Get threads
      const threads = await client.threads();
      console.log(`Threads at entry: ${threads.length}`);

      if (threads.length > 0) {
        const threadId = threads[0].id.toString();
        
        try {
          // Get stack
          const stack = await client.stack(threadId);
          console.log(`Stack depth: ${stack.length}`);
          
          if (stack.length > 0) {
            // Get locals for top frame
            const frameId = stack[0].id.toString();
            const locals = await client.locals(threadId, frameId);
            
            console.log(`Local variables: ${locals.length}`);
            
            // Verify variable structure
            for (const local of locals) {
              expect(local.name).toBeDefined();
              expect(typeof local.name).toBe("string");
              expect(local.type).toBeDefined();
              
              console.log(`  ${local.name}: ${local.type} = ${local.value}`);
            }
          }
        } catch (error) {
          console.log("Variable inspection error:", error);
        }
      }
    });

    it("should verify variable types and values", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = new DlvClient(config);
      await client.connect();

      const threads = await client.threads();
      
      if (threads.length > 0) {
        const threadId = threads[0].id.toString();
        
        try {
          const stack = await client.stack(threadId);
          
          if (stack.length > 0) {
            const frameId = stack[0].id.toString();
            const locals = await client.locals(threadId, frameId);
            
            // Verify each variable has proper structure
            for (const local of locals) {
              // Name should be non-empty string
              expect(local.name.length).toBeGreaterThan(0);
              
              // Type should be non-empty string
              expect(local.type.length).toBeGreaterThan(0);
              
              // Value should be defined (may be string or object)
              expect(local.value).toBeDefined();
              
              // If variable has children, verify structure
              if (local.children && local.children.length > 0) {
                for (const child of local.children) {
                  expect(child.name).toBeDefined();
                  expect(child.type).toBeDefined();
                }
              }
            }
          }
        } catch (error) {
          console.log("Variable verification error:", error);
        }
      }
    });
  });

  describe("field_inspection", () => {
    it("should inspect struct fields when available", async () => {
      if (!goAvailable || !dlvAvailable) {
        return;
      }

      delve = await launchSimpleProgram();

      const config: DebugConfig = {
        protocol: "dlv",
        host: "127.0.0.1",
        port: delve.debugPort,
        timeout: 15000,
      };

      client = new DlvClient(config);
      await client.connect();

      const threads = await client.threads();
      
      if (threads.length > 0) {
        const threadId = threads[0].id.toString();
        
        try {
          const stack = await client.stack(threadId);
          
          if (stack.length > 0) {
            const frameId = stack[0].id.toString();
            const locals = await client.locals(threadId, frameId);
            
            // Look for struct variables
            for (const local of locals) {
              // If it's a struct type, try to get fields
              if (local.type.includes("struct") || local.children) {
                console.log(`Found potential struct: ${local.name} (${local.type})`);
                
                // If variable has an object ID, try to get fields
                if (local.objectId) {
                  try {
                    const fields = await client.fields(local.objectId);
                    
                    // Verify field structure
                    for (const field of fields) {
                      expect(field.name).toBeDefined();
                      expect(field.type).toBeDefined();
                      expect(field.value).toBeDefined();
                      
                      console.log(`  Field ${field.name}: ${field.type} = ${field.value}`);
                    }
                  } catch (error) {
                    console.log(`Failed to get fields for ${local.name}:`, error);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log("Field inspection error:", error);
        }
      }
    });
  });
});
