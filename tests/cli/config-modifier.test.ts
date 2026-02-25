import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { enableFeatureInConfig, disableFeatureInConfig } from '../../src/config-modifier.js';

describe('config-modifier', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hooks-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readConfig(): Record<string, unknown> {
    const raw = fs.readFileSync(path.join(tmpDir, 'claude-hooks.config.json'), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  }

  describe('enableFeatureInConfig', () => {
    it('creates config file if it does not exist', () => {
      enableFeatureInConfig('guards.command', tmpDir);
      expect(fs.existsSync(path.join(tmpDir, 'claude-hooks.config.json'))).toBe(true);
    });

    it('sets enabled=true at a simple config path', () => {
      enableFeatureInConfig('guards.command', tmpDir);
      const config = readConfig();
      const guards = config.guards as Record<string, unknown>;
      const command = guards.command as Record<string, unknown>;
      expect(command.enabled).toBe(true);
    });

    it('sets enabled=true at a deeply nested path', () => {
      enableFeatureInConfig('validators.lint', tmpDir);
      const config = readConfig();
      const validators = config.validators as Record<string, unknown>;
      const lint = validators.lint as Record<string, unknown>;
      expect(lint.enabled).toBe(true);
    });

    it('preserves existing config properties', () => {
      const existing = {
        logDir: 'custom/logs',
        guards: { command: { blockedPatterns: ['rm -rf'], enabled: false } },
      };
      fs.writeFileSync(
        path.join(tmpDir, 'claude-hooks.config.json'),
        JSON.stringify(existing, null, 2),
        'utf-8',
      );

      enableFeatureInConfig('guards.command', tmpDir);
      const config = readConfig();
      expect(config.logDir).toBe('custom/logs');
      const guards = config.guards as Record<string, unknown>;
      const command = guards.command as Record<string, unknown>;
      expect(command.blockedPatterns).toEqual(['rm -rf']);
      expect(command.enabled).toBe(true);
    });

    it('creates intermediate objects if missing', () => {
      enableFeatureInConfig('guards.path', tmpDir);
      const config = readConfig();
      const guards = config.guards as Record<string, unknown>;
      const pathGuard = guards.path as Record<string, unknown>;
      expect(pathGuard.enabled).toBe(true);
    });
  });

  describe('disableFeatureInConfig', () => {
    it('sets enabled=false at a config path', () => {
      disableFeatureInConfig('guards.command', tmpDir);
      const config = readConfig();
      const guards = config.guards as Record<string, unknown>;
      const command = guards.command as Record<string, unknown>;
      expect(command.enabled).toBe(false);
    });

    it('can disable a previously enabled feature', () => {
      enableFeatureInConfig('validators.typecheck', tmpDir);
      let config = readConfig();
      expect(((config.validators as Record<string, unknown>).typecheck as Record<string, unknown>).enabled).toBe(true);

      disableFeatureInConfig('validators.typecheck', tmpDir);
      config = readConfig();
      expect(((config.validators as Record<string, unknown>).typecheck as Record<string, unknown>).enabled).toBe(false);
    });

    it('preserves other features when disabling one', () => {
      enableFeatureInConfig('guards.command', tmpDir);
      enableFeatureInConfig('guards.file', tmpDir);
      disableFeatureInConfig('guards.command', tmpDir);

      const config = readConfig();
      const guards = config.guards as Record<string, unknown>;
      expect((guards.command as Record<string, unknown>).enabled).toBe(false);
      expect((guards.file as Record<string, unknown>).enabled).toBe(true);
    });

    it('creates config file if it does not exist', () => {
      disableFeatureInConfig('guards.command', tmpDir);
      expect(fs.existsSync(path.join(tmpDir, 'claude-hooks.config.json'))).toBe(true);
    });

    it('writes JSON with trailing newline', () => {
      disableFeatureInConfig('guards.command', tmpDir);
      const raw = fs.readFileSync(path.join(tmpDir, 'claude-hooks.config.json'), 'utf-8');
      expect(raw.endsWith('\n')).toBe(true);
    });
  });
});
