const SENSITIVE_FIELDS = ['content', 'new_string', 'old_string'] as const;
const MAX_FIELD_LENGTH = 200;
const TRUNCATED_MARKER = ' [TRUNCATED]';
const REDACTED_MARKER = '[REDACTED]';

const SECRET_PATTERNS: RegExp[] = [
  /(?:sk|pk)[-_](?:live|test|prod)[-_]\w{20,}/gi,     // Stripe-style keys
  /(?:ghp|gho|ghs|ghr|github_pat)_\w{30,}/gi,         // GitHub tokens
  /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,             // AWS access keys
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,       // JWT tokens
  /xox[bposa]-[A-Za-z0-9-]{20,}/g,                     // Slack tokens
  /(?:key|token|secret|password|apikey|api_key|access_key)[\s]*[=:]\s*['"]?[A-Za-z0-9+/=_-]{16,}['"]?/gi,  // Generic key=value patterns
];

/**
 * Replaces known secret patterns in a string with a `[REDACTED]` marker.
 *
 * Detects Stripe keys, GitHub tokens, AWS access keys, JWTs, Slack tokens,
 * and generic `key=value` credential patterns.
 */
function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED_MARKER);
  }
  return result;
}

/**
 * Redacts sensitive fields from hook input data before logging.
 *
 * Truncates known-sensitive fields (`content`, `new_string`, `old_string`)
 * within `tool_input` to the first {@link MAX_FIELD_LENGTH} characters,
 * appending a `[TRUNCATED]` marker when content is shortened.
 *
 * Also handles `tool_input.edits[].new_string` and `tool_input.edits[].old_string`
 * for MultiEdit operations.
 *
 * @param data - The raw hook input data (will not be mutated).
 * @returns A deep-cloned copy with sensitive fields redacted.
 */
export function redactSensitiveFields(data: Record<string, unknown>): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

  const toolInput = cloned.tool_input;
  if (typeof toolInput !== 'object' || toolInput === null) {
    return cloned;
  }

  const input = toolInput as Record<string, unknown>;

  for (const field of SENSITIVE_FIELDS) {
    const value = input[field];
    if (typeof value === 'string') {
      let redacted = redactSecrets(value);
      if (redacted.length > MAX_FIELD_LENGTH) {
        redacted = redacted.slice(0, MAX_FIELD_LENGTH) + TRUNCATED_MARKER;
      }
      input[field] = redacted;
    }
  }

  // Handle MultiEdit edits array
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (typeof edit !== 'object' || edit === null) continue;
      const editObj = edit as Record<string, unknown>;
      for (const field of SENSITIVE_FIELDS) {
        const value = editObj[field];
        if (typeof value === 'string') {
          let redacted = redactSecrets(value);
          if (redacted.length > MAX_FIELD_LENGTH) {
            redacted = redacted.slice(0, MAX_FIELD_LENGTH) + TRUNCATED_MARKER;
          }
          editObj[field] = redacted;
        }
      }
    }
  }

  return cloned;
}
