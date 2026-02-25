// ---------------------------------------------------------------------------
// ReDoS (Regular Expression Denial of Service) safety checker
// ---------------------------------------------------------------------------
//
// Detects regex patterns vulnerable to catastrophic backtracking.
// This is a heuristic analysis — false positives are possible but
// acceptable since results are used for warnings, not blocking.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Compiled RegExp cache — avoids recompilation on every hook call
// ---------------------------------------------------------------------------

const regexCache = new Map<string, RegExp | null>();

/**
 * Returns a cached compiled RegExp for the given pattern string.
 * Compiles once, reuses on subsequent calls with the same pattern + flags.
 * Returns `null` if the pattern is invalid (and caches that result too).
 */
export function getCachedRegex(pattern: string, flags = 'i'): RegExp | null {
  const key = `${pattern}\0${flags}`;
  const cached = regexCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const regex = new RegExp(pattern, flags);
    regexCache.set(key, regex);
    return regex;
  } catch {
    regexCache.set(key, null);
    return null;
  }
}

/** @internal Reset the regex cache — for testing only. */
export function _resetRegexCache(): void {
  regexCache.clear();
}

export interface RegexSafetyResult {
  /** Whether the pattern is considered safe from ReDoS. */
  safe: boolean;
  /** Human-readable reason when the pattern is flagged as unsafe. */
  reason?: string;
}

/**
 * Checks a regex pattern string for potential ReDoS vulnerabilities.
 *
 * Detects nested quantifiers that can cause catastrophic backtracking:
 * - `(a+)+`, `(a*)*`, `(a+)*`, `(a*)+`
 * - `(a+b+)+` — multiple quantified elements in a quantified group
 * - `(a{2,})+` — open-ended repetition in a quantified group
 * - Nested groups: `((a+)b+)+`
 *
 * @param pattern - The regex source string (without delimiters/flags).
 * @returns A {@link RegexSafetyResult} indicating safety.
 */
export function checkRegexSafety(pattern: string): RegexSafetyResult {
  const cleaned = stripEscapesAndClasses(pattern);
  const reason = detectNestedQuantifiers(cleaned);
  return reason ? { safe: false, reason } : { safe: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Replaces escaped characters and character classes with inert placeholders
 * so that subsequent analysis only sees structural regex tokens.
 *
 * - `\\.` (any escaped char) → `_`
 * - `[...]` (character class)  → `_`
 */
function stripEscapesAndClasses(pattern: string): string {
  let result = '';
  let i = 0;
  const len = pattern.length;

  while (i < len) {
    if (pattern[i] === '\\') {
      result += '_'; // placeholder for escaped char
      i += 2;
      continue;
    }

    if (pattern[i] === '[') {
      i++; // skip [
      if (i < len && pattern[i] === '^') i++; // skip negation
      if (i < len && pattern[i] === ']') i++; // ] right after [ or [^ is literal
      while (i < len && pattern[i] !== ']') {
        if (pattern[i] === '\\') i++; // skip escaped char inside class
        i++;
      }
      i++; // skip closing ]
      result += '_'; // placeholder for entire class
      continue;
    }

    result += pattern[i];
    i++;
  }

  return result;
}

/**
 * Checks whether the character at `pos` starts a repetition quantifier
 * (`+`, `*`, or `{n,m}` / `{n,}`).
 *
 * Single `?` is excluded — it doesn't cause unbounded backtracking on its own.
 */
function isRepetitionQuantifier(s: string, pos: number): boolean {
  if (pos >= s.length) return false;
  const ch = s[pos];
  if (ch === '+' || ch === '*') return true;
  if (ch === '{') {
    const rest = s.slice(pos);
    // Match {n,m} or {n,} (open-ended) — skip fixed {n} which is safe
    return /^\{\d+,\d*\}/.test(rest);
  }
  return false;
}

/**
 * Walk the cleaned pattern with a stack, find every group, and check whether
 * any group that is followed by a repetition quantifier also *contains* a
 * repetition quantifier in its body. That's the "star height > 1" condition
 * which enables catastrophic backtracking.
 */
function detectNestedQuantifiers(pattern: string): string | null {
  const stack: number[] = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '(') {
      stack.push(i);
      continue;
    }

    if (pattern[i] === ')') {
      const openPos = stack.pop();
      if (openPos === undefined) continue;

      // Is this group followed by a repetition quantifier?
      if (isRepetitionQuantifier(pattern, i + 1)) {
        // Extract group body and strip non-capturing / look-ahead prefixes
        const rawBody = pattern.slice(openPos + 1, i);
        const body = rawBody.replace(/^\?[:=!]|^\?<[!=]/, '');

        if (bodyContainsRepetition(body)) {
          return 'nested quantifiers detected — potential catastrophic backtracking';
        }
      }
      continue;
    }
  }

  return null;
}

/**
 * Returns `true` if the body string contains a repetition quantifier applied
 * to any atom — including atoms inside nested groups.
 *
 * Properly handles nested groups by recursively checking their content.
 * If any sub-group contains a quantified element, the whole body is considered
 * to contain repetition (since the outer group is already quantified).
 */
function bodyContainsRepetition(body: string): boolean {
  let i = 0;
  const len = body.length;

  while (i < len) {
    const ch = body[i];

    // Handle nested groups — treat entire group as one atom
    if (ch === '(') {
      let depth = 1;
      const groupStart = i;
      i++;
      while (i < len && depth > 0) {
        if (body[i] === '(') depth++;
        if (body[i] === ')') depth--;
        i++;
      }
      // `i` is now one past the closing ')' — check if group is quantified
      if (isRepetitionQuantifier(body, i)) return true;

      // Recursively check inner group content — if it contains a quantifier
      // and the outer group is quantified, that's nested quantifiers
      const innerBody = body.slice(groupStart + 1, i - 1);
      const strippedInner = innerBody.replace(/^\?[:=!]|^\?<[!=]/, '');
      if (bodyContainsRepetition(strippedInner)) return true;

      continue;
    }

    // Pipe and structural tokens are not atoms
    if (ch === '|' || ch === ')') {
      i++;
      continue;
    }

    // Quantifier characters themselves are not atoms
    if (ch === '+' || ch === '*' || ch === '?') {
      i++;
      continue;
    }

    // `{` can be part of a quantifier — skip it and its contents
    if (ch === '{') {
      const rest = body.slice(i);
      const match = rest.match(/^\{\d+,?\d*\}/);
      if (match) {
        i += match[0].length;
        continue;
      }
    }

    // Regular atom character — check if next position is a quantifier
    i++;
    if (isRepetitionQuantifier(body, i)) return true;
  }

  return false;
}
