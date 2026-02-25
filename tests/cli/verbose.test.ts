import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
 * Uses spawnSync so stderr is captured even on exit code 0.
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

describe('--verbose global flag', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-verbose-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('config validate with --verbose produces verbose stderr output', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['--verbose', 'config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
    expect(result.stderr).toContain('Validating config file');
    expect(result.stderr).toContain('Running validation rules');
  });

  it('config validate without --verbose has no verbose output', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain('[verbose]');
  });

  it('verbose output goes to stderr, not stdout', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['--verbose', 'config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    // Verbose output is on stderr
    expect(result.stderr).toContain('[verbose]');
    // stdout should not contain verbose markers
    expect(result.stdout).not.toContain('[verbose]');
  });

  it('-v shorthand works the same as --verbose', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['-v', 'config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('config show with --verbose produces verbose stderr output', () => {
    // Create a config so loadConfig won't emit its own warnings
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

    const result = runCli(['--verbose', 'config', 'show'], { cwd: tmpDir });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
    expect(result.stderr).toContain('Loading configuration');
  });
});
