import { describe, it, expect, beforeEach } from 'vitest';
import { checkRegexSafety, getCachedRegex, _resetRegexCache } from '../../src/utils/regex-safety.js';

describe('checkRegexSafety', () => {
  // -----------------------------------------------------------------------
  // Safe patterns — should NOT be flagged
  // -----------------------------------------------------------------------

  describe('safe patterns', () => {
    const safePatterns = [
      'rm\\s+-rf',
      'chmod\\s+777',
      '^sudo',
      'AKIA[0-9A-Z]{16}',
      '\\b(TODO|FIXME|HACK)\\b',
      'password\\s*[:=]',
      '.*\\.env$',
      '^(feat|fix|chore)\\/',
      '[a-zA-Z0-9]+',
      '(abc|def|ghi)',
      '(abc)+',           // quantified group without inner quantifier — safe
      'a{2,5}',           // bounded quantifier — safe
      '(a)(b+)',           // group followed by quantified group — safe
      '(?:https?://)',     // non-capturing group — safe
      '\\d{3}-\\d{4}',
      'foo|bar|baz',
      '',                  // empty pattern
    ];

    for (const pattern of safePatterns) {
      it(`accepts: ${JSON.stringify(pattern)}`, () => {
        const result = checkRegexSafety(pattern);
        expect(result.safe).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    }
  });

  // -----------------------------------------------------------------------
  // Unsafe patterns — nested quantifiers
  // -----------------------------------------------------------------------

  describe('nested quantifiers', () => {
    const unsafePatterns = [
      { pattern: '(a+)+',    desc: 'quantified atom in quantified group' },
      { pattern: '(a*)*',    desc: 'star-star' },
      { pattern: '(a+)*',    desc: 'plus inside star group' },
      { pattern: '(a*)+',    desc: 'star inside plus group' },
      { pattern: '(a+b+)+',  desc: 'multiple quantified atoms in group' },
      { pattern: '(x+y+z+)*', desc: 'three quantified atoms in group' },
      { pattern: '([a-z]+)+', desc: 'quantified class in quantified group' },
      { pattern: '(\\d+)+',  desc: 'quantified escape in quantified group' },
      { pattern: '(a{2,})+', desc: 'open-ended repetition in quantified group' },
      { pattern: '(a{1,5})+', desc: 'bounded repetition in quantified group' },
      { pattern: '((a+))+',  desc: 'nested groups with quantifiers' },
      { pattern: '(?:a+)+',  desc: 'non-capturing group with nested quantifier' },
    ];

    for (const { pattern, desc } of unsafePatterns) {
      it(`flags: ${JSON.stringify(pattern)} — ${desc}`, () => {
        const result = checkRegexSafety(pattern);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('nested quantifiers');
      });
    }
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles escaped parentheses (not real groups)', () => {
      const result = checkRegexSafety('\\(a+\\)+');
      expect(result.safe).toBe(true);
    });

    it('handles character class containing quantifier chars', () => {
      // [+*] is a character class, not a quantifier
      const result = checkRegexSafety('([+*])+');
      expect(result.safe).toBe(true);
    });

    it('handles character class containing parens', () => {
      const result = checkRegexSafety('[(]+');
      expect(result.safe).toBe(true);
    });

    it('handles complex but safe pattern', () => {
      const result = checkRegexSafety('^(?:https?|ftp)://[^\\s/$.?#].[^\\s]*$');
      expect(result.safe).toBe(true);
    });

    it('detects nested quantifier in complex pattern', () => {
      const result = checkRegexSafety('^(a+)+$');
      expect(result.safe).toBe(false);
    });

    it('detects nested quantifier with lookbehind-like prefix stripped', () => {
      // (?:a+)+ is equivalent to (a+)+
      const result = checkRegexSafety('(?:a+)+');
      expect(result.safe).toBe(false);
    });

    it('handles unbalanced parens gracefully', () => {
      // Should not throw — just best-effort analysis
      const result = checkRegexSafety('(a+');
      expect(result.safe).toBe(true); // Can't form a quantified group
    });

    it('handles deeply nested safe groups', () => {
      const result = checkRegexSafety('((abc)(def))+');
      expect(result.safe).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// getCachedRegex — compiled regex cache
// ---------------------------------------------------------------------------

describe('getCachedRegex', () => {
  beforeEach(() => {
    _resetRegexCache();
  });

  it('compiles a valid pattern and returns a RegExp', () => {
    const regex = getCachedRegex('\\bfoo\\b');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test('foo')).toBe(true);
    expect(regex!.test('FOO')).toBe(true); // default flag 'i'
  });

  it('returns the same instance on subsequent calls', () => {
    const first = getCachedRegex('abc', 'i');
    const second = getCachedRegex('abc', 'i');
    expect(first).toBe(second);
  });

  it('returns null for invalid patterns', () => {
    const result = getCachedRegex('[invalid(');
    expect(result).toBeNull();
  });

  it('caches null for invalid patterns (does not retry)', () => {
    const first = getCachedRegex('[invalid(');
    const second = getCachedRegex('[invalid(');
    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  it('distinguishes different flags for the same pattern', () => {
    const caseInsensitive = getCachedRegex('abc', 'i');
    const caseSensitive = getCachedRegex('abc', '');
    expect(caseInsensitive).not.toBe(caseSensitive);
    expect(caseInsensitive!.flags).toBe('i');
    expect(caseSensitive!.flags).toBe('');
  });

  it('uses case-insensitive flag by default', () => {
    const regex = getCachedRegex('hello');
    expect(regex!.flags).toBe('i');
  });

  it('handles empty pattern', () => {
    const regex = getCachedRegex('');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test('anything')).toBe(true);
  });

  it('correctly matches with custom flags', () => {
    const regex = getCachedRegex('^line', 'm');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex!.test('first\nline two')).toBe(true);
  });

  it('_resetRegexCache clears all cached entries', () => {
    const first = getCachedRegex('test-pattern');
    _resetRegexCache();
    const second = getCachedRegex('test-pattern');
    expect(first).not.toBe(second); // different instances after reset
    expect(first).toEqual(second);  // but equivalent
  });
});
