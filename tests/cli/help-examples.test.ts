import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI and capture output.
 */
function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const cliPath = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    timeout: 15_000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

describe('CLI help examples', () => {
  it('root --help shows Examples section', () => {
    const result = runCli(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks init');
    expect(result.stdout).toContain('claude-hooks config show');
  });

  it('init --help shows Examples section', () => {
    const result = runCli(['init', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks init --preset security');
    expect(result.stdout).toContain('claude-hooks init -f vscode');
  });

  it('list --help shows Examples section', () => {
    const result = runCli(['list', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks list --hooks');
    expect(result.stdout).toContain('claude-hooks list --features');
  });

  it('test --help shows Examples section', () => {
    const result = runCli(['test', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks test PreToolUse');
  });

  it('config --help shows Examples section', () => {
    const result = runCli(['config', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks config show');
    expect(result.stdout).toContain('claude-hooks config validate');
  });

  it('config show --help shows Examples section', () => {
    const result = runCli(['config', 'show', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks config show');
  });

  it('config validate --help shows Examples section', () => {
    const result = runCli(['config', 'validate', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks config validate');
    expect(result.stdout).toContain('--config custom.json');
  });

  it('config generate --help shows Examples section', () => {
    const result = runCli(['config', 'generate', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('--preset security');
    expect(result.stdout).toContain('--dry-run');
  });

  it('add --help shows Examples section', () => {
    const result = runCli(['add', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks add secret-leak-guard');
  });

  it('remove --help shows Examples section', () => {
    const result = runCli(['remove', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks remove logger');
  });

  it('eject --help shows Examples section', () => {
    const result = runCli(['eject', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('claude-hooks eject command-guard');
  });
});
