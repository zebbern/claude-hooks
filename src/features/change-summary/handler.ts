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
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';
import { readJsonlRecords, appendJsonlRecord } from '../../utils/jsonl.js';
import { countLines } from '../../utils/text.js';

interface ChangeRecord {
  timestamp: string;
  tool_name: string;
  file_path: string;
  change_type: 'create' | 'modify';
  lines_added: number;
}

interface ChangeSummary {
  session_id: string;
  totalChanges: number;
  filesModified: string[];
  changesByFile: Record<string, number>;
  summary: string[];
}

function appendChangeRecord(input: PostToolUseInput, config: ToolkitConfig): void {
  const outputDir = config.changeSummary.outputPath;
  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : '';
  let changeType: 'create' | 'modify' = 'modify';
  let linesAdded = 0;

  switch (input.tool_name) {
    case 'Write': {
      changeType = 'create';
      const content = typeof input.tool_input.content === 'string' ? input.tool_input.content : '';
      linesAdded = countLines(content);
      break;
    }
    case 'Edit': {
      changeType = 'modify';
      const newString = typeof input.tool_input.new_string === 'string' ? input.tool_input.new_string : '';
      linesAdded = countLines(newString);
      break;
    }
    case 'MultiEdit': {
      changeType = 'modify';
      const edits = Array.isArray(input.tool_input.edits) ? input.tool_input.edits : [];
      for (const edit of edits) {
        if (typeof edit === 'object' && edit !== null && 'new_string' in edit) {
          const ns = typeof (edit as Record<string, unknown>).new_string === 'string'
            ? (edit as Record<string, unknown>).new_string as string
            : '';
          linesAdded += countLines(ns);
        }
      }
      break;
    }
  }

  const record: ChangeRecord = {
    timestamp: new Date().toISOString(),
    tool_name: input.tool_name,
    file_path: filePath,
    change_type: changeType,
    lines_added: linesAdded,
  };

  const jsonlPath = path.join(outputDir, `${input.session_id}-changes.jsonl`);
  appendJsonlRecord(jsonlPath, record);
}

function writeChangeSummary(input: StopInput, config: ToolkitConfig): void {
  const outputDir = config.changeSummary.outputPath;
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonlPath = path.join(outputDir, `${input.session_id}-changes.jsonl`);

  const records = readJsonlRecords<ChangeRecord>(jsonlPath);

  const changesByFile: Record<string, number> = {};
  const changeTypeByFile: Record<string, 'create' | 'modify'> = {};
  for (const record of records) {
    changesByFile[record.file_path] = (changesByFile[record.file_path] ?? 0) + 1;
    if (record.change_type === 'create' && !changeTypeByFile[record.file_path]) {
      changeTypeByFile[record.file_path] = 'create';
    } else if (changeTypeByFile[record.file_path] !== 'create') {
      changeTypeByFile[record.file_path] = 'modify';
    }
  }

  const filesModified = Object.keys(changesByFile);
  const summaryLines: string[] = [];
  for (const file of filesModified) {
    const count = changesByFile[file]!;
    const type = changeTypeByFile[file]!;
    if (type === 'create') {
      summaryLines.push(`Created ${file}`);
    } else {
      summaryLines.push(`Modified ${file} (${count} edit${count > 1 ? 's' : ''})`);
    }
  }

  const summary: ChangeSummary = {
    session_id: input.session_id,
    totalChanges: records.length,
    filesModified,
    changesByFile,
    summary: summaryLines,
  };

  const summaryPath = path.join(outputDir, `${input.session_id}-change-summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf-8');
}

/**
 * Records file changes and generates a summary.
 *
 * - On `PostToolUse`: appends a JSONL record for Write/Edit/MultiEdit.
 * - On `Stop`: reads all records and writes a summary JSON.
 *
 * Errors are silently caught so tracking never crashes a hook.
 *
 * @param input - The hook input (PostToolUse or Stop).
 * @param hookType - The current hook event type.
 * @param config - The resolved toolkit configuration.
 */
export function recordChange(
  input: PostToolUseInput | StopInput,
  hookType: HookEventType,
  config: ToolkitConfig,
): void {
  try {
    if (!config.changeSummary.enabled) return;

    if (hookType === 'PostToolUse') {
      const postInput = input as PostToolUseInput;
      if (!WRITE_TOOLS.has(postInput.tool_name)) return;
      appendChangeRecord(postInput, config);
    } else if (hookType === 'Stop') {
      writeChangeSummary(input as StopInput, config);
    }
  } catch {
    // Tracking is best-effort — never crash the hook
  }
}

/**
 * Generates a change summary for a session.
 *
 * Reads the JSONL log and writes a summary JSON file.
 * This is a convenience re-export used on Stop events.
 *
 * @param sessionId - The session ID.
 * @param config - The resolved toolkit configuration.
 */
export function generateChangeSummary(sessionId: string, config: ToolkitConfig): void {
  const stopInput: StopInput = {
    session_id: sessionId,
    stop_hook_active: false,
    transcript_path: '',
  };
  recordChange(stopInput, 'Stop', config);
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    recordChange(input as PostToolUseInput | StopInput, hookType, config);
    return undefined;
  };
}
