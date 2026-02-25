import pc from 'picocolors';

/**
 * Computes the Levenshtein edit distance between two strings.
 * Used to find the closest match for "did you mean?" suggestions.
 */
function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix: number[][] = [];

  for (let i = 0; i <= aLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bLen; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  return matrix[aLen]![bLen]!;
}

/**
 * Finds the closest match from a list of valid options.
 * Returns the best match if it's within a reasonable edit distance, or null.
 *
 * A match is considered "close enough" if:
 * - It starts with the given value, OR
 * - The value starts with it, OR
 * - The Levenshtein distance is <= max(2, floor(value.length / 3))
 */
export function suggestSimilar(value: string, validOptions: readonly string[]): string | null {
  if (validOptions.length === 0) return null;

  const lower = value.toLowerCase();
  const maxDistance = Math.max(2, Math.floor(lower.length / 3));

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const option of validOptions) {
    const optionLower = option.toLowerCase();

    // Exact prefix match is a strong signal
    if (optionLower.startsWith(lower) || lower.startsWith(optionLower)) {
      if (bestMatch === null || option.length < bestMatch.length) {
        bestMatch = option;
        bestDistance = 0;
      }
      continue;
    }

    const distance = levenshteinDistance(lower, optionLower);
    if (distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = option;
    }
  }

  return bestMatch;
}

/**
 * Formats an error message for an unknown value with a list of valid options.
 *
 * @example
 * formatUnknownValue('preset', 'securty', ['minimal', 'security', 'quality', 'full'])
 * // "Unknown preset 'securty'. Available presets: minimal, security, quality, full"
 */
export function formatUnknownValue(label: string, value: string, validOptions: readonly string[]): string {
  const available = validOptions.join(', ');
  let message = `Unknown ${label} '${value}'. Available ${label}s: ${available}`;

  const suggestion = suggestSimilar(value, validOptions);
  if (suggestion !== null && suggestion !== value) {
    message += `\n\n  Did you mean ${pc.bold(suggestion)}?`;
  }

  return message;
}

/**
 * Formats an invalid JSON error with a hint about the expected format.
 */
export function formatInvalidJsonError(context: string, expectedExample: string): string {
  return `Invalid JSON ${context}. Expected format: '${expectedExample}'`;
}

/**
 * Formats a config parse error with a suggestion to run validate.
 */
export function formatConfigParseError(configPath: string, specificError: string): string {
  return `Failed to parse config at '${configPath}': ${specificError}. Run 'claude-hooks config validate' to check your config.`;
}
