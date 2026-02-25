import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/config-validator.js';

describe('validateConfig', () => {
  it('returns valid for an empty config (all defaults)', () => {
    const result = validateConfig({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns valid for a correct partial config', () => {
    const result = validateConfig({
      logDir: 'custom/logs',
      guards: {
        command: { enabled: true, blockedPatterns: ['rm -rf'] },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects invalid boolean (string "true" instead of true)', () => {
    const result = validateConfig({
      guards: {
        command: { enabled: 'true' },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('guards.command.enabled');
    expect(result.errors[0]).toContain('boolean');
  });

  it('detects invalid number (string instead of number)', () => {
    const result = validateConfig({
      guards: {
        diffSize: { maxLines: 'lots' },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('guards.diffSize.maxLines');
    expect(result.errors[0]).toContain('number');
  });

  it('detects number below minimum', () => {
    const result = validateConfig({
      guards: {
        diffSize: { maxLines: 0 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('guards.diffSize.maxLines');
    expect(result.errors[0]).toContain('>= 1');
  });

  it('allows zero for rateLimiter fields (min: 0)', () => {
    const result = validateConfig({
      rateLimiter: { maxToolCallsPerSession: 0, maxFileEditsPerSession: 0 },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects invalid string array (not an array)', () => {
    const result = validateConfig({
      guards: {
        command: { blockedPatterns: 'not-an-array' },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('guards.command.blockedPatterns');
    expect(result.errors[0]).toContain('array');
  });

  it('detects non-string elements in string array', () => {
    const result = validateConfig({
      guards: {
        command: { blockedPatterns: ['valid', 123] },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('guards.command.blockedPatterns[1]');
  });

  it('detects invalid regex pattern in blockedPatterns', () => {
    const result = validateConfig({
      guards: {
        command: { blockedPatterns: ['valid.*pattern', '[invalid(regex'] },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e: string) => e.includes('Invalid regex'))).toBe(true);
    expect(result.errors.some((e: string) => e.includes('blockedPatterns'))).toBe(true);
  });

  it('detects invalid regex in secretLeak.customPatterns', () => {
    const result = validateConfig({
      guards: {
        secretLeak: { customPatterns: ['(unclosed'] },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('customPatterns'))).toBe(true);
  });

  it('warns on unknown top-level keys', () => {
    const result = validateConfig({
      unknownKey: 'value',
      anotherBadKey: 42,
    });
    expect(result.valid).toBe(true); // warnings don't make it invalid
    expect(result.warnings.length).toBe(2);
    expect(result.warnings[0]).toContain('unknownKey');
    expect(result.warnings[1]).toContain('anotherBadKey');
  });

  it('does not warn on known top-level keys', () => {
    const result = validateConfig({
      logDir: 'logs',
      guards: {},
      validators: {},
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('validates multiple errors at once', () => {
    const result = validateConfig({
      guards: {
        command: { enabled: 'yes', blockedPatterns: 42 },
        diffSize: { maxLines: -5 },
      },
      rateLimiter: { maxToolCallsPerSession: 'many' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('validates string fields reject non-strings', () => {
    const result = validateConfig({
      logDir: 123,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('logDir');
    expect(result.errors[0]).toContain('string');
  });

  it('accepts valid regex patterns', () => {
    const result = validateConfig({
      guards: {
        command: { blockedPatterns: ['rm\\s+-rf', 'chmod\\s+777', '^sudo'] },
        secretLeak: { customPatterns: ['AKIA[0-9A-Z]{16}'] },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates deeply nested fields correctly', () => {
    const result = validateConfig({
      projectVisualizer: { maxDepth: 'deep' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('projectVisualizer.maxDepth');
  });

  it('validates errorPatternDetector.maxRepeats', () => {
    const result = validateConfig({
      errorPatternDetector: { maxRepeats: 0 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('maxRepeats');
    expect(result.errors[0]).toContain('>= 1');
  });

  it('validates validators.test.timeout', () => {
    const result = validateConfig({
      validators: { test: { timeout: -100 } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('validators.test.timeout');
  });

  // -----------------------------------------------------------------------
  // ReDoS safety warnings
  // -----------------------------------------------------------------------

  describe('ReDoS safety warnings', () => {
    it('warns on nested quantifier in blockedPatterns', () => {
      const result = validateConfig({
        guards: {
          command: { blockedPatterns: ['(a+)+'] },
        },
      });
      expect(result.valid).toBe(true); // warnings don't invalidate
      expect(result.warnings.some((w: string) => w.includes('unsafe regex'))).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('blockedPatterns'))).toBe(true);
    });

    it('warns on nested quantifier in secretLeak.customPatterns', () => {
      const result = validateConfig({
        guards: {
          secretLeak: { customPatterns: ['(x+)+$'] },
        },
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('unsafe regex'))).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('customPatterns'))).toBe(true);
    });

    it('warns on nested quantifier in permissions.autoAllow', () => {
      const result = validateConfig({
        permissions: { autoAllow: ['(a*)*'] },
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('unsafe regex'))).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('autoAllow'))).toBe(true);
    });

    it('warns on nested quantifier in todoTracker.patterns', () => {
      const result = validateConfig({
        todoTracker: { patterns: ['(TODO+)+'] },
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('unsafe regex'))).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('todoTracker.patterns'))).toBe(true);
    });

    it('does not warn on safe regex patterns', () => {
      const result = validateConfig({
        guards: {
          command: { blockedPatterns: ['rm\\s+-rf', 'chmod\\s+777', '^sudo'] },
          secretLeak: { customPatterns: ['AKIA[0-9A-Z]{16}'] },
        },
        permissions: { autoAllow: ['Read', 'List.*'] },
        todoTracker: { patterns: ['TODO', 'FIXME', 'HACK'] },
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns on multiple unsafe patterns in same field', () => {
      const result = validateConfig({
        guards: {
          command: { blockedPatterns: ['(a+)+', 'safe-pattern', '(b*)*'] },
        },
      });
      expect(result.valid).toBe(true);
      const reDoSWarnings = result.warnings.filter((w: string) => w.includes('unsafe regex'));
      expect(reDoSWarnings).toHaveLength(2);
    });

    it('skips ReDoS check for invalid (unparseable) regex', () => {
      const result = validateConfig({
        guards: {
          command: { blockedPatterns: ['[invalid(regex'] },
        },
      });
      // Should have an error for invalid regex but no ReDoS warning
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Invalid regex'))).toBe(true);
      expect(result.warnings.filter((w: string) => w.includes('unsafe regex'))).toHaveLength(0);
    });
  });
});
