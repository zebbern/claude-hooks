import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadConfig, DEFAULT_CONFIG } from '../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-config-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('DEFAULT_CONFIG', () => {
  it('has correct structure', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('logDir');
    expect(DEFAULT_CONFIG).toHaveProperty('transcriptBackupDir');
    expect(DEFAULT_CONFIG).toHaveProperty('guards');
    expect(DEFAULT_CONFIG).toHaveProperty('validators');
    expect(DEFAULT_CONFIG).toHaveProperty('permissions');
  });

  it('has guards enabled by default', () => {
    expect(DEFAULT_CONFIG.guards.command.enabled).toBe(true);
    expect(DEFAULT_CONFIG.guards.file.enabled).toBe(true);
    expect(DEFAULT_CONFIG.guards.path.enabled).toBe(true);
    expect(DEFAULT_CONFIG.guards.secretLeak.enabled).toBe(true);
  });

  it('has validators disabled by default', () => {
    expect(DEFAULT_CONFIG.validators.lint.enabled).toBe(false);
    expect(DEFAULT_CONFIG.validators.typecheck.enabled).toBe(false);
  });

  it('has Read, Glob, Grep in autoAllow', () => {
    expect(DEFAULT_CONFIG.permissions.autoAllow).toContain('Read');
    expect(DEFAULT_CONFIG.permissions.autoAllow).toContain('Glob');
    expect(DEFAULT_CONFIG.permissions.autoAllow).toContain('Grep');
  });

  it('has empty autoDeny by default', () => {
    expect(DEFAULT_CONFIG.permissions.autoDeny).toEqual([]);
  });

  it('has empty autoAsk by default', () => {
    expect(DEFAULT_CONFIG.permissions.autoAsk).toEqual([]);
  });

  it('has blockedPatterns defined', () => {
    expect(DEFAULT_CONFIG.guards.command.blockedPatterns.length).toBeGreaterThan(0);
  });

  it('has protectedPatterns defined', () => {
    expect(DEFAULT_CONFIG.guards.file.protectedPatterns).toContain('.env');
    expect(DEFAULT_CONFIG.guards.file.protectedPatterns).toContain('*.pem');
    expect(DEFAULT_CONFIG.guards.file.protectedPatterns).toContain('*.key');
  });
});

describe('loadConfig', () => {
  it('returns DEFAULT_CONFIG when no config file exists', () => {
    const config = loadConfig(tempDir);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
    expect(config.guards.command.enabled).toBe(DEFAULT_CONFIG.guards.command.enabled);
  });

  it('loads and merges config from file', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ logDir: 'custom/logs' }), 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('custom/logs');
    // Default values still present
    expect(config.guards.command.enabled).toBe(true);
  });

  it('deep merges nested objects', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: {
        command: { enabled: false },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.guards.command.enabled).toBe(false);
    // Other guard props preserved
    expect(config.guards.file.enabled).toBe(true);
    expect(config.guards.command.blockedPatterns.length).toBeGreaterThan(0);
  });

  it('replaces arrays from source (does not merge arrays)', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: {
        command: { blockedPatterns: ['custom-pattern'] },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.guards.command.blockedPatterns).toEqual(['custom-pattern']);
  });

  it('handles invalid JSON gracefully', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, 'not valid json!!!', 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
  });

  it('handles non-object JSON gracefully', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, '"just a string"', 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
  });

  it('handles null JSON gracefully', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, 'null', 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
  });

  it('handles array JSON gracefully', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, '[1, 2, 3]', 'utf-8');

    const config = loadConfig(tempDir);
    // Arrays are objects, so deepMerge might behave differently,
    // but loadConfig should not crash
    expect(config).toBeDefined();
  });

  it('merges permission config', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      permissions: { autoAllow: ['Read', 'Write'], autoDeny: ['Bash'] },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.permissions.autoAllow).toEqual(['Read', 'Write']);
    expect(config.permissions.autoDeny).toEqual(['Bash']);
  });

  it('does not mutate DEFAULT_CONFIG when loading overrides', () => {
    // Snapshot DEFAULT_CONFIG before loading
    const snapshot = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Write a config that overrides multiple nested values
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 'mutated/logs',
      guards: {
        command: { enabled: false, blockedPatterns: ['evil'] },
        file: { enabled: false },
      },
      permissions: { autoAllow: ['Write'], autoDeny: ['Bash'] },
    }), 'utf-8');

    loadConfig(tempDir);

    // DEFAULT_CONFIG must remain unchanged
    expect(DEFAULT_CONFIG).toEqual(snapshot);
  });
});
