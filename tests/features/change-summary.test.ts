import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { recordChange, generateChangeSummary } from '../../src/features/change-summary/index.js';
import { createHandler } from '../../src/features/change-summary/handler.js';
import type { PostToolUseInput, StopInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-change-summary-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(enabled = true): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    changeSummary: { outputPath: tempDir, enabled },
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

describe('change-summary', () => {
  describe('recordChange', () => {
    it('skips when disabled', () => {
      recordChange(makePostToolUseInput(), 'PostToolUse', makeConfig(false));
      const jsonlPath = path.join(tempDir, 'test-session-changes.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
    });

    it('records Write tool changes to JSONL', () => {
      recordChange(
        makePostToolUseInput('Write', { content: 'line1\nline2\nline3' }),
        'PostToolUse',
        makeConfig(),
      );

      const jsonlPath = path.join(tempDir, 'test-session-changes.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);

      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.tool_name).toBe('Write');
      expect(record.change_type).toBe('create');
      expect(record.lines_added).toBe(3);
    });

    it('records Edit tool changes to JSONL', () => {
      recordChange(
        makePostToolUseInput('Edit', { new_string: 'new line 1\nnew line 2' }),
        'PostToolUse',
        makeConfig(),
      );

      const jsonlPath = path.join(tempDir, 'test-session-changes.jsonl');
      const record = JSON.parse(fs.readFileSync(jsonlPath, 'utf-8').trim());
      expect(record.tool_name).toBe('Edit');
      expect(record.change_type).toBe('modify');
      expect(record.lines_added).toBe(2);
    });

    it('skips non-write tools', () => {
      recordChange(makePostToolUseInput('Read'), 'PostToolUse', makeConfig());
      const jsonlPath = path.join(tempDir, 'test-session-changes.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
    });
  });

  describe('generateChangeSummary / Stop', () => {
    it('generates summary on Stop with correct file list', () => {
      recordChange(
        makePostToolUseInput('Write', { file_path: 'src/app.ts', content: 'code' }),
        'PostToolUse',
        makeConfig(),
      );
      recordChange(
        makePostToolUseInput('Edit', { file_path: 'src/utils.ts', new_string: 'updated' }),
        'PostToolUse',
        makeConfig(),
      );

      recordChange(makeStopInput(), 'Stop', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-change-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.totalChanges).toBe(2);
      expect(summary.filesModified).toContain('src/app.ts');
      expect(summary.filesModified).toContain('src/utils.ts');
    });

    it('handles empty session (no changes)', () => {
      recordChange(makeStopInput(), 'Stop', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-change-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.totalChanges).toBe(0);
      expect(summary.filesModified).toEqual([]);
    });

    it('summary contains human-readable lines', () => {
      recordChange(
        makePostToolUseInput('Write', { file_path: 'README.md', content: 'hello' }),
        'PostToolUse',
        makeConfig(),
      );
      recordChange(
        makePostToolUseInput('Edit', { file_path: 'src/app.ts', new_string: 'fix' }),
        'PostToolUse',
        makeConfig(),
      );
      recordChange(
        makePostToolUseInput('Edit', { file_path: 'src/app.ts', new_string: 'fix2' }),
        'PostToolUse',
        makeConfig(),
      );

      recordChange(makeStopInput(), 'Stop', makeConfig());

      const summary = JSON.parse(
        fs.readFileSync(path.join(tempDir, 'test-session-change-summary.json'), 'utf-8'),
      );
      expect(summary.summary).toContainEqual(expect.stringContaining('Created README.md'));
      expect(summary.summary).toContainEqual(expect.stringContaining('Modified src/app.ts'));
      expect(summary.summary).toContainEqual(expect.stringContaining('2 edits'));
    });

    it('generateChangeSummary convenience function works', () => {
      recordChange(
        makePostToolUseInput('Write', { file_path: 'file.ts', content: 'code' }),
        'PostToolUse',
        makeConfig(),
      );

      generateChangeSummary('test-session', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-change-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);
    });
  });

  describe('createHandler', () => {
    it('returns undefined (never blocks)', async () => {
      const handler = createHandler('PostToolUse');
      const result = await handler(makePostToolUseInput(), makeConfig());
      expect(result).toBeUndefined();
    });
  });
});
