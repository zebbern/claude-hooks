import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { trackToolUsage } from '../../src/features/cost-tracker/index.js';
import { createHandler } from '../../src/features/cost-tracker/handler.js';
import type { PostToolUseInput, StopInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-cost-tracker-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(enabled = true): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    costTracker: {
      outputPath: tempDir,
      enabled,
    },
  };
}

function makePostToolUseInput(toolName = 'Write'): PostToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: { file_path: '/some/file.ts' },
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

describe('cost-tracker', () => {
  describe('trackToolUsage', () => {
    it('appends JSONL record on PostToolUse', () => {
      trackToolUsage(makePostToolUseInput(), 'PostToolUse', makeConfig());

      const jsonlPath = path.join(tempDir, 'test-session.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);

      const content = fs.readFileSync(jsonlPath, 'utf-8').trim();
      const record = JSON.parse(content);
      expect(record.tool_name).toBe('Write');
      expect(record.session_id).toBe('test-session');
      expect(record.hook_type).toBe('PostToolUse');
    });

    it('record contains correct fields (timestamp, session_id, tool_name)', () => {
      trackToolUsage(makePostToolUseInput('Edit'), 'PostToolUse', makeConfig());

      const jsonlPath = path.join(tempDir, 'test-session.jsonl');
      const content = fs.readFileSync(jsonlPath, 'utf-8').trim();
      const record = JSON.parse(content);
      expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.session_id).toBe('test-session');
      expect(record.tool_name).toBe('Edit');
    });

    it('writes summary on Stop', () => {
      // First, create some tool usage records
      trackToolUsage(makePostToolUseInput('Write'), 'PostToolUse', makeConfig());
      trackToolUsage(makePostToolUseInput('Edit'), 'PostToolUse', makeConfig());
      trackToolUsage(makePostToolUseInput('Write'), 'PostToolUse', makeConfig());

      // Then trigger Stop
      trackToolUsage(makeStopInput(), 'Stop', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.session_id).toBe('test-session');
      expect(summary.totalToolCalls).toBe(3);
    });

    it('summary contains tool count and frequency map', () => {
      trackToolUsage(makePostToolUseInput('Write'), 'PostToolUse', makeConfig());
      trackToolUsage(makePostToolUseInput('Edit'), 'PostToolUse', makeConfig());
      trackToolUsage(makePostToolUseInput('Write'), 'PostToolUse', makeConfig());

      trackToolUsage(makeStopInput(), 'Stop', makeConfig());

      const summary = JSON.parse(
        fs.readFileSync(path.join(tempDir, 'test-session-summary.json'), 'utf-8'),
      );
      expect(summary.toolFrequency.Write).toBe(2);
      expect(summary.toolFrequency.Edit).toBe(1);
    });

    it('skips when disabled', () => {
      trackToolUsage(makePostToolUseInput(), 'PostToolUse', makeConfig(false));

      const jsonlPath = path.join(tempDir, 'test-session.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(false);
    });

    it('creates output directory if needed', () => {
      const nestedDir = path.join(tempDir, 'nested', 'reports');
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        costTracker: { outputPath: nestedDir, enabled: true },
      };

      trackToolUsage(makePostToolUseInput(), 'PostToolUse', config);
      expect(fs.existsSync(path.join(nestedDir, 'test-session.jsonl'))).toBe(true);
    });

    it('handles missing JSONL gracefully on Stop (no records)', () => {
      trackToolUsage(makeStopInput(), 'Stop', makeConfig());

      const summaryPath = path.join(tempDir, 'test-session-summary.json');
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.totalToolCalls).toBe(0);
      expect(summary.toolFrequency).toEqual({});
    });

    it('never throws on write errors', () => {
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        costTracker: { outputPath: path.join(tempDir, '\0invalid'), enabled: true },
      };
      expect(() => trackToolUsage(makePostToolUseInput(), 'PostToolUse', config)).not.toThrow();
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
