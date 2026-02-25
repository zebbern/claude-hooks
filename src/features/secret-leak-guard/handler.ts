import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { WRITE_TOOLS, collectWriteContent } from '../../utils/tool-inputs.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { getCachedRegex } from '../../utils/regex-safety.js';

interface SecretPattern {
  name: string;
  regex: RegExp;
}

const BUILT_IN_PATTERNS: SecretPattern[] = [
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS secret key', regex: /(?:aws_secret_access_key|secret_key|aws_secret)\s*[:=]\s*['"]?[0-9a-zA-Z/+]{40}/ },
  { name: 'GitHub token', regex: /gh[ps]_[A-Za-z0-9_]{36,}/ },
  { name: 'OpenAI key', regex: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'Generic API key', regex: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/ },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: 'Connection string with password', regex: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/ },
];

function isAllowed(text: string, allowedPatterns: string[]): boolean {
  for (const pattern of allowedPatterns) {
    const regex = getCachedRegex(pattern, '');
    if (regex !== null && regex.test(text)) return true;
  }
  return false;
}

/**
 * Scans content being written for secret patterns.
 *
 * Only applies to `Write`, `Edit`, and `MultiEdit` tools.
 * If any built-in or custom secret pattern matches, the operation is blocked.
 * Patterns in `allowedPatterns` suppress false positives.
 *
 * @param input - The `PreToolUse` hook input.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'block'` if a secret is found, else `'proceed'`.
 */
export function checkSecretLeak(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (!WRITE_TOOLS.has(input.tool_name)) {
    return { action: 'proceed' };
  }

  if (!config.guards.secretLeak.enabled) {
    return { action: 'proceed' };
  }

  const chunks = collectWriteContent(input);
  if (chunks.length === 0) {
    return { action: 'proceed' };
  }

  const customPatterns: SecretPattern[] = config.guards.secretLeak.customPatterns
    .map((p, i) => {
      const regex = getCachedRegex(p, '');
      return regex !== null ? { name: `Custom pattern #${i + 1}`, regex } : null;
    })
    .filter((p): p is SecretPattern => p !== null);

  const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];
  const { allowedPatterns } = config.guards.secretLeak;

  for (const chunk of chunks) {
    if (isAllowed(chunk, allowedPatterns)) continue;

    for (const pattern of allPatterns) {
      const match = pattern.regex.exec(chunk);
      if (match) {
        if (isAllowed(match[0], allowedPatterns)) continue;
        return {
          action: 'block',
          message: `Potential secret detected: ${pattern.name}`,
          details: { patternName: pattern.name, toolName: input.tool_name },
        };
      }
    }
  }

  return { action: 'proceed' };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkSecretLeak(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'Secret leak detected');
  };
}
