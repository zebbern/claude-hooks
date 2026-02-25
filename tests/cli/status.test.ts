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

describe('status CLI command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-status-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('produces expected output sections', () => {
    // Create a valid config file
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);

    // Check all four sections are present
    expect(result.stdout).toContain('Configuration');
    expect(result.stdout).toContain('Features');
    expect(result.stdout).toContain('Hooks');
    expect(result.stdout).toContain('Formats');
  });

  it('shows config path and valid status when config exists', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Valid');
    expect(result.stdout).toContain('claude-hooks.config.json');
  });

  it('shows warning when no config file exists', () => {
    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Not found');
  });

  it('shows invalid status for malformed config', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, '{ broken json', 'utf-8');

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Invalid');
  });

  it('shows feature counts by category', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    // Category labels should be present
    expect(result.stdout).toContain('Security');
    expect(result.stdout).toContain('Quality');
    expect(result.stdout).toContain('Tracking');
    expect(result.stdout).toContain('Integration');
  });

  it('lists all 13 hook types', () => {
    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);

    const hookTypes = [
      'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
      'UserPromptSubmit', 'Notification', 'Stop',
      'SubagentStart', 'SubagentStop', 'PreCompact',
      'Setup', 'SessionStart', 'SessionEnd', 'PermissionRequest',
    ];
    for (const hookType of hookTypes) {
      expect(result.stdout).toContain(hookType);
    }
  });

  it('shows Claude format exists when .claude/settings.json is present', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{}', 'utf-8');

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Claude');
    expect(result.stdout).toContain('.claude/settings.json');
  });

  it('shows VS Code format exists when .github/hooks/ is present', () => {
    const hooksDir = path.join(tmpDir, '.github', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('VS Code');
    expect(result.stdout).toContain('.github/hooks/');
  });

  // --- --json flag ---
  it('--json flag produces valid JSON', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir, '--json']);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
  });

  it('--json output has expected top-level keys', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir, '--json']);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('configuration');
    expect(parsed).toHaveProperty('features');
    expect(parsed).toHaveProperty('hooks');
    expect(parsed).toHaveProperty('formats');
  });

  it('--json configuration section has correct fields', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir, '--json']);
    const parsed = JSON.parse(result.stdout);

    expect(parsed.configuration.exists).toBe(true);
    expect(parsed.configuration.valid).toBe(true);
    expect(parsed.configuration.errors).toEqual([]);
  });

  it('--json when no config exists shows exists=false', () => {
    const result = runCli(['status', '--dir', tmpDir, '--json']);
    const parsed = JSON.parse(result.stdout);

    expect(parsed.configuration.exists).toBe(false);
    expect(parsed.configuration.valid).toBeNull();
  });

  it('--json features section has category counts', () => {
    const result = runCli(['status', '--dir', tmpDir, '--json']);
    const parsed = JSON.parse(result.stdout);

    expect(parsed.features.total).toBeGreaterThan(0);
    expect(parsed.features.enabled).toBeGreaterThanOrEqual(0);
    expect(parsed.features.byCategory).toHaveProperty('security');
    expect(parsed.features.byCategory).toHaveProperty('quality');
    expect(parsed.features.byCategory).toHaveProperty('tracking');
    expect(parsed.features.byCategory).toHaveProperty('integration');
  });

  it('--json hooks section has all 13 hook types', () => {
    const result = runCli(['status', '--dir', tmpDir, '--json']);
    const parsed = JSON.parse(result.stdout);

    const hookTypes = Object.keys(parsed.hooks);
    expect(hookTypes).toHaveLength(13);
    expect(hookTypes).toContain('PreToolUse');
    expect(hookTypes).toContain('SessionEnd');
  });

  it('--verbose produces verbose stderr output', () => {
    const result = runCli(['--verbose', 'status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
    expect(result.stderr).toContain('Checking status');
  });

  it('shows enabled/total feature summary', () => {
    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    // Should show something like "X/Y enabled"
    expect(result.stdout).toMatch(/\d+\/\d+ enabled/);
  });
});
