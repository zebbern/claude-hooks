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
import { WRITE_TOOLS, collectWriteContent } from '../../utils/tool-inputs.js';
import { readJsonlRecords, appendJsonlRecord } from '../../utils/jsonl.js';
import { getCachedRegex } from '../../utils/regex-safety.js';

interface TodoRecord {
  timestamp: string;
  session_id: string;
  file_path: string;
  todosFound: number;
  markers: string[];
}

interface TodoSummary {
  totalTodosFound: number;
  byFile: Record<string, number>;
  markers: string[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMarkers(text: string, patterns: string[]): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const escaped = escapeRegex(pattern);
    const regex = getCachedRegex(escaped, 'gi');
    if (!regex) {
      process.stderr.write(`[claude-hooks-toolkit] Invalid todo-tracker pattern: ${pattern}\n`);
      continue;
    }
    const matches = text.match(regex);
    if (matches) {
      found.push(...matches.map((m) => m.toUpperCase()));
    }
  }
  return found;
}

function appendTodoRecord(input: PostToolUseInput, config: ToolkitConfig): void {
  const outputDir = config.todoTracker.outputPath;
  fs.mkdirSync(outputDir, { recursive: true });

  const chunks = collectWriteContent(input);
  const allMarkers: string[] = [];
  for (const chunk of chunks) {
    allMarkers.push(...findMarkers(chunk, config.todoTracker.patterns));
  }

  if (allMarkers.length === 0) return;

  const filePath = typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : '';

  const record: TodoRecord = {
    timestamp: new Date().toISOString(),
    session_id: input.session_id,
    file_path: filePath,
    todosFound: allMarkers.length,
    markers: allMarkers,
  };

  const jsonlPath = path.join(outputDir, `${input.session_id}-todos.jsonl`);
  appendJsonlRecord(jsonlPath, record);
}

function writeTodoSummary(input: StopInput, config: ToolkitConfig): void {
  const outputDir = config.todoTracker.outputPath;
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonlPath = path.join(outputDir, `${input.session_id}-todos.jsonl`);

  const records = readJsonlRecords<TodoRecord>(jsonlPath);

  const byFile: Record<string, number> = {};
  const allMarkers: string[] = [];
  for (const record of records) {
    byFile[record.file_path] = (byFile[record.file_path] ?? 0) + record.todosFound;
    allMarkers.push(...record.markers);
  }

  const summary: TodoSummary = {
    totalTodosFound: allMarkers.length,
    byFile,
    markers: [...new Set(allMarkers)],
  };

  const summaryPath = path.join(outputDir, `${input.session_id}-todo-summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf-8');
}

/**
 * Tracks TODO/FIXME/HACK/XXX markers in written content.
 *
 * - On `PostToolUse`: scans Write/Edit/MultiEdit content for marker patterns.
 * - On `Stop`: reads all records and writes a summary JSON.
 *
 * Never blocks — tracking only. Errors are silently caught.
 *
 * @param input - The hook input (PostToolUse or Stop).
 * @param hookType - The current hook event type.
 * @param config - The resolved toolkit configuration.
 */
export function trackTodos(
  input: PostToolUseInput | StopInput,
  hookType: HookEventType,
  config: ToolkitConfig,
): void {
  try {
    if (!config.todoTracker.enabled) return;

    if (hookType === 'PostToolUse') {
      const postInput = input as PostToolUseInput;
      if (!WRITE_TOOLS.has(postInput.tool_name)) return;
      appendTodoRecord(postInput, config);
    } else if (hookType === 'Stop') {
      writeTodoSummary(input as StopInput, config);
    }
  } catch {
    // Tracking is best-effort — never crash the hook
  }
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    trackTodos(input as PostToolUseInput | StopInput, hookType, config);
    return undefined;
  };
}
