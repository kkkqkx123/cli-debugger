/**
 * Session Manager
 *
 * Manages debug protocol sessions, tracks active sessions,
 * and provides a unified interface for CLI commands.
 */

import { createClient } from "../protocol/client.js";
import type { DebugProtocol } from "../protocol/base.js";
import type { ExtendedDebugProtocol } from "../protocol/extended.js";
import type { DebugConfig } from "../types/config.js";
import type { ThreadInfo, StackFrame, BreakpointInfo, Variable } from "../types/debug.js";

/** Information about a debug session (for listing) */
export interface SessionInfo {
  id: string;
  protocol: string;
  target: string;
  status: "running" | "stopped";
  activeThreadId?: string;
  createdAt: Date;
}

/** Internal session state */
interface Session {
  client: DebugProtocol;
  config: DebugConfig;
  activeThreadId?: string;
  activeFrameIndex: number;
  createdAt: Date;
}

/** Auto-context result returned after each mutation command */
export interface AutoContext {
  thread?: ThreadInfo;
  location?: { file: string; line: number; method: string };
  sourceContext?: string[];
  locals?: Variable[];
  stack?: StackFrame[];
  output?: string[];
  threads?: ThreadInfo[];
  breakpoints?: BreakpointInfo[];
}

/** Output mode for the CLI */
export type OutputMode = "text" | "json";

/**
 * SessionManager
 *
 * Manages debug protocol instances, providing session lifecycle
 * management and a unified interface for CLI command handlers.
 */
export class SessionManager {
  private sessions = new Map<string, Session>();
  private currentSessionId: string | undefined;

  /**
   * Create a new debug session
   * @param config - Debug configuration
   * @returns Session ID
   */
  async createSession(config: DebugConfig): Promise<string> {
    const client = await createClient(config);
    const id = `session_${Date.now()}`;
    this.sessions.set(id, {
      client,
      config,
      activeFrameIndex: 0,
      createdAt: new Date(),
    });
    this.currentSessionId = id;
    return id;
  }

  /**
   * Close a debug session
   * @param id - Session ID (defaults to current session)
   */
  async closeSession(id?: string): Promise<void> {
    const sessionId = id ?? this.currentSessionId;
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.client.close();
      } catch {
        // Ignore close errors
      }
      this.sessions.delete(sessionId);
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = this.sessions.keys().next().value ?? undefined;
      }
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.closeSession(id)));
  }

  /**
   * Get a session by ID
   * @param id - Session ID (defaults to current session)
   */
  getSession(id?: string): Session | undefined {
    return this.sessions.get(id ?? this.currentSessionId ?? "");
  }

  /**
   * Get the current session
   */
  getCurrentSession(): Session | undefined {
    return this.currentSessionId
      ? this.sessions.get(this.currentSessionId)
      : undefined;
  }

  /**
   * Get the debug protocol client for a session
   * @param id - Session ID (defaults to current session)
   */
  getClient(id?: string): DebugProtocol | undefined {
    return this.getSession(id)?.client;
  }

  /**
   * Get the current protocol client
   */
  getCurrentClient(): DebugProtocol | undefined {
    return this.getCurrentSession()?.client;
  }

  /**
   * Check if the extended protocol interface is available
   */
  getExtendedClient(id?: string): ExtendedDebugProtocol | undefined {
    return this.getClient(id) as ExtendedDebugProtocol | undefined;
  }

  /**
   * List all sessions
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.entries()).map(([id, s]) => ({
      id,
      protocol: s.config.protocol,
      target: `${s.config.host}:${s.config.port}`,
      status: s.client.isConnected() ? "running" : "stopped",
      activeThreadId: s.activeThreadId,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Set the current active session
   * @param id - Session ID
   * @returns true if the session exists
   */
  setCurrentSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.currentSessionId = id;
      return true;
    }
    return false;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * Set the active thread for the current session
   * @param threadId - Thread ID
   */
  setActiveThread(threadId: string): void {
    const session = this.getCurrentSession();
    if (session) {
      session.activeThreadId = threadId;
    }
  }

  /**
   * Get the active thread ID for the current session
   */
  getActiveThread(): string | undefined {
    return this.getCurrentSession()?.activeThreadId;
  }

  /**
   * Set the active frame index for the current session
   * @param frameIndex - Frame index
   */
  setActiveFrameIndex(frameIndex: number): void {
    const session = this.getCurrentSession();
    if (session) {
      session.activeFrameIndex = frameIndex;
    }
  }

  /**
   * Get the active frame index for the current session
   */
  getActiveFrameIndex(): number {
    return this.getCurrentSession()?.activeFrameIndex ?? 0;
  }

  /**
   * Get the number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if there is an active session
   */
  hasActiveSession(): boolean {
    return this.currentSessionId !== undefined && this.sessions.has(this.currentSessionId);
  }

  /**
   * Get current session info
   */
  getCurrentSessionInfo(): SessionInfo | undefined {
    return this.listSessions().find((s) => s.id === this.currentSessionId);
  }
}