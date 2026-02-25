import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { logPrompt } from '../../src/handlers/prompt-history.js';
import type { UserPromptSubmitInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-prompt-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function configWithLogDir(): ToolkitConfig {
  return { ...DEFAULT_CONFIG, logDir: tempDir };
}

describe('prompt-history', () => {
  it('writes prompt entry to session-specific file', () => {
    const input: UserPromptSubmitInput = {
      session_id: 'sess-prompt-1',
      prompt: 'Fix the authentication module',
    };
    logPrompt(input, configWithLogDir());

    const filePath = path.join(tempDir, 'prompts', 'sess-prompt-1.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.prompt).toBe('Fix the authentication module');
    expect(entry.timestamp).toBeDefined();
  });

  it('creates prompts directory', () => {
    const input: UserPromptSubmitInput = {
      session_id: 'sess-dir-test',
      prompt: 'Test prompt',
    };
    logPrompt(input, configWithLogDir());

    expect(fs.existsSync(path.join(tempDir, 'prompts'))).toBe(true);
  });

  it('uses session_id in filename', () => {
    const input: UserPromptSubmitInput = {
      session_id: 'unique-session-id',
      prompt: 'Another prompt',
    };
    logPrompt(input, configWithLogDir());

    const filePath = path.join(tempDir, 'prompts', 'unique-session-id.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('appends multiple prompts to same session file', () => {
    const config = configWithLogDir();
    const input1: UserPromptSubmitInput = { session_id: 'multi', prompt: 'First' };
    const input2: UserPromptSubmitInput = { session_id: 'multi', prompt: 'Second' };

    logPrompt(input1, config);
    logPrompt(input2, config);

    const content = fs.readFileSync(path.join(tempDir, 'prompts', 'multi.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);
  });

  it('never throws on error', () => {
    const badConfig: ToolkitConfig = {
      ...DEFAULT_CONFIG,
      logDir: path.join(tempDir, '\0invalid'),
    };
    const input: UserPromptSubmitInput = { session_id: 'test', prompt: 'crash test' };
    expect(() => logPrompt(input, badConfig)).not.toThrow();
  });

  it('skips logging when promptHistory.enabled is false', () => {
    const config: ToolkitConfig = {
      ...DEFAULT_CONFIG,
      logDir: tempDir,
      promptHistory: { enabled: false },
    };
    const input: UserPromptSubmitInput = { session_id: 'disabled-test', prompt: 'should not log' };
    logPrompt(input, config);

    const filePath = path.join(tempDir, 'prompts', 'disabled-test.jsonl');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
