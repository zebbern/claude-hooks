import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture output + exit code.
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

describe('config validate CLI command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-validate-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports valid for a correct config', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 'custom/logs',
      guards: { command: { enabled: true } },
    }, null, 2), 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Config is valid');
  });

  it('reports errors for invalid config and exits 1', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: { command: { enabled: 'yes' } },
    }, null, 2), 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('guards.command.enabled');
    expect(result.stderr).toContain('boolean');
  });

  it('reports warnings for unknown keys and exits 0', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      unknownKey: 'value',
    }, null, 2), 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('unknownKey');
    expect(result.stdout).toContain('Config is valid (with warnings)');
  });

  it('reports error for missing config file', () => {
    const configPath = path.join(tmpDir, 'nonexistent.json');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Config file not found');
  });

  it('reports error for invalid JSON', () => {
    const configPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(configPath, '{ broken json', 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Failed to parse config');
  });

  it('reports error for non-object JSON (array)', () => {
    const configPath = path.join(tmpDir, 'array.json');
    fs.writeFileSync(configPath, '[1, 2, 3]', 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a valid JSON object');
  });

  it('uses default config path when --config is not specified', () => {
    // Running without --config in a dir with no config file should fail
    const result = runCli(['config', 'validate'], { cwd: tmpDir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Config file not found');
  });
});
