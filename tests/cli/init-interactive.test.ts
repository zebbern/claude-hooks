import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
 */
function runCli(args: string[], opts: { cwd?: string; input?: string } = {}): { stdout: string; stderr: string; exitCode: number } {
  const cliPath = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    timeout: 15_000,
    cwd: opts.cwd ?? process.cwd(),
    input: opts.input,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

describe('init --interactive', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-init-interactive-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('non-interactive init still works as before', () => {
    const result = runCli(['init', tmpDir, '--preset', 'minimal']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('minimal');

    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);
  });

  it('non-interactive init with --format vscode works', () => {
    const result = runCli(['init', tmpDir, '--preset', 'security', '-f', 'vscode']);
    expect(result.exitCode).toBe(0);

    const hooksDir = path.join(tmpDir, '.github', 'hooks');
    expect(fs.existsSync(hooksDir)).toBe(true);
  });

  it('non-interactive init rejects invalid preset', () => {
    const result = runCli(['init', tmpDir, '--preset', 'invalid']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown preset 'invalid'");
  });

  it('non-interactive init rejects invalid format', () => {
    const result = runCli(['init', tmpDir, '--format', 'invalid']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown format 'invalid'");
  });
});
