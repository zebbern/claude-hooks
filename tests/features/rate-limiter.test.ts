import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { checkRateLimit } from '../../src/features/rate-limiter/index.js';
import { createHandler } from '../../src/features/rate-limiter/handler.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-rate-limiter-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(
  maxToolCallsPerSession = 0,
  maxFileEditsPerSession = 0,
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    logDir: tempDir,
    rateLimiter: { maxToolCallsPerSession, maxFileEditsPerSession, enabled },
  };
}

function makeInput(toolName = 'Read', sessionId = 'test-session'): PreToolUseInput {
  return {
    session_id: sessionId,
    tool_name: toolName,
    tool_input: {},
  };
}

describe('rate-limiter', () => {
  describe('checkRateLimit', () => {
    it('proceeds when disabled', () => {
      const result = checkRateLimit(makeInput(), makeConfig(5, 3, false));
      expect(result.action).toBe('proceed');
    });

    it('proceeds when under limit', () => {
      const config = makeConfig(10, 5);
      const result = checkRateLimit(makeInput(), config);
      expect(result.action).toBe('proceed');
    });

    it('blocks when maxToolCallsPerSession exceeded', () => {
      const config = makeConfig(3, 0);

      // Make 3 calls (should all proceed)
      checkRateLimit(makeInput('Read'), config);
      checkRateLimit(makeInput('Glob'), config);
      checkRateLimit(makeInput('Grep'), config);

      // 4th call should block
      const result = checkRateLimit(makeInput('Read'), config);
      expect(result.action).toBe('block');
      expect(result.message).toContain('tool calls');
    });

    it('blocks when maxFileEditsPerSession exceeded for Write/Edit/MultiEdit', () => {
      const config = makeConfig(0, 2);

      checkRateLimit(makeInput('Write'), config);
      checkRateLimit(makeInput('Edit'), config);

      // 3rd file edit should block
      const result = checkRateLimit(makeInput('MultiEdit'), config);
      expect(result.action).toBe('block');
      expect(result.message).toContain('file edits');
    });

    it('proceeds when thresholds are 0 (unlimited)', () => {
      const config = makeConfig(0, 0);
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(makeInput(), config).action).toBe('proceed');
      }
    });

    it('creates JSONL file and counter file on first call', () => {
      const config = makeConfig(10, 5);
      checkRateLimit(makeInput(), config);

      const logPath = path.join(tempDir, 'rate-limiter', 'test-session.jsonl');
      const counterPath = path.join(tempDir, 'rate-limiter', 'test-session.count');
      expect(fs.existsSync(logPath)).toBe(true);
      expect(fs.existsSync(counterPath)).toBe(true);
    });

    it('counts correctly from existing counter file', () => {
      const config = makeConfig(5, 0);
      const logDir = path.join(tempDir, 'rate-limiter');
      fs.mkdirSync(logDir, { recursive: true });

      // Pre-seed counter with 4 calls
      const counterPath = path.join(logDir, 'test-session.count');
      fs.writeFileSync(counterPath, JSON.stringify({ totalCalls: 4, totalEdits: 0 }), 'utf-8');

      // 5th call proceeds (at limit)
      const result1 = checkRateLimit(makeInput(), config);
      expect(result1.action).toBe('proceed');

      // 6th call blocks (over limit)
      const result2 = checkRateLimit(makeInput(), config);
      expect(result2.action).toBe('block');
    });

    it('non-edit tools do not count toward file edit limit', () => {
      const config = makeConfig(0, 2);

      checkRateLimit(makeInput('Read'), config);
      checkRateLimit(makeInput('Glob'), config);
      checkRateLimit(makeInput('Grep'), config);

      // These should still proceed since they're not edits
      const result = checkRateLimit(makeInput('Write'), config);
      expect(result.action).toBe('proceed');
    });

    it('allows exactly max tool calls (boundary: max-1 proceeds, max proceeds, max+1 blocks)', () => {
      const max = 5;
      const config = makeConfig(max, 0);

      // Calls 1 through max-1 should all proceed
      for (let i = 1; i < max; i++) {
        const result = checkRateLimit(makeInput(`Tool${i}`), config);
        expect(result.action).toBe('proceed');
      }

      // The max-th call should still proceed (exactly at limit)
      const atLimit = checkRateLimit(makeInput('ToolAtMax'), config);
      expect(atLimit.action).toBe('proceed');

      // The (max+1)-th call should block
      const overLimit = checkRateLimit(makeInput('ToolOverMax'), config);
      expect(overLimit.action).toBe('block');
    });

    it('allows exactly max file edits (boundary: max-1 proceeds, max proceeds, max+1 blocks)', () => {
      const max = 3;
      const config = makeConfig(0, max);

      // Edits 1 through max-1 should all proceed
      for (let i = 1; i < max; i++) {
        const result = checkRateLimit(makeInput('Write'), config);
        expect(result.action).toBe('proceed');
      }

      // The max-th edit should still proceed (exactly at limit)
      const atLimit = checkRateLimit(makeInput('Edit'), config);
      expect(atLimit.action).toBe('proceed');

      // The (max+1)-th edit should block
      const overLimit = checkRateLimit(makeInput('MultiEdit'), config);
      expect(overLimit.action).toBe('block');
    });
  });

  describe('createHandler', () => {
    it('returns block result when limit exceeded', async () => {
      const config = makeConfig(2, 0);
      const handler = createHandler('PreToolUse');

      await handler(makeInput(), config);
      await handler(makeInput(), config);

      const result = await handler(makeInput(), config);
      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(2);
    });

    it('returns undefined when under limit', async () => {
      const handler = createHandler('PreToolUse');
      const result = await handler(makeInput(), makeConfig(100, 0));
      expect(result).toBeUndefined();
    });
  });
});
