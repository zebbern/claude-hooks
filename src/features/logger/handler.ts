import fs from 'node:fs';
import path from 'node:path';
import type { HookEventType, LogEntry, ToolkitConfig, HookHandler, HookInputBase } from '../../types.js';
import { redactSensitiveFields } from '../../utils/redact.js';

/**
 * Appends a JSONL log entry for a hook event.
 *
 * Writes to `{logDir}/{hookType}/{YYYY-MM-DD}.jsonl`. Creates directories as needed
 * with mode `0o700` (owner-only on Linux/macOS; partially supported on Windows).
 *
 * Sensitive fields in `tool_input` (e.g. `content`, `new_string`) are truncated
 * to 200 characters before logging to avoid storing file contents in logs.
 *
 * Errors are silently swallowed so logging never crashes a hook.
 *
 * @param hookType - The hook event type (e.g., `'PreToolUse'`).
 * @param data - Arbitrary event data to log. The `session_id` field is extracted if present.
 * @param config - The resolved toolkit configuration (uses `logDir`).
 */
export function logHookEvent(
  hookType: HookEventType,
  data: Record<string, unknown>,
  config: ToolkitConfig,
): void {
  try {
    const dir = path.join(config.logDir, hookType);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filePath = path.join(dir, `${dateStr}.jsonl`);

    const redactedData = redactSensitiveFields(data);

    const entry: LogEntry = {
      timestamp: now.toISOString(),
      sessionId: typeof data.session_id === 'string' ? data.session_id : 'unknown',
      hookType,
      data: redactedData,
    };

    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Logging should never crash the hook
  }
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    logHookEvent(hookType, input as unknown as Record<string, unknown>, config);
    return undefined;
  };
}
