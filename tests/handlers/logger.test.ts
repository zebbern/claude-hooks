import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { logHookEvent } from '../../src/handlers/logger.js';
import type { ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-logger-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function configWithLogDir(): ToolkitConfig {
  return { ...DEFAULT_CONFIG, logDir: tempDir };
}

describe('logger', () => {
  it('creates log directory structure', () => {
    logHookEvent('PreToolUse', { session_id: 'test-session' }, configWithLogDir());
    const hookDir = path.join(tempDir, 'PreToolUse');
    expect(fs.existsSync(hookDir)).toBe(true);
  });

  it('appends JSONL entry to file', () => {
    logHookEvent('PreToolUse', { session_id: 'test-session', foo: 'bar' }, configWithLogDir());
    const hookDir = path.join(tempDir, 'PreToolUse');
    const files = fs.readdirSync(hookDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);

    const content = fs.readFileSync(path.join(hookDir, files[0]!), 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.hookType).toBe('PreToolUse');
    expect(entry.sessionId).toBe('test-session');
    expect(entry.data.foo).toBe('bar');
  });

  it('uses correct date-based filename', () => {
    logHookEvent('Stop', { session_id: 'sess1' }, configWithLogDir());
    const hookDir = path.join(tempDir, 'Stop');
    const files = fs.readdirSync(hookDir);
    const today = new Date().toISOString().slice(0, 10);
    expect(files[0]).toBe(`${today}.jsonl`);
  });

  it('uses "unknown" for missing session_id', () => {
    logHookEvent('Notification', {}, configWithLogDir());
    const hookDir = path.join(tempDir, 'Notification');
    const files = fs.readdirSync(hookDir);
    const content = fs.readFileSync(path.join(hookDir, files[0]!), 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.sessionId).toBe('unknown');
  });

  it('appends multiple entries to same file', () => {
    const config = configWithLogDir();
    logHookEvent('Setup', { session_id: 's1' }, config);
    logHookEvent('Setup', { session_id: 's2' }, config);

    const hookDir = path.join(tempDir, 'Setup');
    const files = fs.readdirSync(hookDir);
    const content = fs.readFileSync(path.join(hookDir, files[0]!), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);
  });

  it('never throws on error', () => {
    // Pass an invalid logDir that cannot be created
    const badConfig: ToolkitConfig = {
      ...DEFAULT_CONFIG,
      logDir: path.join(tempDir, '\0invalid'), // null byte = invalid path
    };
    expect(() => logHookEvent('PreToolUse', { session_id: 'test' }, badConfig)).not.toThrow();
  });

  it('includes timestamp in entry', () => {
    logHookEvent('PreToolUse', { session_id: 'ts-test' }, configWithLogDir());
    const hookDir = path.join(tempDir, 'PreToolUse');
    const files = fs.readdirSync(hookDir);
    const content = fs.readFileSync(path.join(hookDir, files[0]!), 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
