import fs from 'node:fs';
import path from 'node:path';
import type {
  HookEventType,
  HookHandler,
  HookInputBase,
  PostToolUseInput,
  StopInput,
  ToolkitConfig,
} from '../../types.js';
import { readJsonlRecords, appendJsonlRecord } from '../../utils/jsonl.js';

interface ToolUsageRecord {
  timestamp: string;
  session_id: string;
  tool_name: string;
  hook_type: string;
}

interface SessionSummary {
  session_id: string;
  totalToolCalls: number;
  toolFrequency: Record<string, number>;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  estimatedDurationMs: number | null;
}

function appendToolUsage(input: PostToolUseInput, config: ToolkitConfig): void {
  const outputDir = config.costTracker.outputPath;
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonlPath = path.join(outputDir, `${input.session_id}.jsonl`);
  const record: ToolUsageRecord = {
    timestamp: new Date().toISOString(),
    session_id: input.session_id,
    tool_name: input.tool_name,
    hook_type: 'PostToolUse',
  };

  appendJsonlRecord(jsonlPath, record);
}

function writeSummary(input: StopInput, config: ToolkitConfig): void {
  const outputDir = config.costTracker.outputPath;
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonlPath = path.join(outputDir, `${input.session_id}.jsonl`);

  const records = readJsonlRecords<ToolUsageRecord>(jsonlPath);

  const toolFrequency: Record<string, number> = {};
  for (const record of records) {
    toolFrequency[record.tool_name] = (toolFrequency[record.tool_name] ?? 0) + 1;
  }

  const firstTimestamp = records.length > 0 ? records[0]!.timestamp : null;
  const lastTimestamp = records.length > 0 ? records[records.length - 1]!.timestamp : null;

  let estimatedDurationMs: number | null = null;
  if (firstTimestamp && lastTimestamp) {
    estimatedDurationMs = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();
  }

  const summary: SessionSummary = {
    session_id: input.session_id,
    totalToolCalls: records.length,
    toolFrequency,
    firstTimestamp,
    lastTimestamp,
    estimatedDurationMs,
  };

  const summaryPath = path.join(outputDir, `${input.session_id}-summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf-8');
}

/**
 * Tracks tool usage during a session.
 *
 * - On `PostToolUse`: appends a JSONL record to `{outputPath}/{session_id}.jsonl`.
 * - On `Stop`: reads all records, computes a summary, writes `{session_id}-summary.json`.
 *
 * Errors are silently caught so tracking never crashes a hook.
 *
 * @param input - The hook input (PostToolUse or Stop).
 * @param hookType - The current hook event type.
 * @param config - The resolved toolkit configuration.
 */
export function trackToolUsage(
  input: PostToolUseInput | StopInput,
  hookType: HookEventType,
  config: ToolkitConfig,
): void {
  try {
    if (!config.costTracker.enabled) return;

    if (hookType === 'PostToolUse') {
      appendToolUsage(input as PostToolUseInput, config);
    } else if (hookType === 'Stop') {
      writeSummary(input as StopInput, config);
    }
  } catch {
    // Cost tracking is best-effort — never crash the hook
  }
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    trackToolUsage(input as PostToolUseInput | StopInput, hookType, config);
    return undefined;
  };
}
