import fs from 'node:fs';
import path from 'node:path';
import type { PreToolUseInput, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';

/**
 * Backs up a file before it is overwritten by a Write/Edit/MultiEdit tool.
 *
 * Copies the existing file to `{backupDir}/{session_id}/{timestamp}_{basename}`.
 * This is best-effort — errors are silently caught so backup never crashes a hook.
 *
 * @param input - The `PreToolUse` hook input containing `tool_name` and `tool_input.file_path`.
 * @param config - The resolved toolkit configuration.
 */
export function backupFile(input: PreToolUseInput, config: ToolkitConfig): void {
  try {
    if (!config.fileBackup.enabled) return;
    if (!WRITE_TOOLS.has(input.tool_name)) return;

    const filePath = typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : '';
    if (!filePath) return;

    if (!fs.existsSync(filePath)) return;

    const sessionDir = path.join(config.fileBackup.backupDir, input.session_id);
    fs.mkdirSync(sessionDir, { recursive: true });

    const timestamp = Date.now();
    const basename = path.basename(filePath);
    const backupPath = path.join(sessionDir, `${timestamp}_${basename}`);

    fs.copyFileSync(filePath, backupPath);
  } catch {
    // Backup is best-effort — never crash the hook
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    backupFile(input as PreToolUseInput, config);
    return undefined;
  };
}
