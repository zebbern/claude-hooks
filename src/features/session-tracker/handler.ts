import fs from 'node:fs';
import path from 'node:path';
import type { SessionStartInput, SessionEndInput, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';

interface SessionEntry {
  timestamp: string;
  session_id: string;
  event: 'start' | 'end';
  source?: string;
}

/**
 * Logs a session-start event to `{logDir}/sessions.jsonl`.
 *
 * Creates the log directory if it does not exist. Errors are silently swallowed
 * so session tracking never crashes the hook.
 *
 * @param input - The `SessionStart` hook input containing `session_id` and `source`.
 * @param config - The resolved toolkit configuration (uses `logDir`).
 */
export function trackSessionStart(input: SessionStartInput, config: ToolkitConfig): void {
  try {
    fs.mkdirSync(config.logDir, { recursive: true });

    const entry: SessionEntry = {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event: 'start',
      source: input.source,
    };

    const filePath = path.join(config.logDir, 'sessions.jsonl');
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Session tracking should never crash the hook
  }
}

/**
 * Logs a session-end event to `{logDir}/sessions.jsonl`.
 *
 * Creates the log directory if it does not exist. Errors are silently swallowed
 * so session tracking never crashes the hook.
 *
 * @param input - The `SessionEnd` hook input containing `session_id`.
 * @param config - The resolved toolkit configuration (uses `logDir`).
 */
export function trackSessionEnd(input: SessionEndInput, config: ToolkitConfig): void {
  try {
    fs.mkdirSync(config.logDir, { recursive: true });

    const entry: SessionEntry = {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event: 'end',
    };

    const filePath = path.join(config.logDir, 'sessions.jsonl');
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Session tracking should never crash the hook
  }
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  if (hookType === 'SessionStart') {
    return async (input, config) => {
      trackSessionStart(input as SessionStartInput, config);
      return undefined;
    };
  }

  // SessionEnd and Stop both track session end
  return async (input, config) => {
    trackSessionEnd({ session_id: input.session_id }, config);
    return undefined;
  };
}
