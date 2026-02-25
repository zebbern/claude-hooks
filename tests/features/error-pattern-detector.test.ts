import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { detectErrorPattern } from '../../src/features/error-pattern-detector/index.js';
import { createHandler } from '../../src/features/error-pattern-detector/handler.js';
import type { PostToolUseFailureInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-error-pattern-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(
  maxRepeats = 3,
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    logDir: tempDir,
    errorPatternDetector: { maxRepeats, enabled },
  };
}

function makeFailureInput(
  toolName = 'Write',
  error = 'File not found: /src/missing.ts',
): PostToolUseFailureInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: { file_path: '/src/app.ts' },
    error,
  };
}

describe('error-pattern-detector', () => {
  describe('detectErrorPattern', () => {
    it('skips when disabled', () => {
      const result = detectErrorPattern(
        makeFailureInput(),
        makeConfig(3, false),
      );
      expect(result.repeated).toBe(false);
      expect(result.count).toBe(0);
    });

    it('records first error occurrence without flagging', () => {
      const result = detectErrorPattern(makeFailureInput(), makeConfig());
      expect(result.repeated).toBe(false);
      expect(result.count).toBe(1);
    });

    it('does not flag fewer than maxRepeats occurrences', () => {
      const config = makeConfig();
      detectErrorPattern(makeFailureInput(), config);
      const result = detectErrorPattern(makeFailureInput(), config);
      expect(result.repeated).toBe(false);
      expect(result.count).toBe(2);
    });

    it('flags repeated error at maxRepeats threshold', () => {
      const config = makeConfig(3);
      detectErrorPattern(makeFailureInput(), config);
      detectErrorPattern(makeFailureInput(), config);
      const result = detectErrorPattern(makeFailureInput(), config);
      expect(result.repeated).toBe(true);
      expect(result.count).toBe(3);
      expect(result.message).toContain('REPEATED FAILURE DETECTED');
      expect(result.message).toContain('Write');
      expect(result.message).toContain('3 times');
    });

    it('uses configured maxRepeats value', () => {
      const config = makeConfig(2);
      detectErrorPattern(makeFailureInput(), config);
      const result = detectErrorPattern(makeFailureInput(), config);
      expect(result.repeated).toBe(true);
      expect(result.count).toBe(2);
    });

    it('matches errors by first 100 chars', () => {
      const config = makeConfig(2);
      const longError = 'A'.repeat(100) + '_different_suffix_1';
      const longError2 = 'A'.repeat(100) + '_different_suffix_2';

      detectErrorPattern(makeFailureInput('Write', longError), config);
      const result = detectErrorPattern(makeFailureInput('Write', longError2), config);
      // First 100 chars match, so they should be counted together
      expect(result.repeated).toBe(true);
      expect(result.count).toBe(2);
    });

    it('creates output directory', () => {
      const errorDir = path.join(tempDir, 'error-patterns');
      expect(fs.existsSync(errorDir)).toBe(false);
      detectErrorPattern(makeFailureInput(), makeConfig());
      expect(fs.existsSync(errorDir)).toBe(true);
    });

    it('never crashes on file errors', () => {
      const config = makeConfig();
      // Use a non-writable logDir to trigger errors
      config.logDir = '/nonexistent/path/that/should/not/exist';

      // Should not throw
      expect(() => detectErrorPattern(makeFailureInput(), config)).not.toThrow();
    });
  });

  describe('createHandler', () => {
    it('returns additionalContext when repeated', async () => {
      const config = makeConfig(2);
      const handler = createHandler('PostToolUseFailure');

      await handler(makeFailureInput(), config);
      const result = await handler(makeFailureInput(), config);

      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(0);
      const parsed = JSON.parse(result!.stdout!);
      expect(parsed.additionalContext).toContain('REPEATED FAILURE DETECTED');
    });
  });
});
