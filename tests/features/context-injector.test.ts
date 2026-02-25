import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { injectContext } from '../../src/features/context-injector/index.js';
import { createHandler } from '../../src/features/context-injector/handler.js';
import type { ToolkitConfig, SessionStartInput, UserPromptSubmitInput } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-context-injector-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(
  contextFiles: string[] = [],
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    contextInjector: { contextFiles, enabled },
  };
}

function makeSessionStartInput(): SessionStartInput {
  return {
    session_id: 'test-session',
    source: 'startup',
  };
}

function makeUserPromptInput(): UserPromptSubmitInput {
  return {
    session_id: 'test-session',
    prompt: 'Fix the bug',
  };
}

describe('context-injector', () => {
  describe('injectContext', () => {
    it('skips when disabled', () => {
      const contextFile = path.join(tempDir, 'context.md');
      fs.writeFileSync(contextFile, '# Project Rules');
      const result = injectContext('SessionStart', makeConfig([contextFile], false));
      expect(result).toBeUndefined();
    });

    it('reads context file and returns content on SessionStart', () => {
      const contextFile = path.join(tempDir, 'context.md');
      fs.writeFileSync(contextFile, '# Project Rules\nAlways use TypeScript.');
      const result = injectContext('SessionStart', makeConfig([contextFile]));
      expect(result).toBe('# Project Rules\nAlways use TypeScript.');
    });

    it('reads context file on UserPromptSubmit', () => {
      const contextFile = path.join(tempDir, 'context.md');
      fs.writeFileSync(contextFile, '# Context');
      const result = injectContext('UserPromptSubmit', makeConfig([contextFile]));
      expect(result).toBe('# Context');
    });

    it('skips when context file does not exist', () => {
      const result = injectContext(
        'SessionStart',
        makeConfig([path.join(tempDir, 'nonexistent.md')]),
      );
      expect(result).toBeUndefined();
    });

    it('supports multiple context files and concatenates', () => {
      const file1 = path.join(tempDir, 'context1.md');
      const file2 = path.join(tempDir, 'context2.md');
      fs.writeFileSync(file1, 'Rule 1');
      fs.writeFileSync(file2, 'Rule 2');
      const result = injectContext('SessionStart', makeConfig([file1, file2]));
      expect(result).toBe('Rule 1\n\nRule 2');
    });

    it('handles read errors silently', () => {
      // A directory path instead of a file — reading will fail
      const result = injectContext('SessionStart', makeConfig([tempDir]));
      expect(result).toBeUndefined();
    });

    it('returns undefined when no context available', () => {
      const result = injectContext('SessionStart', makeConfig([]));
      expect(result).toBeUndefined();
    });
  });

  describe('createHandler', () => {
    it('returns additionalContext on SessionStart', async () => {
      const contextFile = path.join(tempDir, 'context.md');
      fs.writeFileSync(contextFile, '# Rules');
      const handler = createHandler('SessionStart');
      const result = await handler(makeSessionStartInput(), makeConfig([contextFile]));

      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(0);
      const parsed = JSON.parse(result!.stdout!);
      expect(parsed.additionalContext).toBe('# Rules');
    });

    it('returns undefined when no context file exists', async () => {
      const handler = createHandler('SessionStart');
      const result = await handler(
        makeSessionStartInput(),
        makeConfig([path.join(tempDir, 'missing.md')]),
      );
      expect(result).toBeUndefined();
    });
  });
});
