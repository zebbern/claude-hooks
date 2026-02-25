import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
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

describe('test --explain flag', () => {
  it('shows feature evaluation details when --explain is used', () => {
    const input = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'test.txt', content: 'hello' } });
    const result = runCli(['test', 'PreToolUse', '--explain', '--input', input]);

    // The explain output should contain feature info
    expect(result.stdout).toContain('Explain:');
    expect(result.stdout).toContain('Features evaluated:');
    expect(result.stdout).toContain('Pipeline summary:');
  });

  it('lists feature names and priorities in explain output', () => {
    const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'test.txt' } });
    const result = runCli(['test', 'PreToolUse', '--explain', '--input', input]);

    // PreToolUse should have features like command-guard, file-guard, etc.
    expect(result.stdout).toContain('priority:');
    expect(result.stdout).toContain('Hook types:');
    expect(result.stdout).toContain('Execution order:');
  });

  it('shows input data in explain output', () => {
    const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hello' } });
    const result = runCli(['test', 'PreToolUse', '--explain', '--input', input]);

    expect(result.stdout).toContain('Input:');
    expect(result.stdout).toContain('Bash');
  });

  it('shows result exit code in explain mode', () => {
    const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'safe.txt' } });
    const result = runCli(['test', 'PreToolUse', '--explain', '--input', input]);

    expect(result.stdout).toContain('Result:');
    expect(result.stdout).toContain('Exit code:');
  });

  it('works without --explain flag (no explain output)', () => {
    const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'test.txt' } });
    const result = runCli(['test', 'PreToolUse', '--input', input]);

    expect(result.stdout).not.toContain('Explain:');
    expect(result.stdout).not.toContain('Features evaluated:');
  });
});
