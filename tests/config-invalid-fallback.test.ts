import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadConfig, DEFAULT_CONFIG } from '../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-config-invalid-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('loadConfig with invalid fields', () => {
  it('falls back to default for invalid number field', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: {
        diffSize: { maxLines: 'not-a-number', enabled: true },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // maxLines should fall back to default instead of "not-a-number"
    expect(config.guards.diffSize.maxLines).toBe(DEFAULT_CONFIG.guards.diffSize.maxLines);
    // Valid field (enabled) should still be merged
    expect(config.guards.diffSize.enabled).toBe(true);
  });

  it('falls back to default for invalid boolean field', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: {
        command: { enabled: 'true' },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // "true" (string) is invalid — should fall back to default boolean
    expect(config.guards.command.enabled).toBe(DEFAULT_CONFIG.guards.command.enabled);
  });

  it('falls back to default for number below minimum', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: {
        diffSize: { maxLines: 0 },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // 0 is below min of 1 — should fall back to default
    expect(config.guards.diffSize.maxLines).toBe(DEFAULT_CONFIG.guards.diffSize.maxLines);
  });

  it('falls back to default for invalid string field', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 42,
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // 42 is not a string — should fall back to default
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
  });

  it('merges valid fields alongside invalid ones', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 'custom/logs',
      guards: {
        diffSize: { maxLines: 'bad', enabled: true },
        command: { enabled: false },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // Valid fields should be merged
    expect(config.logDir).toBe('custom/logs');
    expect(config.guards.command.enabled).toBe(false);
    // Invalid field should fall back to default
    expect(config.guards.diffSize.maxLines).toBe(DEFAULT_CONFIG.guards.diffSize.maxLines);
    // Sibling valid field should still be merged
    expect(config.guards.diffSize.enabled).toBe(true);
  });

  it('merges normally when config has no errors', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 'custom/logs',
      guards: {
        command: { enabled: false },
        diffSize: { maxLines: 200 },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('custom/logs');
    expect(config.guards.command.enabled).toBe(false);
    expect(config.guards.diffSize.maxLines).toBe(200);
  });

  it('merges normally when config has only warnings', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 'custom/logs',
      unknownExtraKey: 'whatever',
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // Warnings don't block merging of valid fields
    expect(config.logDir).toBe('custom/logs');
    // Defaults are preserved
    expect(config.guards.command.enabled).toBe(true);
  });

  it('strips invalid string array field', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      guards: {
        command: { blockedPatterns: 'not-an-array' },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    // Should fall back to default blockedPatterns array
    expect(Array.isArray(config.guards.command.blockedPatterns)).toBe(true);
    expect(config.guards.command.blockedPatterns).toEqual(DEFAULT_CONFIG.guards.command.blockedPatterns);
  });

  it('strips all invalid fields when multiple errors exist', () => {
    const configPath = path.join(tempDir, 'claude-hooks.config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      logDir: 999,
      guards: {
        command: { enabled: 'yes', blockedPatterns: 42 },
        diffSize: { maxLines: -5 },
      },
    }), 'utf-8');

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
    expect(config.guards.command.enabled).toBe(DEFAULT_CONFIG.guards.command.enabled);
    expect(config.guards.command.blockedPatterns).toEqual(DEFAULT_CONFIG.guards.command.blockedPatterns);
    expect(config.guards.diffSize.maxLines).toBe(DEFAULT_CONFIG.guards.diffSize.maxLines);
  });
});
