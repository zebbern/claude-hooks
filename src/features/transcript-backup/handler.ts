import fs from 'node:fs';
import path from 'node:path';
import type { PreCompactInput, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';

/**
 * Copies the current transcript to a timestamped backup file.
 *
 * The backup is written to `{transcriptBackupDir}/{ISO-timestamp}-{session-prefix}.jsonl`.
 * Returns `null` if the transcript file does not exist or the copy fails.
 *
 * @param input - The `PreCompact` hook input containing `transcript_path` and `session_id`.
 * @param config - The resolved toolkit configuration (uses `transcriptBackupDir`).
 * @returns The absolute path to the backup file, or `null` on failure.
 */
export function backupTranscript(input: PreCompactInput, config: ToolkitConfig): string | null {
  try {
    if (!input.transcript_path || !fs.existsSync(input.transcript_path)) {
      return null;
    }

    fs.mkdirSync(config.transcriptBackupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionPrefix = input.session_id.slice(0, 8);
    const backupFilename = `${timestamp}-${sessionPrefix}.jsonl`;
    const backupPath = path.join(config.transcriptBackupDir, backupFilename);

    fs.copyFileSync(input.transcript_path, backupPath);

    return backupPath;
  } catch {
    return null;
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const compactInput = input as PreCompactInput;
    const backupPath = backupTranscript(compactInput, config);
    const contextParts: string[] = [];
    if (backupPath) {
      contextParts.push(`Transcript backed up to: ${backupPath}`);
    }
    if (compactInput.custom_instructions) {
      contextParts.push(`Custom instructions: ${compactInput.custom_instructions}`);
    }

    if (contextParts.length > 0) {
      return {
        exitCode: 0,
        stdout: JSON.stringify({ additionalContext: contextParts.join('\n') }),
      };
    }
    return undefined;
  };
}
