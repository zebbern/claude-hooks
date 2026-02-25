import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
 * Uses spawnSync so output is captured synchronously.
 */
function runCli(
  args: string[],
  opts: { cwd?: string; input?: string } = {},
): { stdout: string; stderr: string; exitCode: number } {
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

// ─── --version ──────────────────────────────────────────────────────────────────

describe('claude-hooks --version', () => {
  it('outputs version string', () => {
    const result = runCli(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('version matches package.json', () => {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string };
    const result = runCli(['--version']);
    expect(result.stdout.trim()).toBe(pkg.version);
  });
});

// ─── --help ─────────────────────────────────────────────────────────────────────

describe('claude-hooks --help', () => {
  it('shows usage info with exit code 0', () => {
    const result = runCli(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('claude-hooks');
  });

  it('lists available commands', () => {
    const result = runCli(['--help']);
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('list');
    expect(result.stdout).toContain('test');
    expect(result.stdout).toContain('config');
    expect(result.stdout).toContain('status');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).toContain('eject');
  });

  it('shows --verbose option', () => {
    const result = runCli(['--help']);
    expect(result.stdout).toContain('--verbose');
  });
});

// ─── list ───────────────────────────────────────────────────────────────────────

describe('claude-hooks list', () => {
  describe('--hooks', () => {
    it('lists all 13 hook types', () => {
      const result = runCli(['list', '--hooks']);
      expect(result.exitCode).toBe(0);

      const expectedHooks = [
        'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
        'UserPromptSubmit', 'Notification', 'Stop',
        'SubagentStart', 'SubagentStop', 'PreCompact',
        'Setup', 'SessionStart', 'SessionEnd', 'PermissionRequest',
      ];
      for (const hook of expectedHooks) {
        expect(result.stdout).toContain(hook);
      }
    });

    it('contains all expected hook type names', () => {
      const result = runCli(['list', '--hooks']);
      expect(result.exitCode).toBe(0);
      // Verify all 13 hook types appear somewhere in the output
      const output = result.stdout;
      const allPresent = [
        'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
        'UserPromptSubmit', 'Notification', 'Stop',
        'SubagentStart', 'SubagentStop', 'PreCompact',
        'Setup', 'SessionStart', 'SessionEnd', 'PermissionRequest',
      ].every((hook) => output.includes(hook));
      expect(allPresent).toBe(true);
    });
  });

  describe('--features', () => {
    it('lists features grouped by category', () => {
      const result = runCli(['list', '--features']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Features:');
    });

    it('includes known feature names', () => {
      const result = runCli(['list', '--features']);
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('file-guard');
      expect(result.stdout).toContain('logger');
    });

    it('includes category labels', () => {
      const result = runCli(['list', '--features']);
      // Features should be grouped by category
      expect(result.stdout).toMatch(/security|quality|tracking|integration/i);
    });
  });

  describe('--presets', () => {
    it('lists available presets', () => {
      const result = runCli(['list', '--presets']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Presets:');
    });
  });

  describe('no flags (default)', () => {
    it('shows hooks, guards, validators, and presets', () => {
      const result = runCli(['list']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hook Types:');
      expect(result.stdout).toContain('Guards:');
      expect(result.stdout).toContain('Validators:');
      expect(result.stdout).toContain('Presets:');
    });
  });

  describe('with --verbose', () => {
    it('verbose flag on list --features produces stderr output', () => {
      const result = runCli(['--verbose', 'list', '--features']);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('[verbose]');
    });
  });
});

// ─── config ─────────────────────────────────────────────────────────────────────

describe('claude-hooks config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('show', () => {
    it('shows configuration with default values when no config file', () => {
      const result = runCli(['config', 'show'], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      // Should output some config JSON/text
      expect(result.stdout.length).toBeGreaterThan(10);
    });

    it('shows configuration when config file exists', () => {
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ logDir: 'custom-logs' }, null, 2), 'utf-8');

      const result = runCli(['config', 'show'], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('logDir');
    });

    it('with --verbose produces stderr output', () => {
      const result = runCli(['--verbose', 'config', 'show'], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('[verbose]');
      expect(result.stderr).toContain('Loading configuration');
    });
  });

  describe('validate', () => {
    it('validates valid config successfully', () => {
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

      const result = runCli(['config', 'validate', '--config', configPath]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('valid');
    });

    it('fails on invalid config', () => {
      const configPath = path.join(tmpDir, 'invalid.json');
      fs.writeFileSync(configPath, '{ broken json content', 'utf-8');

      const result = runCli(['config', 'validate', '--config', configPath]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('parse');
    });

    it('fails when config file does not exist', () => {
      const configPath = path.join(tmpDir, 'nonexistent.json');
      const result = runCli(['config', 'validate', '--config', configPath]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    it('with --verbose produces stderr verbose output', () => {
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

      const result = runCli(['--verbose', 'config', 'validate', '--config', configPath]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('[verbose]');
      expect(result.stderr).toContain('Validating config file');
    });
  });

  describe('generate', () => {
    it('generates settings with security preset in dry-run', () => {
      const result = runCli(['config', 'generate', '--preset', 'security', '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(10);
    });

    it('generates settings with full preset in dry-run', () => {
      const result = runCli(['config', 'generate', '--preset', 'full', '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(10);
    });

    it('generates vscode format in dry-run', () => {
      const result = runCli(['config', 'generate', '--preset', 'security', '-f', 'vscode', '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('.github/hooks/');
    });

    it('rejects invalid preset', () => {
      const result = runCli(['config', 'generate', '--preset', 'invalid-preset', '--dry-run']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown preset');
    });

    it('with --verbose produces stderr verbose output', () => {
      const result = runCli(['--verbose', 'config', 'generate', '--preset', 'security', '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('[verbose]');
      expect(result.stderr).toContain('Generating config');
    });
  });
});

// ─── init ───────────────────────────────────────────────────────────────────────

describe('claude-hooks init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('--dry-run', () => {
    it('shows what would be created without writing files', () => {
      const result = runCli(['init', tmpDir, '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('Would create');
      expect(result.stdout).toContain('No files were written');
    });

    it('does not create any files', () => {
      runCli(['init', tmpDir, '--dry-run']);
      const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      expect(fs.existsSync(settingsPath)).toBe(false);
      expect(fs.existsSync(configPath)).toBe(false);
    });

    it('shows preview for each preset', () => {
      for (const preset of ['minimal', 'security', 'quality', 'full']) {
        const result = runCli(['init', tmpDir, '--dry-run', '--preset', preset]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('[dry-run]');
      }
    });

    it('shows vscode format preview', () => {
      const result = runCli(['init', tmpDir, '--dry-run', '-f', 'vscode']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('.github');
    });

    it('shows both format preview', () => {
      const result = runCli(['init', tmpDir, '--dry-run', '-f', 'both']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('settings.json');
      expect(result.stdout).toContain('.github');
    });
  });

  describe('actual init', () => {
    it('creates settings and config files', () => {
      const result = runCli(['init', tmpDir]);
      expect(result.exitCode).toBe(0);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      expect(fs.existsSync(settingsPath)).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('created settings.json is valid JSON', () => {
      runCli(['init', tmpDir]);
      const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
      const content = fs.readFileSync(settingsPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('rejects invalid preset', () => {
      const result = runCli(['init', tmpDir, '--preset', 'nonexistent']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown preset');
    });

    it('rejects invalid format', () => {
      const result = runCli(['init', tmpDir, '-f', 'xml']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown format');
    });
  });

  describe('with --verbose', () => {
    it('produces verbose stderr output on dry-run', () => {
      const result = runCli(['--verbose', 'init', tmpDir, '--dry-run']);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('[verbose]');
      expect(result.stderr).toContain('Initializing project');
    });
  });
});

// ─── test ───────────────────────────────────────────────────────────────────────

describe('claude-hooks test', () => {
  it('runs a PreToolUse hook with inline JSON', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'test.txt', content: 'hello' },
    });
    const result = runCli(['test', 'PreToolUse', '--input', input]);
    // Should complete (exit 0 or 2 depending on guards)
    expect([0, 2]).toContain(result.exitCode);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  it('runs a PostToolUse hook', () => {
    const input = JSON.stringify({
      tool_name: 'Read',
      tool_input: { file_path: 'test.txt' },
    });
    const result = runCli(['test', 'PostToolUse', '--input', input]);
    expect([0, 2]).toContain(result.exitCode);
  });

  it('runs a SessionStart hook', () => {
    const input = JSON.stringify({ session_id: 'integration-test-session' });
    const result = runCli(['test', 'SessionStart', '--input', input]);
    expect(result.exitCode).toBe(0);
  });

  it('runs a SessionEnd hook', () => {
    const input = JSON.stringify({ session_id: 'integration-test-session' });
    const result = runCli(['test', 'SessionEnd', '--input', input]);
    expect(result.exitCode).toBe(0);
  });

  it('shows error for invalid hook type', () => {
    const result = runCli(['test', 'InvalidHook', '--input', '{}']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown hook type');
    expect(result.stderr).toContain('PreToolUse');
  });

  it('shows error for invalid JSON input', () => {
    const result = runCli(['test', 'PreToolUse', '--input', 'not-valid-json']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid JSON');
  });

  it('supports --input-file flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-test-'));
    try {
      const inputPath = path.join(tmpDir, 'input.json');
      fs.writeFileSync(inputPath, JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: 'readme.md' },
      }), 'utf-8');

      const result = runCli(['test', 'PreToolUse', '--input-file', inputPath]);
      expect([0, 2]).toContain(result.exitCode);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports --format json flag', () => {
    const input = JSON.stringify({
      tool_name: 'Read',
      tool_input: { file_path: 'test.txt' },
    });
    const result = runCli(['test', 'PreToolUse', '--format', 'json', '--input', input]);
    expect([0, 2]).toContain(result.exitCode);
  });

  it('supports --explain flag', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'test.txt', content: 'data' },
    });
    const result = runCli(['test', 'PreToolUse', '--explain', '--input', input]);
    expect(result.stdout).toContain('Explain:');
    expect(result.stdout).toContain('Features evaluated:');
    expect(result.stdout).toContain('Pipeline summary:');
  });

  describe('with --verbose', () => {
    it('produces verbose stderr output', () => {
      const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'test.txt' } });
      const result = runCli(['--verbose', 'test', 'PreToolUse', '--input', input]);
      expect(result.stderr).toContain('[verbose]');
      expect(result.stderr).toContain('Testing hook type');
    });
  });
});

// ─── status ─────────────────────────────────────────────────────────────────────

describe('claude-hooks status', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-status-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows status report with all sections', () => {
    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Configuration');
    expect(result.stdout).toContain('Features');
    expect(result.stdout).toContain('Hooks');
    expect(result.stdout).toContain('Formats');
  });

  it('shows "Not found" when no config exists', () => {
    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Not found');
  });

  it('shows "Valid" when config exists and is valid', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'logs' }, null, 2), 'utf-8');

    const result = runCli(['status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Valid');
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

  describe('--json', () => {
    it('outputs valid JSON', () => {
      const result = runCli(['status', '--dir', tmpDir, '--json']);
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('has expected top-level keys', () => {
      const result = runCli(['status', '--dir', tmpDir, '--json']);
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(parsed).toHaveProperty('configuration');
      expect(parsed).toHaveProperty('features');
      expect(parsed).toHaveProperty('hooks');
      expect(parsed).toHaveProperty('formats');
    });

    it('features section has total and enabled counts', () => {
      const result = runCli(['status', '--dir', tmpDir, '--json']);
      const parsed = JSON.parse(result.stdout) as {
        features: { total: number; enabled: number; byCategory: Record<string, unknown> };
      };
      expect(parsed.features.total).toBeGreaterThan(0);
      expect(typeof parsed.features.enabled).toBe('number');
      expect(parsed.features.byCategory).toHaveProperty('security');
    });

    it('hooks section has 13 entries', () => {
      const result = runCli(['status', '--dir', tmpDir, '--json']);
      const parsed = JSON.parse(result.stdout) as { hooks: Record<string, unknown> };
      expect(Object.keys(parsed.hooks)).toHaveLength(13);
    });
  });

  describe('with --verbose', () => {
    it('produces verbose stderr output', () => {
      const result = runCli(['--verbose', 'status', '--dir', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('[verbose]');
      expect(result.stderr).toContain('Checking status');
    });
  });
});

// ─── add ────────────────────────────────────────────────────────────────────────

describe('claude-hooks add', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-add-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('--dry-run', () => {
    it('shows what would change for a known feature', () => {
      const result = runCli(['add', 'command-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('enabled = true');
    });

    it('shows what would change for secret-leak-guard', () => {
      const result = runCli(['add', 'secret-leak-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('secret-leak-guard');
    });

    it('does not modify config file', () => {
      const configPath = path.join(tmpDir, 'claude-hooks.config.json');
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

      runCli(['add', 'command-guard', '--dry-run', '-d', tmpDir]);

      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content).toEqual({});
    });

    it('supports multiple feature names', () => {
      const result = runCli(['add', 'command-guard', 'file-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('file-guard');
    });
  });

  it('fails on unknown feature name', () => {
    const result = runCli(['add', 'nonexistent-feature', '-d', tmpDir]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown feature');
  });

  it('suggests similar feature name on typo', () => {
    const result = runCli(['add', 'comand-guard', '-d', tmpDir]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Did you mean');
    expect(result.stderr).toContain('command-guard');
  });
});

// ─── remove ─────────────────────────────────────────────────────────────────────

describe('claude-hooks remove', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-remove-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('--dry-run', () => {
    it('shows what would change for a known feature', () => {
      const result = runCli(['remove', 'command-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('enabled = false');
    });

    it('shows what would change for file-guard', () => {
      const result = runCli(['remove', 'file-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[dry-run]');
      expect(result.stdout).toContain('file-guard');
    });

    it('supports multiple feature names', () => {
      const result = runCli(['remove', 'command-guard', 'file-guard', '--dry-run', '-d', tmpDir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('command-guard');
      expect(result.stdout).toContain('file-guard');
    });
  });

  it('fails on unknown feature name', () => {
    const result = runCli(['remove', 'nonexistent-feature', '-d', tmpDir]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown feature');
  });
});

// ─── eject ──────────────────────────────────────────────────────────────────────

describe('claude-hooks eject', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-eject-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('--dry-run', () => {
    it('shows what files would be copied', () => {
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

  it('fails on unknown feature name', () => {
    const result = runCli(['eject', 'nonexistent-feature', '-d', tmpDir]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown feature');
  });
});

// ─── invalid command ────────────────────────────────────────────────────────────

describe('invalid command', () => {
  it('shows help/error for unknown command', () => {
    const result = runCli(['nonexistent-command']);
    // Commander exits with non-zero on unknown commands
    expect(result.exitCode).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
  });

  it('shows error for missing required argument on add', () => {
    const result = runCli(['add']);
    expect(result.exitCode).not.toBe(0);
  });

  it('shows error for missing required argument on test', () => {
    const result = runCli(['test']);
    expect(result.exitCode).not.toBe(0);
  });
});

// ─── global --verbose across commands ───────────────────────────────────────────

describe('global --verbose across commands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-integ-verbose-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('list --features with --verbose produces stderr output', () => {
    const result = runCli(['--verbose', 'list', '--features']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('config show with --verbose produces stderr output', () => {
    const result = runCli(['--verbose', 'config', 'show'], { cwd: tmpDir });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('config validate with --verbose produces stderr output', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

    const result = runCli(['--verbose', 'config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('config generate with --verbose produces stderr output', () => {
    const result = runCli(['--verbose', 'config', 'generate', '--dry-run']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('init with --verbose produces stderr output', () => {
    const result = runCli(['--verbose', 'init', tmpDir, '--dry-run']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('test with --verbose produces stderr output', () => {
    const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'test.txt' } });
    const result = runCli(['--verbose', 'test', 'PreToolUse', '--input', input]);
    expect(result.stderr).toContain('[verbose]');
  });

  it('status with --verbose produces stderr output', () => {
    const result = runCli(['--verbose', 'status', '--dir', tmpDir]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[verbose]');
  });

  it('verbose output goes to stderr, never stdout', () => {
    const configPath = path.join(tmpDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf-8');

    const result = runCli(['--verbose', 'config', 'validate', '--config', configPath]);
    expect(result.stderr).toContain('[verbose]');
    expect(result.stdout).not.toContain('[verbose]');
  });
});
