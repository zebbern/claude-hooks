import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { getCachedRegex } from '../../utils/regex-safety.js';

const ENV_ACCESS_PATTERNS = [
  'cat\\s+.*\\.env\\b',
  'less\\s+.*\\.env\\b',
  'more\\s+.*\\.env\\b',
  'head\\s+.*\\.env\\b',
  'tail\\s+.*\\.env\\b',
  'cp\\s+.*\\.env\\b',
  'mv\\s+.*\\.env\\b',
  '>>?\\s*.*\\.env\\b',
  'sed\\s+.*-i.*\\.env\\b',
  'tee\\s+.*\\.env\\b',
];

function isAllowed(command: string, allowedPatterns: string[]): boolean {
  return allowedPatterns.some((pattern) => {
    const regex = getCachedRegex(pattern);
    return regex !== null && regex.test(command);
  });
}

// NOTE: Pattern-based command blocking has inherent limitations.
// Sophisticated bypass techniques (variable expansion, quoting tricks,
// encoding) cannot be fully prevented. For high-security environments,
// use OS-level sandboxing (e.g., Docker, firejail) in addition to this guard.

/**
 * Checks a Bash command against blocked and allowed patterns.
 *
 * Only applies to the `Bash` tool. Commands are tested against the configured
 * `blockedPatterns` and hard-coded `.env` access patterns. If `allowedPatterns`
 * is non-empty and the command matches, it bypasses the block check.
 *
 * @param input - The `PreToolUse` hook input containing `tool_name` and `tool_input.command`.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'proceed'` or `action: 'block'`.
 *
 * @example
 * ```ts
 * import { checkCommand, loadConfig } from 'claude-hooks-toolkit';
 *
 * const result = checkCommand(
 *   { tool_name: 'Bash', tool_input: { command: 'rm -rf /' } },
 *   loadConfig(),
 * );
 * console.log(result.action); // 'block'
 * ```
 */
export function checkCommand(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (input.tool_name !== 'Bash') {
    return { action: 'proceed' };
  }

  if (!config.guards.command.enabled) {
    return { action: 'proceed' };
  }

  const command = typeof input.tool_input.command === 'string' ? input.tool_input.command : '';
  if (!command) {
    return { action: 'proceed' };
  }

  const allowedPatterns = config.guards.command.allowedPatterns;
  if (allowedPatterns.length > 0 && isAllowed(command, allowedPatterns)) {
    return { action: 'proceed' };
  }

  const blockedPatterns = config.guards.command.blockedPatterns;

  for (const pattern of blockedPatterns) {
    const regex = getCachedRegex(pattern);
    if (regex !== null && regex.test(command)) {
      return {
        action: 'block',
        message: `Blocked dangerous command matching pattern: ${pattern}`,
        details: { command, pattern },
      };
    }
  }

  for (const pattern of ENV_ACCESS_PATTERNS) {
    const regex = getCachedRegex(pattern);
    if (regex !== null && regex.test(command)) {
      return {
        action: 'block',
        message: `Blocked .env file access: ${command}`,
        details: { command, pattern },
      };
    }
  }

  return { action: 'proceed' };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkCommand(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'Command blocked');
  };
}
