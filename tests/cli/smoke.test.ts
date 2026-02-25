import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
 */
function runCli(
  args: string[],
  opts: { cwd?: string } = {},
): { stdout: string; stderr: string; exitCode: number } {
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

describe('CLI smoke tests', () => {
  it('--help exits 0', () => {
    const result = runCli(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });

  it('--version matches semver pattern', () => {
    const result = runCli(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('init --dry-run exits 0', () => {
    const result = runCli(['init', '--dry-run']);
    expect(result.exitCode).toBe(0);
  });

  it('list --features shows feature names', () => {
    const result = runCli(['list', '--features']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('command-guard');
    expect(result.stdout).toContain('file-guard');
    expect(result.stdout).toContain('logger');
  });

  it('config show does not crash', () => {
    const result = runCli(['config', 'show']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  it('status produces output', () => {
    const result = runCli(['status']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  it('help hooks shows hook types', () => {
    const result = runCli(['help', 'hooks']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/PreToolUse|PostToolUse|SessionStart/);
  });
});
