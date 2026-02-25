import fs from 'node:fs';
import path from 'node:path';
import type {
  HookEventType,
  HookHandler,
  HookHandlerResult,
  HookInputBase,
  PostToolUseFailureInput,
  ToolkitConfig,
} from '../../types.js';
import { readJsonlRecords, appendJsonlRecord } from '../../utils/jsonl.js';

interface ErrorRecord {
  timestamp: string;
  tool_name: string;
  error_message: string;
  count: number;
}

interface DetectResult {
  repeated: boolean;
  count: number;
  message?: string;
}

function getErrorDir(config: ToolkitConfig): string {
  return path.join(config.logDir, 'error-patterns');
}

function getJsonlPath(sessionId: string, config: ToolkitConfig): string {
  return path.join(getErrorDir(config), `${sessionId}.jsonl`);
}

function truncateMessage(message: string, length: number): string {
  return message.slice(0, length);
}

/**
 * Detects repeated error patterns for a tool within a session.
 *
 * Records each error to a JSONL file and checks if the same error pattern
 * (matched by the first 100 chars) has occurred `maxRepeats` or more times.
 *
 * @param input - The PostToolUseFailure hook input.
 * @param config - The resolved toolkit configuration.
 * @returns Detection result with repeat count and advisory message.
 */
export function detectErrorPattern(
  input: PostToolUseFailureInput,
  config: ToolkitConfig,
): DetectResult {
  if (!config.errorPatternDetector.enabled) {
    return { repeated: false, count: 0 };
  }

  const errorDir = getErrorDir(config);
  fs.mkdirSync(errorDir, { recursive: true });

  const jsonlPath = getJsonlPath(input.session_id, config);
  const errorMessage = truncateMessage(input.error ?? '', 200);
  const matchKey = truncateMessage(errorMessage, 100);

  // Append the error record
  const record: ErrorRecord = {
    timestamp: new Date().toISOString(),
    tool_name: input.tool_name,
    error_message: errorMessage,
    count: 1,
  };

  appendJsonlRecord(jsonlPath, record);

  // Read all records and count matches
  const records = readJsonlRecords<ErrorRecord>(jsonlPath);
  const matchingCount = records.filter(
    (r) => truncateMessage(r.error_message, 100) === matchKey,
  ).length;

  const maxRepeats = config.errorPatternDetector.maxRepeats;

  if (matchingCount >= maxRepeats) {
    const message = `REPEATED FAILURE DETECTED: The tool '${input.tool_name}' has failed ${matchingCount} times with a similar error. Consider trying a different approach.`;
    return { repeated: true, count: matchingCount, message };
  }

  return { repeated: false, count: matchingCount };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    try {
      const failureInput = input as PostToolUseFailureInput;
      const result = detectErrorPattern(failureInput, config);

      if (result.repeated && result.message) {
        const output: HookHandlerResult = {
          exitCode: 0,
          stdout: JSON.stringify({ additionalContext: result.message }),
        };
        return output;
      }

      return undefined;
    } catch {
      // Best-effort — never crash the hook
      return undefined;
    }
  };
}
