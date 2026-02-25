import path from 'node:path';
import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { globToRegex } from '../../utils/glob.js';

function isExampleEnvFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith('.env.sample') || lower.endsWith('.env.example');
}

function matchesProtectedPattern(filePath: string, patterns: string[]): string | undefined {
  const basename = path.basename(filePath);

  for (const pattern of patterns) {
    if (pattern === '.env') {
      if (basename === '.env' || basename.startsWith('.env.')) {
        if (!isExampleEnvFile(basename)) {
          return pattern;
        }
      }
      continue;
    }

    const regex = globToRegex(pattern, { crossDirectories: true });
    if (regex.test(basename)) {
      return pattern;
    }
  }

  return undefined;
}

/**
 * Checks whether a file write/edit targets a protected file.
 *
 * Only applies to the `Write`, `Edit`, and `MultiEdit` tools. Files are matched
 * against `config.guards.file.protectedPatterns` using glob-style matching.
 * `.env.sample` and `.env.example` files are explicitly allowed.
 *
 * @param input - The `PreToolUse` hook input containing `tool_name` and `tool_input.file_path`.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'proceed'` or `action: 'block'`.
 *
 * @example
 * ```ts
 * import { checkFileAccess, loadConfig } from 'claude-hooks-toolkit';
 *
 * const result = checkFileAccess(
 *   { tool_name: 'Write', tool_input: { file_path: '.env' } },
 *   loadConfig(),
 * );
 * console.log(result.action); // 'block'
 * ```
 */
export function checkFileAccess(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (!WRITE_TOOLS.has(input.tool_name)) {
    return { action: 'proceed' };
  }

  if (!config.guards.file.enabled) {
    return { action: 'proceed' };
  }

  const filePath = typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : '';
  if (!filePath) {
    return { action: 'proceed' };
  }

  const matchedPattern = matchesProtectedPattern(filePath, config.guards.file.protectedPatterns);
  if (matchedPattern) {
    return {
      action: 'block',
      message: `Blocked write to protected file: ${path.basename(filePath)} (matches pattern: ${matchedPattern})`,
      details: { filePath, matchedPattern },
    };
  }

  return { action: 'proceed' };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkFileAccess(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'File access blocked');
  };
}
