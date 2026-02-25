import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { backupFile } from '../../src/features/file-backup/index.js';
import { createHandler } from '../../src/features/file-backup/handler.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;
let sourceDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-file-backup-test-'));
  sourceDir = path.join(tempDir, 'source');
  fs.mkdirSync(sourceDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(enabled = true): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    fileBackup: {
      backupDir: path.join(tempDir, 'backups'),
      enabled,
    },
  };
}

function makeInput(toolName: string, filePath: string): PreToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: { file_path: filePath },
  };
}

describe('file-backup', () => {
  describe('backupFile', () => {
    it('skips non-Write/Edit/MultiEdit tools', () => {
      const filePath = path.join(sourceDir, 'test.txt');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      backupFile(makeInput('Bash', filePath), makeConfig());

      const backupDir = path.join(tempDir, 'backups', 'test-session');
      expect(fs.existsSync(backupDir)).toBe(false);
    });

    it('skips when disabled', () => {
      const filePath = path.join(sourceDir, 'test.txt');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      backupFile(makeInput('Write', filePath), makeConfig(false));

      const backupDir = path.join(tempDir, 'backups', 'test-session');
      expect(fs.existsSync(backupDir)).toBe(false);
    });

    it('skips when file does not exist', () => {
      const filePath = path.join(sourceDir, 'nonexistent.txt');
      backupFile(makeInput('Write', filePath), makeConfig());

      const backupDir = path.join(tempDir, 'backups', 'test-session');
      expect(fs.existsSync(backupDir)).toBe(false);
    });

    it('creates backup with correct filename pattern', () => {
      const filePath = path.join(sourceDir, 'important.ts');
      fs.writeFileSync(filePath, 'original content', 'utf-8');

      backupFile(makeInput('Write', filePath), makeConfig());

      const sessionDir = path.join(tempDir, 'backups', 'test-session');
      expect(fs.existsSync(sessionDir)).toBe(true);

      const files = fs.readdirSync(sessionDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\d+_important\.ts$/);
    });

    it('backup content matches original file', () => {
      const filePath = path.join(sourceDir, 'data.txt');
      const originalContent = 'Hello, world!\nLine 2\nLine 3';
      fs.writeFileSync(filePath, originalContent, 'utf-8');

      backupFile(makeInput('Edit', filePath), makeConfig());

      const sessionDir = path.join(tempDir, 'backups', 'test-session');
      const files = fs.readdirSync(sessionDir);
      const backupContent = fs.readFileSync(path.join(sessionDir, files[0]!), 'utf-8');
      expect(backupContent).toBe(originalContent);
    });

    it('creates session directory', () => {
      const filePath = path.join(sourceDir, 'file.txt');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      const input: PreToolUseInput = {
        session_id: 'unique-session-id',
        tool_name: 'MultiEdit',
        tool_input: { file_path: filePath },
      };
      backupFile(input, makeConfig());

      const sessionDir = path.join(tempDir, 'backups', 'unique-session-id');
      expect(fs.existsSync(sessionDir)).toBe(true);
    });

    it('handles missing file_path gracefully', () => {
      const input: PreToolUseInput = {
        session_id: 'test-session',
        tool_name: 'Write',
        tool_input: {},
      };
      expect(() => backupFile(input, makeConfig())).not.toThrow();
    });

    it('never throws on error (e.g., invalid backup dir)', () => {
      const filePath = path.join(sourceDir, 'test.txt');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        fileBackup: {
          backupDir: path.join(tempDir, '\0invalid-dir'),
          enabled: true,
        },
      };
      expect(() => backupFile(makeInput('Write', filePath), config)).not.toThrow();
    });
  });

  describe('createHandler', () => {
    it('returns undefined (never blocks)', async () => {
      const handler = createHandler('PreToolUse');
      const filePath = path.join(sourceDir, 'handler-test.txt');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      const result = await handler(makeInput('Write', filePath), makeConfig());
      expect(result).toBeUndefined();
    });
  });
});
