import { describe, it, expect } from 'vitest';
import { checkDiffSize } from '../../src/features/diff-size-guard/index.js';
import { createHandler } from '../../src/features/diff-size-guard/handler.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeConfig(maxLines = 500, enabled = true): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    guards: {
      ...DEFAULT_CONFIG.guards,
      diffSize: { maxLines, enabled },
    },
  };
}

function makeInput(toolName: string, toolInput: Record<string, unknown> = {}): PreToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: toolInput,
  };
}

function generateLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `line ${i + 1}`).join('\n');
}

describe('diff-size-guard', () => {
  describe('checkDiffSize', () => {
    it('proceeds for non-Write/Edit/MultiEdit tools', () => {
      const result = checkDiffSize(makeInput('Bash', { command: 'echo hi' }), makeConfig());
      expect(result.action).toBe('proceed');
    });

    it('proceeds when disabled in config', () => {
      const content = generateLines(1000);
      const result = checkDiffSize(makeInput('Write', { content }), makeConfig(500, false));
      expect(result.action).toBe('proceed');
    });

    it('proceeds when content is under maxLines', () => {
      const content = generateLines(10);
      const result = checkDiffSize(makeInput('Write', { content }), makeConfig(500));
      expect(result.action).toBe('proceed');
    });

    it('blocks when Write content exceeds maxLines', () => {
      const content = generateLines(600);
      const result = checkDiffSize(makeInput('Write', { content }), makeConfig(500));
      expect(result.action).toBe('block');
      expect(result.message).toContain('600');
      expect(result.message).toContain('500');
    });

    it('blocks when Edit new_string exceeds maxLines', () => {
      const newString = generateLines(600);
      const result = checkDiffSize(makeInput('Edit', { new_string: newString }), makeConfig(500));
      expect(result.action).toBe('block');
      expect(result.message).toContain('600');
    });

    it('blocks when MultiEdit total new_string lines exceed maxLines', () => {
      const edits = [
        { new_string: generateLines(300) },
        { new_string: generateLines(300) },
      ];
      const result = checkDiffSize(makeInput('MultiEdit', { edits }), makeConfig(500));
      expect(result.action).toBe('block');
      expect(result.message).toContain('600');
    });

    it('handles missing content gracefully', () => {
      const result = checkDiffSize(makeInput('Write', {}), makeConfig(500));
      expect(result.action).toBe('proceed');
    });

    it('handles empty content (0 lines)', () => {
      const result = checkDiffSize(makeInput('Write', { content: '' }), makeConfig(500));
      expect(result.action).toBe('proceed');
    });

    it('respects custom maxLines config', () => {
      const content = generateLines(50);
      const result = checkDiffSize(makeInput('Write', { content }), makeConfig(30));
      expect(result.action).toBe('block');
    });

    it('proceeds when exactly at maxLines', () => {
      const content = generateLines(500);
      const result = checkDiffSize(makeInput('Write', { content }), makeConfig(500));
      expect(result.action).toBe('proceed');
    });

    it('handles non-string content gracefully', () => {
      const result = checkDiffSize(makeInput('Write', { content: 42 }), makeConfig(500));
      expect(result.action).toBe('proceed');
    });

    it('handles MultiEdit with non-array edits gracefully', () => {
      const result = checkDiffSize(makeInput('MultiEdit', { edits: 'not-an-array' }), makeConfig(500));
      expect(result.action).toBe('proceed');
    });
  });

  describe('createHandler', () => {
    it('returns function that blocks on oversized diff', async () => {
      const handler = createHandler('PreToolUse');
      const content = generateLines(600);
      const input = makeInput('Write', { content });
      const result = await handler(input, makeConfig(500));
      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(2);
      expect(result!.stderr).toContain('600');
    });

    it('returns undefined for normal diffs', async () => {
      const handler = createHandler('PreToolUse');
      const content = generateLines(10);
      const input = makeInput('Write', { content });
      const result = await handler(input, makeConfig(500));
      expect(result).toBeUndefined();
    });
  });
});
