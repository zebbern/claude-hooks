import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { trackSessionStart, trackSessionEnd } from '../../src/handlers/session-tracker.js';
import type { SessionStartInput, SessionEndInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-session-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function configWithLogDir(): ToolkitConfig {
  return { ...DEFAULT_CONFIG, logDir: tempDir };
}

describe('session-tracker', () => {
  describe('trackSessionStart', () => {
    it('writes start entry to sessions.jsonl', () => {
      const input: SessionStartInput = { session_id: 'sess-123', source: 'startup' };
      trackSessionStart(input, configWithLogDir());

      const filePath = path.join(tempDir, 'sessions.jsonl');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(content.trim());
      expect(entry.event).toBe('start');
      expect(entry.session_id).toBe('sess-123');
      expect(entry.source).toBe('startup');
    });

    it('creates directory if missing', () => {
      const nestedDir = path.join(tempDir, 'nested', 'logs');
      const config: ToolkitConfig = { ...DEFAULT_CONFIG, logDir: nestedDir };
      const input: SessionStartInput = { session_id: 'sess-456', source: 'resume' };

      trackSessionStart(input, config);
      expect(fs.existsSync(path.join(nestedDir, 'sessions.jsonl'))).toBe(true);
    });

    it('includes timestamp', () => {
      const input: SessionStartInput = { session_id: 'sess-ts', source: 'startup' };
      trackSessionStart(input, configWithLogDir());

      const content = fs.readFileSync(path.join(tempDir, 'sessions.jsonl'), 'utf-8');
      const entry = JSON.parse(content.trim());
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('trackSessionEnd', () => {
    it('writes end entry to sessions.jsonl', () => {
      const input: SessionEndInput = { session_id: 'sess-789' };
      trackSessionEnd(input, configWithLogDir());

      const filePath = path.join(tempDir, 'sessions.jsonl');
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(content.trim());
      expect(entry.event).toBe('end');
      expect(entry.session_id).toBe('sess-789');
    });

    it('appends to existing file', () => {
      const config = configWithLogDir();
      const startInput: SessionStartInput = { session_id: 'sess-abc', source: 'startup' };
      const endInput: SessionEndInput = { session_id: 'sess-abc' };

      trackSessionStart(startInput, config);
      trackSessionEnd(endInput, config);

      const content = fs.readFileSync(path.join(tempDir, 'sessions.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(2);

      const start = JSON.parse(lines[0]!);
      const end = JSON.parse(lines[1]!);
      expect(start.event).toBe('start');
      expect(end.event).toBe('end');
    });
  });

  describe('error handling', () => {
    it('never throws on error', () => {
      const badConfig: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        logDir: path.join(tempDir, '\0invalid'),
      };
      const input: SessionStartInput = { session_id: 'test', source: 'startup' };
      expect(() => trackSessionStart(input, badConfig)).not.toThrow();
    });
  });
});
