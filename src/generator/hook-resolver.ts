import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HookEventType } from '../types.js';
import { ALL_HOOK_EVENT_TYPES } from '../types.js';

const HOOK_TYPE_TO_FILENAME: Record<HookEventType, string> = {
  PreToolUse: 'pre-tool-use',
  PostToolUse: 'post-tool-use',
  PostToolUseFailure: 'post-tool-use-failure',
  UserPromptSubmit: 'user-prompt-submit',
  Notification: 'notification',
  Stop: 'stop',
  SubagentStart: 'subagent-start',
  SubagentStop: 'subagent-stop',
  PreCompact: 'pre-compact',
  Setup: 'setup',
  SessionStart: 'session-start',
  SessionEnd: 'session-end',
  PermissionRequest: 'permission-request',
};

/**
 * Converts a PascalCase hook event type to its kebab-case filename (without extension).
 *
 * @param hookType - The hook event type (e.g., `'PreToolUse'`).
 * @returns The kebab-case filename (e.g., `'pre-tool-use'`).
 */
export function hookEventToFilename(hookType: HookEventType): string {
  return HOOK_TYPE_TO_FILENAME[hookType];
}

function getDistDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  // In dist: dist/generator/hook-resolver.js -> dist/
  return path.resolve(path.dirname(currentFile), '..');
}

/**
 * Returns the absolute path to a compiled hook entry-point file.
 *
 * Resolves relative to the package's `dist/hooks/` directory.
 *
 * @param hookType - The hook event type (e.g., `'PreToolUse'`).
 * @returns Absolute path to the corresponding `.js` file.
 */
export function resolveHookPath(hookType: HookEventType): string {
  const filename = HOOK_TYPE_TO_FILENAME[hookType];
  return path.resolve(getDistDir(), 'hooks', `${filename}.js`);
}

/**
 * Returns a record mapping every hook event type to its compiled entry-point path.
 *
 * @returns A `Record<HookEventType, string>` of absolute file paths.
 */
export function resolveAllHookPaths(): Record<HookEventType, string> {
  const result = {} as Record<HookEventType, string>;
  for (const hookType of ALL_HOOK_EVENT_TYPES) {
    result[hookType] = resolveHookPath(hookType);
  }
  return result;
}
