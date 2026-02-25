import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
 */
function runCli(args: string[], opts: { cwd?: string } = {}): { stdout: string; stderr: string; exitCode: number } {
  const cliPath = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    timeout: 15_000,
    cwd: opts.cwd ?? process.cwd(),
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

describe('--dry-run flag on destructive commands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-dryrun-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('init --dry-run', () => {
    it('shows what files would be created without writing them', () => {
      const result = runCli(['init', tmpDir, '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('Would create');
      expect(result.stdout).toContain('settings.json');
      expect(result.stdout).toContain('No files were written');
    });

    it('does not create any files', () => {
      runCli(['init', tmpDir, '--dry-run']);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      expect(fs.existsSync(settingsPath)).toBe(false);
      expect(fs.existsSync(configPath)).toBe(false);
    });

    it('shows toolkit config path in preview', () => {
      const result = runCli(['init', tmpDir, '--dry-run', '--preset', 'full']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('claude-hooks.config.json');
    });

    it('shows vscode files when format is vscode', () => {
      const result = runCli(['init', tmpDir, '--dry-run', '-f', 'vscode']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('.github');
    });
  });

  describe('add --dry-run', () => {
    it('shows what config changes would be made without writing', () => {
      const result = runCli(['add', 'secret-leak-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('secret-leak-guard');
      expect(result.stdout).toContain('enabled = true');
    });

    it('does not modify config file', () => {
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

      runCli(['add', 'secret-leak-guard', '--dry-run', '-d', tmpDir]);

      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // Config should not have been modified
      expect(content).toEqual({});
    });
  });

  describe('remove --dry-run', () => {
    it('shows what config changes would be made without writing', () => {
      const result = runCli(['remove', 'command-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('enabled = false');
    });
  });

  describe('eject --dry-run', () => {
    it('shows what files would be copied without copying', () => {
      const result = runCli(['eject', 'command-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('handler.js');
      expect(result.stdout).toContain('No files were written');
    });

    it('does not create ejected directory', () => {
      runCli(['eject', 'command-guard', '--dry-run', '-d', tmpDir]);

      const ejectedDir = path.join(tmpDir, '.claude', 'hooks', 'command-guard');
      expect(fs.existsSync(ejectedDir)).toBe(false);
    });
  });
});
