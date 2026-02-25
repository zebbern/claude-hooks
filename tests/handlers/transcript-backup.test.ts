import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { backupTranscript } from '../../src/handlers/transcript-backup.js';
import type { PreCompactInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-backup-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeInput(transcriptPath: string): PreCompactInput {
  return {
    session_id: 'abcdef01-2345-6789-abcd-ef0123456789',
    transcript_path: transcriptPath,
    trigger: 'auto',
  };
}

function configWithBackupDir(): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    transcriptBackupDir: path.join(tempDir, 'backups'),
  };
}

describe('transcript-backup', () => {
  it('copies file to backup directory', () => {
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{"entry": 1}\n', 'utf-8');

    const result = backupTranscript(makeInput(transcriptPath), configWithBackupDir());
    expect(result).not.toBeNull();
    expect(fs.existsSync(result!)).toBe(true);

    const backupContent = fs.readFileSync(result!, 'utf-8');
    expect(backupContent).toBe('{"entry": 1}\n');
  });

  it('generates timestamped filename with session prefix', () => {
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{}', 'utf-8');

    const result = backupTranscript(makeInput(transcriptPath), configWithBackupDir());
    expect(result).not.toBeNull();

    const filename = path.basename(result!);
    // Should contain session prefix (first 8 chars: 'abcdef01')
    expect(filename).toContain('abcdef01');
    expect(filename).toMatch(/\.jsonl$/);
  });

  it('creates backup directory if it does not exist', () => {
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{}', 'utf-8');

    const backupDir = path.join(tempDir, 'backups');
    expect(fs.existsSync(backupDir)).toBe(false);

    backupTranscript(makeInput(transcriptPath), configWithBackupDir());
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it('returns null when transcript does not exist', () => {
    const result = backupTranscript(
      makeInput('/nonexistent/transcript.jsonl'),
      configWithBackupDir(),
    );
    expect(result).toBeNull();
  });

  it('returns null when transcript_path is empty', () => {
    const result = backupTranscript(
      makeInput(''),
      configWithBackupDir(),
    );
    expect(result).toBeNull();
  });

  it('returns null on copy error', () => {
    // Use a path that exists but the backup dir is invalid
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, '{}', 'utf-8');

    const badConfig: ToolkitConfig = {
      ...DEFAULT_CONFIG,
      transcriptBackupDir: path.join(tempDir, '\0invalid'),
    };

    const result = backupTranscript(makeInput(transcriptPath), badConfig);
    expect(result).toBeNull();
  });

  it('preserves original file after backup', () => {
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptPath, 'original content', 'utf-8');

    backupTranscript(makeInput(transcriptPath), configWithBackupDir());
    expect(fs.existsSync(transcriptPath)).toBe(true);
    expect(fs.readFileSync(transcriptPath, 'utf-8')).toBe('original content');
  });
});
