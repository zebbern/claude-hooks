import fs from 'node:fs';
import path from 'node:path';
import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { appendJsonlRecord } from '../../utils/jsonl.js';

interface RateLimitCounters {
  totalCalls: number;
  totalEdits: number;
}

function ensureDir(config: ToolkitConfig): string {
  const dir = path.join(config.logDir, 'rate-limiter');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCounterPath(config: ToolkitConfig, sessionId: string): string {
  return path.join(ensureDir(config), `${sessionId}.count`);
}

function getLogPath(config: ToolkitConfig, sessionId: string): string {
  return path.join(ensureDir(config), `${sessionId}.jsonl`);
}

function readCounters(counterPath: string): RateLimitCounters {
  try {
    if (!fs.existsSync(counterPath)) return { totalCalls: 0, totalEdits: 0 };
    return JSON.parse(fs.readFileSync(counterPath, 'utf-8')) as RateLimitCounters;
  } catch {
    return { totalCalls: 0, totalEdits: 0 };
  }
}

function writeCounters(counterPath: string, counters: RateLimitCounters): void {
  fs.writeFileSync(counterPath, JSON.stringify(counters), 'utf-8');
}

/**
 * Checks whether the session has exceeded its rate limits.
 *
 * Uses a counter file for O(1) limit checks and a JSONL audit log for
 * detailed records. Checks limits BEFORE recording to avoid the off-by-one
 * of allowing a call that should have been blocked.
 *
 * @param input - The `PreToolUse` hook input.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'block'` if a limit is exceeded, else `'proceed'`.
 */
export function checkRateLimit(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (!config.rateLimiter.enabled) {
    return { action: 'proceed' };
  }

  const { maxToolCallsPerSession, maxFileEditsPerSession } = config.rateLimiter;

  // If both thresholds are 0 (unlimited), proceed
  if (maxToolCallsPerSession === 0 && maxFileEditsPerSession === 0) {
    return { action: 'proceed' };
  }

  try {
    const counterPath = getCounterPath(config, input.session_id);
    const isEdit = WRITE_TOOLS.has(input.tool_name);

    // Read current counts BEFORE recording
    const counters = readCounters(counterPath);

    // Check limits BEFORE recording
    if (maxToolCallsPerSession > 0 && counters.totalCalls >= maxToolCallsPerSession) {
      return {
        action: 'block',
        message: `Rate limit exceeded: ${counters.totalCalls + 1} tool calls (max ${maxToolCallsPerSession} per session)`,
        details: { totalCalls: counters.totalCalls + 1, maxToolCallsPerSession },
      };
    }

    if (isEdit && maxFileEditsPerSession > 0 && counters.totalEdits >= maxFileEditsPerSession) {
      return {
        action: 'block',
        message: `Rate limit exceeded: ${counters.totalEdits + 1} file edits (max ${maxFileEditsPerSession} per session)`,
        details: { totalEdits: counters.totalEdits + 1, maxFileEditsPerSession },
      };
    }

    // Record AFTER confirming within limits
    counters.totalCalls++;
    if (isEdit) counters.totalEdits++;
    writeCounters(counterPath, counters);

    // Append JSONL audit trail (best-effort, not used for limit checks)
    const logPath = getLogPath(config, input.session_id);
    appendJsonlRecord(logPath, {
      timestamp: new Date().toISOString(),
      tool_name: input.tool_name,
      is_edit: isEdit,
    });
  } catch {
    // Best-effort — proceed if file I/O fails
  }

  return { action: 'proceed' };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkRateLimit(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'Rate limit exceeded');
  };
}
