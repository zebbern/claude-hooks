import fs from 'node:fs';
import path from 'node:path';
import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { WRITE_AND_EXEC_TOOLS } from '../../utils/tool-inputs.js';
import { getCachedRegex } from '../../utils/regex-safety.js';

let cachedBranch: string | null = null;

/**
 * Reads the current Git branch from `.git/HEAD` instead of spawning a git process.
 * If HEAD contains `ref: refs/heads/<branch>`, extracts the branch name.
 * Otherwise (detached HEAD), returns the raw hash.
 */
function getCurrentBranch(): string | null {
  if (cachedBranch !== null) return cachedBranch;
  try {
    const headPath = path.join(process.cwd(), '.git', 'HEAD');
    const headContent = fs.readFileSync(headPath, 'utf-8').trim();
    const REF_PREFIX = 'ref: refs/heads/';
    if (headContent.startsWith(REF_PREFIX)) {
      cachedBranch = headContent.slice(REF_PREFIX.length);
    } else {
      // Detached HEAD — return the commit hash
      cachedBranch = headContent;
    }
    return cachedBranch;
  } catch {
    return null;
  }
}

function matchesBranchPattern(branch: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
    const regex = getCachedRegex(regexStr, '');
    return regex !== null && regex.test(branch);
  }
  return branch === pattern;
}

/**
 * Checks whether the current Git branch is protected.
 *
 * Only applies to `Write`, `Edit`, `MultiEdit`, and `Bash` tools.
 * If the current branch matches any pattern in `protectedBranches`, the operation is blocked.
 * If Git is not available, the check proceeds gracefully.
 *
 * @param input - The `PreToolUse` hook input.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'block'` if on a protected branch, else `'proceed'`.
 */
export function checkBranch(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (!WRITE_AND_EXEC_TOOLS.has(input.tool_name)) {
    return { action: 'proceed' };
  }

  if (!config.guards.branch.enabled) {
    return { action: 'proceed' };
  }

  const branch = getCurrentBranch();
  if (branch === null) {
    return { action: 'proceed' };
  }

  const { protectedBranches } = config.guards.branch;
  for (const pattern of protectedBranches) {
    if (matchesBranchPattern(branch, pattern)) {
      return {
        action: 'block',
        message: `Branch '${branch}' is protected (matched pattern '${pattern}')`,
        details: { branch, matchedPattern: pattern },
      };
    }
  }

  return { action: 'proceed' };
}

/** @internal Reset cached branch for testing. */
export function _resetBranchCache(): void {
  cachedBranch = null;
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkBranch(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'Protected branch');
  };
}
