import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { globToRegex } from '../../utils/glob.js';

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Checks whether a file path is within the allowed scope.
 *
 * Only applies to `Write`, `Edit`, and `MultiEdit` tools.
 * If `allowedPaths` is empty, all paths are allowed (open scope).
 * If `allowedPaths` has entries, the file path must match at least one glob pattern.
 *
 * @param input - The `PreToolUse` hook input.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'block'` if file is outside scope, else `'proceed'`.
 */
export function checkScope(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (!WRITE_TOOLS.has(input.tool_name)) {
    return { action: 'proceed' };
  }

  if (!config.guards.scope.enabled) {
    return { action: 'proceed' };
  }

  const { allowedPaths } = config.guards.scope;
  if (allowedPaths.length === 0) {
    return { action: 'proceed' };
  }

  const filePath = typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : '';
  if (!filePath) {
    return { action: 'proceed' };
  }

  const normalized = normalizePath(filePath);

  for (const pattern of allowedPaths) {
    const regex = globToRegex(normalizePath(pattern));
    if (regex.test(normalized)) {
      return { action: 'proceed' };
    }
  }

  return {
    action: 'block',
    message: `File outside allowed scope: ${filePath}`,
    details: { filePath, allowedPaths },
  };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkScope(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'File outside allowed scope');
  };
}
