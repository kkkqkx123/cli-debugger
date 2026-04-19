/**
 * Delve goroutine management API
 */

import type { DlvRpcClient } from "../rpc.js";
import type {
  DlvGoroutine,
  DlvGoroutinesResult,
  DlvListGoroutinesParams,
  DlvGroupBy,
} from "../types.js";

/**
 * List all goroutines
 */
export async function listGoroutines(
  rpc: DlvRpcClient,
  start = 0,
  count = 0,
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { start, count },
  ]);
}

/**
 * List goroutines with filter
 */
export async function listGoroutinesFiltered(
  rpc: DlvRpcClient,
  params: DlvListGoroutinesParams,
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [params]);
}

/**
 * Get all goroutines (handles pagination)
 */
export async function getAllGoroutines(
  rpc: DlvRpcClient,
): Promise<DlvGoroutine[]> {
  const goroutines: DlvGoroutine[] = [];
  let start = 0;
  const batchSize = 100;

  while (true) {
    const result = await listGoroutines(rpc, start, batchSize);
    goroutines.push(...result.Goroutines);

    if (result.Nextg < 0 || result.Goroutines.length < batchSize) {
      break;
    }
    start = result.Nextg;
  }

  return goroutines;
}

/**
 * Get goroutine by ID
 */
export async function getGoroutine(
  rpc: DlvRpcClient,
  goroutineId: number,
): Promise<DlvGoroutine> {
  return rpc.call<DlvGoroutine>("RPCServer.GetGoroutine", [
    { id: goroutineId },
  ]);
}

/**
 * List goroutines grouped by location
 */
export async function listGoroutinesGrouped(
  rpc: DlvRpcClient,
  groupBy: "userloc" | "curloc" | "goloc" | "startloc" | "running" | "user",
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { groupBy },
  ]);
}

/**
 * List goroutines grouped by label
 */
export async function listGoroutinesGroupedByLabel(
  rpc: DlvRpcClient,
  labelKey: string,
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { groupBy: "label", groupByArg: labelKey },
  ]);
}

/**
 * List goroutines with specific label
 */
export async function listGoroutinesWithLabel(
  rpc: DlvRpcClient,
  key: string,
  value?: string,
): Promise<DlvGoroutinesResult> {
  const labels: Record<string, string> = {};
  if (value !== undefined) {
    labels[key] = value;
  }
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { labels },
  ]);
}

/**
 * List goroutines waiting on channel
 */
export async function listGoroutinesOnChannel(
  rpc: DlvRpcClient,
  channelExpr: string,
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { filter: { kind: "chan", arg: channelExpr } },
  ]);
}

/**
 * List running goroutines
 */
export async function listRunningGoroutines(
  rpc: DlvRpcClient,
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { filter: { kind: "running", arg: true } },
  ]);
}

/**
 * List user goroutines (non-runtime)
 */
export async function listUserGoroutines(
  rpc: DlvRpcClient,
): Promise<DlvGoroutinesResult> {
  return rpc.call<DlvGoroutinesResult>("RPCServer.ListGoroutines", [
    { filter: { kind: "user", arg: true } },
  ]);
}

/**
 * Get goroutine count
 */
export async function getGoroutineCount(rpc: DlvRpcClient): Promise<number> {
  const result = await listGoroutines(rpc, 0, 0);
  // If Nextg is -1, we have all goroutines
  // Otherwise, we need to count
  if (result.Nextg < 0) {
    return result.Goroutines.length;
  }

  // Get all to count
  const all = await getAllGoroutines(rpc);
  return all.length;
}

/**
 * Find goroutine by location pattern
 */
export async function findGoroutineByLocation(
  rpc: DlvRpcClient,
  pattern: string,
): Promise<DlvGoroutine | null> {
  const goroutines = await getAllGoroutines(rpc);
  for (const g of goroutines) {
    const loc = g.userCurrentLoc;
    if (
      loc.file.includes(pattern) ||
      (loc.function && loc.function.name.includes(pattern))
    ) {
      return g;
    }
  }
  return null;
}

/**
 * Get goroutine labels
 */
export async function getGoroutineLabels(
  rpc: DlvRpcClient,
  goroutineId: number,
): Promise<Record<string, string>> {
  return rpc.call<Record<string, string>>("RPCServer.GoroutineLabels", [
    { goroutineID: goroutineId },
  ]);
}

/**
 * Helper to convert group result to map
 */
export function groupByToMap(
  result: DlvGoroutinesResult,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  if (result.GroupBy) {
    for (const group of result.GroupBy as unknown as DlvGroupBy[]) {
      map.set(group.Group, group.Goroutines);
    }
  }
  return map;
}

// ==================== Batch Execution ====================

/**
 * Execute command on all goroutines matching filter
 * Returns a map of goroutine ID to command result
 */
export async function execOnAllGoroutines(
  rpc: DlvRpcClient,
  commandFn: (goroutineId: number) => Promise<unknown>,
  params?: DlvListGoroutinesParams,
): Promise<Map<number, unknown>> {
  const result = params
    ? await listGoroutinesFiltered(rpc, params)
    : await listGoroutines(rpc);

  const results = new Map<number, unknown>();

  for (const g of result.Goroutines) {
    try {
      const cmdResult = await commandFn(g.id);
      results.set(g.id, cmdResult);
    } catch (error) {
      results.set(g.id, { error: String(error) });
    }
  }

  return results;
}
