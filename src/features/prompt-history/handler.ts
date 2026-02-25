import fs from 'node:fs';
import path from 'node:path';
import type { UserPromptSubmitInput, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';

interface PromptEntry {
  timestamp: string;
  prompt: string;
}

/**
 * Logs a user prompt to `{logDir}/prompts/{session_id}.jsonl`.
 *
 * Respects `config.promptHistory.enabled` — does nothing when disabled.
 * Creates directories as needed with mode `0o700` (owner-only on Linux/macOS).
 * Errors are silently swallowed.
 *
 * **Sensitivity note:** Prompt content is intentionally stored verbatim because
 * capturing user prompts is the core purpose of this feature. Users opt in via
 * `promptHistory.enabled`. The log directory uses restrictive permissions to
 * limit access.
 *
 * @param input - The `UserPromptSubmit` hook input containing `prompt` and `session_id`.
 * @param config - The resolved toolkit configuration (uses `logDir` and `promptHistory.enabled`).
 */
export function logPrompt(input: UserPromptSubmitInput, config: ToolkitConfig): void {
  if (!config.promptHistory.enabled) {
    return;
  }

  try {
    const dir = path.join(config.logDir, 'prompts');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

    const entry: PromptEntry = {
      timestamp: new Date().toISOString(),
      prompt: input.prompt,
    };

    const filePath = path.join(dir, `${input.session_id}.jsonl`);
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Prompt logging should never crash the hook
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    logPrompt(input as UserPromptSubmitInput, config);
    return undefined;
  };
}
