import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { trackTodos } from '../../src/features/todo-tracker/index.js';
import { createHandler } from '../../src/features/todo-tracker/handler.js';
import type { PostToolUseInput, StopInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-todo-tracker-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(
  patterns = ['TODO', 'FIXME', 'HACK', 'XXX'],
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    todoTracker: { outputPath: tempDir, patterns, enabled },
  };
}

function makePostToolUseInput(toolName = 'Write', toolInput: Record<string, unknown> = {}): PostToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: { file_path: '/src/app.ts', ...toolInput },
    tool_output: 'success',
  };
}

function makeStopInput(): StopInput {
  return {
    session_id: 'test-session',
    stop_hook_active: false,
    transcript_path: '/tmp/transcript.txt',
  };
}

describe('todo-tracker', () => {
  describe('trackTodos', () => {
    it('skips when disabled', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// TODO: fix this' }),
        'PostToolUse',
        makeConfig(['TODO'], false),
      );
      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
    });

    it('detects TODO in written content', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// TODO: implement this' }),
        'PostToolUse',
        makeConfig(),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.todosFound).toBeGreaterThan(0);
      expect(record.markers).toContain('TODO');
    });

    it('detects FIXME in written content', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// FIXME: broken logic' }),
        'PostToolUse',
        makeConfig(),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.markers).toContain('FIXME');
    });

    it('detects multiple markers', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// TODO: item1\n// FIXME: item2\n// HACK: workaround' }),
        'PostToolUse',
        makeConfig(),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.todosFound).toBe(3);
      expect(record.markers).toContain('TODO');
      expect(record.markers).toContain('FIXME');
      expect(record.markers).toContain('HACK');
    });

    it('case-insensitive matching', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// todo: lowercase\n// Todo: mixed' }),
        'PostToolUse',
        makeConfig(),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.todosFound).toBe(2);
    });

    it('handles files with no markers', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: 'const x = 42;\nconsole.log(x);' }),
        'PostToolUse',
        makeConfig(),
      );

      // No JSONL created since no markers found
      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
    });

    it('respects custom patterns config', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// REVIEW: check this' }),
        'PostToolUse',
        makeConfig(['REVIEW']),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.markers).toContain('REVIEW');
    });

    it('skips non-write tools', () => {
      trackTodos(
        makePostToolUseInput('Read', { content: '// TODO: should not track' }),
        'PostToolUse',
        makeConfig(),
      );
      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
    });
  });

  describe('Stop summary', () => {
    it('generates summary on Stop', () => {
      trackTodos(
        makePostToolUseInput('Write', { file_path: 'src/a.ts', content: '// TODO: fix\n// FIXME: broken' }),
        'PostToolUse',
        makeConfig(),
      );
      trackTodos(
        makePostToolUseInput('Write', { file_path: 'src/b.ts', content: '// HACK: workaround' }),
        'PostToolUse',
        makeConfig(),
      );

      trackTodos(makeStopInput(), 'Stop', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-todo-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.totalTodosFound).toBe(3);
      expect(summary.byFile['src/a.ts']).toBe(2);
      expect(summary.byFile['src/b.ts']).toBe(1);
    });

    it('handles empty session on Stop', () => {
      trackTodos(makeStopInput(), 'Stop', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-todo-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.totalTodosFound).toBe(0);
    });
  });

  describe('createHandler', () => {
    it('returns undefined (never blocks)', async () => {
      const handler = createHandler('PostToolUse');
      const result = await handler(makePostToolUseInput(), makeConfig());
      expect(result).toBeUndefined();
    });
  });

  describe('patterns with regex metacharacters', () => {
    it('matches C++ pattern literally', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// C++ migration needed' }),
        'PostToolUse',
        makeConfig(['C++']),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.todosFound).toBe(1);
      expect(record.markers).toContain('C++');
    });

    it('matches TODO: pattern with colon', () => {
      trackTodos(
        makePostToolUseInput('Write', { content: '// TODO: fix this later' }),
        'PostToolUse',
        makeConfig(['TODO:']),
      );

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.todosFound).toBe(1);
      expect(record.markers).toContain('TODO:');
    });

    it('handles FIX(urgent) pattern with parentheses without throwing', () => {
      expect(() => {
        trackTodos(
          makePostToolUseInput('Write', { content: '// FIX(urgent) broken' }),
          'PostToolUse',
          makeConfig(['FIX(urgent)']),
        );
      }).not.toThrow();

      const jsonlPath = path.join(tempDir, 'test-session-todos.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.todosFound).toBe(1);
      expect(record.markers).toContain('FIX(URGENT)');
    });
  });
});
