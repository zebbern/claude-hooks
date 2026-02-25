import path from 'node:path';
import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';

function normalizePath(p: string): string {
  return path.resolve(p).toLowerCase().replace(/\\/g, '/');
}

/**
 * Blocks file operations that resolve outside the project root.
 *
 * Normalizes paths (resolve -> lowercase -> forward slashes) and checks that the
 * resolved target stays within `cwd` or any configured `allowedRoots`.
 *
 * @param input - The `PreToolUse` hook input with `tool_input.file_path`.
 * @param cwd - The project root directory used as the boundary.
 * @param config - Optional toolkit config. If provided and `guards.path.enabled` is
 *   `false`, the guard returns `proceed` immediately.
 * @returns A {@link GuardResult} with `action: 'proceed'` or `action: 'block'`.
 */
export function checkPathTraversal(input: PreToolUseInput, cwd: string, config?: ToolkitConfig): GuardResult {
  if (config && !config.guards.path.enabled) {
    return { action: 'proceed' };
  }

  const filePath = typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : '';
  if (!filePath) {
    return { action: 'proceed' };
  }

  const resolvedPath = normalizePath(path.resolve(cwd, filePath));
  const resolvedCwd = normalizePath(cwd);

  // Check if path is within cwd (append separator to prevent sibling-directory bypass)
  const cwdWithSep = resolvedCwd.endsWith('/') ? resolvedCwd : resolvedCwd + '/';
  if (resolvedPath === resolvedCwd || resolvedPath.startsWith(cwdWithSep)) {
    return { action: 'proceed' };
  }

  // Check if path is within any allowed root
  const allowedRoots = config?.guards.path.allowedRoots ?? [];
  for (const root of allowedRoots) {
    const resolvedRoot = normalizePath(root);
    const rootWithSep = resolvedRoot.endsWith('/') ? resolvedRoot : resolvedRoot + '/';
    if (resolvedPath === resolvedRoot || resolvedPath.startsWith(rootWithSep)) {
      return { action: 'proceed' };
    }
  }

  return {
    action: 'block',
    message: `Blocked path traversal: ${filePath} resolves outside project root`,
    details: { filePath, resolvedPath, projectRoot: resolvedCwd },
  };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const cwd = process.cwd();
    const result = checkPathTraversal(input as PreToolUseInput, cwd, config);
    return guardResultToHandlerResult(result, 'Path traversal blocked');
  };
}
