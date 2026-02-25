/**
 * Normalizes hook input from either VS Code (camelCase) or Claude Code (snake_case) format
 * into the internal snake_case representation.
 *
 * VS Code sends `sessionId` while Claude Code sends `session_id`. This normalizer
 * auto-detects the format and maps camelCase fields to their snake_case equivalents.
 * Extra VS Code fields (`hookEventName`, `cwd`, `timestamp`) are preserved as-is.
 */

/**
 * Sanitizes a session_id to prevent path traversal attacks.
 *
 * Replaces any character that is not alphanumeric, underscore, or hyphen with `_`.
 * This ensures session_id values like `../../etc/cron.d/evil` become safe for use in
 * `path.join()` calls.
 *
 * @param id - The raw session_id string from hook input.
 * @returns A sanitized string safe for use in file paths.
 */
export function sanitizeSessionId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

/**
 * Field mapping from VS Code camelCase to internal snake_case.
 * Only fields that differ between formats are listed here.
 */
const CAMEL_TO_SNAKE_MAP: Record<string, string> = {
  sessionId: 'session_id',
};

/**
 * Detects whether the input uses VS Code camelCase format.
 *
 * @param input - The raw parsed JSON input object.
 * @returns `true` if the input contains camelCase-specific fields (e.g., `sessionId`).
 */
export function isVSCodeFormat(input: Record<string, unknown>): boolean {
  return 'sessionId' in input && !('session_id' in input);
}

/**
 * Normalizes hook input to internal snake_case format and sanitizes session_id.
 *
 * If the input already uses snake_case (`session_id`), field mapping is skipped.
 * If the input uses camelCase (`sessionId`), the mapped fields are converted
 * to snake_case. Extra VS Code fields are preserved unchanged.
 * In both cases, `session_id` is sanitized to prevent path traversal.
 *
 * @typeParam T - The expected shape of the normalized input.
 * @param input - The raw parsed JSON input object.
 * @returns The input with all known camelCase fields mapped to snake_case and session_id sanitized.
 */
export function normalizeHookInput<T>(input: Record<string, unknown>): T {
  if (!isVSCodeFormat(input)) {
    const result = { ...input };
    if (typeof result['session_id'] === 'string') {
      result['session_id'] = sanitizeSessionId(result['session_id']);
    }
    return result as T;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    const mappedKey = CAMEL_TO_SNAKE_MAP[key] ?? key;
    normalized[mappedKey] = value;
  }

  if (typeof normalized['session_id'] === 'string') {
    normalized['session_id'] = sanitizeSessionId(normalized['session_id']);
  }

  return normalized as T;
}
