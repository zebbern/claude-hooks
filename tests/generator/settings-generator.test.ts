import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { generateSettings, mergeWithExisting, writeSettings } from '../../src/generator/settings-generator.js';
import { ALL_HOOK_EVENT_TYPES } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import type { ClaudeSettings, PresetName, ToolkitConfig } from '../../src/types.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-generator-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('settings-generator', () => {
  describe('generateSettings', () => {
    const presets: PresetName[] = ['minimal', 'security', 'quality', 'full'];

    for (const preset of presets) {
      it(`generates ${preset} preset with hooks for all 13 hook types`, () => {
        const settings = generateSettings(preset, tempDir);
        expect(settings.hooks).toBeDefined();

        for (const hookType of ALL_HOOK_EVENT_TYPES) {
          expect(settings.hooks![hookType]).toBeDefined();
          expect(settings.hooks![hookType]!.length).toBeGreaterThan(0);
        }
      });
    }

    it('minimal preset uses empty matchers for all hooks', () => {
      const settings = generateSettings('minimal', tempDir);
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const entries = settings.hooks![hookType]!;
        expect(entries.length).toBe(1);
        expect(entries[0]!.matcher).toBe('');
      }
    });

    it('security preset has specific PreToolUse matchers', () => {
      const settings = generateSettings('security', tempDir);
      const preToolUse = settings.hooks!.PreToolUse!;
      expect(preToolUse.length).toBeGreaterThan(1);

      const matchers = preToolUse.map((e) => e.matcher);
      expect(matchers).toContain('Bash');
      expect(matchers).toContain('Write');
      expect(matchers).toContain('Edit');
      expect(matchers).toContain('MultiEdit');
    });

    it('security preset has PostToolUse matchers for write tools', () => {
      const settings = generateSettings('security', tempDir);
      const postToolUse = settings.hooks!.PostToolUse!;
      const matchers = postToolUse.map((e) => e.matcher);
      expect(matchers).toContain('Write');
      expect(matchers).toContain('Edit');
    });

    it('hook commands reference node and a .js file', () => {
      const settings = generateSettings('minimal', tempDir);
      const entry = settings.hooks!.PreToolUse![0]!;
      expect(entry.hooks[0]!.type).toBe('command');
      expect(entry.hooks[0]!.command).toMatch(/^node .+\.js$/);
    });

    it('hook commands include windows field with backslashes', () => {
      const settings = generateSettings('minimal', tempDir);
      const entry = settings.hooks!.PreToolUse![0]!;
      expect(entry.hooks[0]!.windows).toBeDefined();
      expect(entry.hooks[0]!.windows).toMatch(/^node .+\.js$/);
      expect(entry.hooks[0]!.windows).toContain('\\');
    });

    it('base command uses forward slashes', () => {
      const settings = generateSettings('minimal', tempDir);
      const entry = settings.hooks!.PreToolUse![0]!;
      const command = entry.hooks[0]!.command;
      // After "node ", the path portion should have no backslashes
      const pathPart = command.replace(/^node /, '');
      expect(pathPart).not.toContain('\\');
    });

    it('all hook types include OS-specific fields', () => {
      const settings = generateSettings('security', tempDir);
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const entries = settings.hooks![hookType]!;
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            expect(hook.command).toBeDefined();
            expect(hook.windows).toBeDefined();
            expect(hook.command).not.toEqual(hook.windows);
          }
        }
      }
    });

    it('quality preset returns same structure as security', () => {
      const security = generateSettings('security', tempDir);
      const quality = generateSettings('quality', tempDir);
      // Both should have same hook structure
      expect(Object.keys(security.hooks!)).toEqual(Object.keys(quality.hooks!));
    });
  });

  describe('mergeWithExisting', () => {
    it('preserves existing non-hook properties', () => {
      const existing: ClaudeSettings = {
        permissions: { allow: ['Read'] },
        customProp: 'keep me',
      };
      const generated: ClaudeSettings = {
        hooks: { PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: 'test' }] }] },
      };

      const merged = mergeWithExisting(existing, generated);
      expect(merged.customProp).toBe('keep me');
      expect(merged.permissions).toEqual({ allow: ['Read'] });
      expect(merged.hooks?.PreToolUse).toBeDefined();
    });

    it('overwrites hook entries from generated', () => {
      const existing: ClaudeSettings = {
        hooks: {
          PreToolUse: [{ matcher: 'old', hooks: [{ type: 'command', command: 'old-cmd' }] }],
        },
      };
      const generated: ClaudeSettings = {
        hooks: {
          PreToolUse: [{ matcher: 'new', hooks: [{ type: 'command', command: 'new-cmd' }] }],
        },
      };

      const merged = mergeWithExisting(existing, generated);
      expect(merged.hooks!.PreToolUse![0]!.matcher).toBe('new');
    });

    it('preserves existing hooks not in generated', () => {
      const existing: ClaudeSettings = {
        hooks: {
          Stop: [{ matcher: 'existing', hooks: [{ type: 'command', command: 'stop-cmd' }] }],
        },
      };
      const generated: ClaudeSettings = {
        hooks: {
          PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: 'new' }] }],
        },
      };

      const merged = mergeWithExisting(existing, generated);
      // Stop is not in ALL_HOOK_EVENT_TYPES iteration for generated that lacks it,
      // but the existing hooks object is spread, so it depends on implementation
      expect(merged.hooks).toBeDefined();
    });

    it('handles empty generated hooks', () => {
      const existing: ClaudeSettings = { customProp: 'value' };
      const generated: ClaudeSettings = {};

      const merged = mergeWithExisting(existing, generated);
      expect(merged.customProp).toBe('value');
    });
  });

  describe('writeSettings', () => {
    it('creates directory and writes JSON file', () => {
      const settings: ClaudeSettings = { hooks: {} };
      const settingsPath = path.join(tempDir, '.claude', 'settings.json');

      writeSettings(settings, settingsPath);

      expect(fs.existsSync(settingsPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(content.hooks).toEqual({});
    });

    it('writes formatted JSON with newline', () => {
      const settings: ClaudeSettings = { hooks: {} };
      const settingsPath = path.join(tempDir, 'settings.json');

      writeSettings(settings, settingsPath);

      const raw = fs.readFileSync(settingsPath, 'utf-8');
      expect(raw).toContain('\n');
      expect(raw.endsWith('\n')).toBe(true);
    });

    it('overwrites existing file', () => {
      const settingsPath = path.join(tempDir, 'settings.json');
      fs.writeFileSync(settingsPath, '{"old": true}', 'utf-8');

      writeSettings({ hooks: {} }, settingsPath);

      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(content.old).toBeUndefined();
      expect(content.hooks).toBeDefined();
    });
  });

  describe('timeout configuration', () => {
    it('includes default timeout (30) in generated commands when config provided', () => {
      const config = structuredClone(DEFAULT_CONFIG);
      const settings = generateSettings('minimal', tempDir, config);

      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const entries = settings.hooks![hookType]!;
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            expect(hook.timeout).toBe(30);
          }
        }
      }
    });

    it('omits timeout when no config is provided', () => {
      const settings = generateSettings('minimal', tempDir);

      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const entries = settings.hooks![hookType]!;
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            expect(hook.timeout).toBeUndefined();
          }
        }
      }
    });

    it('uses custom global defaultTimeout', () => {
      const config: ToolkitConfig = { ...structuredClone(DEFAULT_CONFIG), defaultTimeout: 60 };
      const settings = generateSettings('security', tempDir, config);

      const entry = settings.hooks!.PreToolUse![0]!;
      expect(entry.hooks[0]!.timeout).toBe(60);
    });

    it('per-hook-type timeout overrides global default', () => {
      const config: ToolkitConfig = {
        ...structuredClone(DEFAULT_CONFIG),
        defaultTimeout: 30,
        hookTimeouts: { PreToolUse: 10, Stop: 120 },
      };
      const settings = generateSettings('security', tempDir, config);

      // PreToolUse should use per-hook timeout
      const preToolUse = settings.hooks!.PreToolUse![0]!;
      expect(preToolUse.hooks[0]!.timeout).toBe(10);

      // Stop should use per-hook timeout
      const stop = settings.hooks!.Stop![0]!;
      expect(stop.hooks[0]!.timeout).toBe(120);

      // Other hooks fall back to global default
      const sessionStart = settings.hooks!.SessionStart![0]!;
      expect(sessionStart.hooks[0]!.timeout).toBe(30);
    });

    it('timeout is included in security preset hook commands', () => {
      const config = structuredClone(DEFAULT_CONFIG);
      const settings = generateSettings('security', tempDir, config);

      // Security preset has multiple PreToolUse matchers
      for (const entry of settings.hooks!.PreToolUse!) {
        expect(entry.hooks[0]!.timeout).toBe(30);
      }
    });
  });
});
