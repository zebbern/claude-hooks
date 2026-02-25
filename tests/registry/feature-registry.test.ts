import { describe, it, expect } from 'vitest';
import { FeatureRegistry } from '../../src/registry/feature-registry.js';
import type { FeatureModule, HookInputBase, ToolkitConfig, HookEventType } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeMeta(overrides: Partial<FeatureModule<HookInputBase>['meta']> = {}): FeatureModule<HookInputBase>['meta'] {
  return {
    name: 'test-feature',
    hookTypes: ['PreToolUse'],
    description: 'A test feature',
    category: 'security',
    configPath: '',
    priority: 100,
    ...overrides,
  };
}

function makeFeature(overrides: Partial<FeatureModule<HookInputBase>['meta']> = {}): FeatureModule<HookInputBase> {
  return {
    meta: makeMeta(overrides),
    createHandler: () => async () => undefined,
  };
}

function makeConfig(overrides: Partial<ToolkitConfig> = {}): ToolkitConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe('FeatureRegistry', () => {
  describe('constructor', () => {
    it('initializes with built-in features when no argument given', () => {
      const registry = new FeatureRegistry();
      const all = registry.getAll();
      expect(all.length).toBeGreaterThan(0);
      // Should contain known built-in features
      expect(all.some((f) => f.meta.name === 'command-guard')).toBe(true);
      expect(all.some((f) => f.meta.name === 'logger')).toBe(true);
    });

    it('initializes with custom features when argument provided', () => {
      const custom = [makeFeature({ name: 'custom-a' }), makeFeature({ name: 'custom-b' })];
      const registry = new FeatureRegistry(custom);
      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all[0]!.meta.name).toBe('custom-a');
      expect(all[1]!.meta.name).toBe('custom-b');
    });

    it('does not share the internal array with the caller', () => {
      const custom = [makeFeature({ name: 'shared-test' })];
      const registry = new FeatureRegistry(custom);
      custom.push(makeFeature({ name: 'added-later' }));
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('returns all registered features', () => {
      const features = [makeFeature({ name: 'a' }), makeFeature({ name: 'b' }), makeFeature({ name: 'c' })];
      const registry = new FeatureRegistry(features);
      expect(registry.getAll()).toHaveLength(3);
    });

    it('returns a copy (not the internal array)', () => {
      const registry = new FeatureRegistry([makeFeature({ name: 'x' })]);
      const all = registry.getAll();
      all.push(makeFeature({ name: 'y' }));
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('getByHookType', () => {
    it('filters features by hook type', () => {
      const features = [
        makeFeature({ name: 'pre-only', hookTypes: ['PreToolUse'] }),
        makeFeature({ name: 'post-only', hookTypes: ['PostToolUse'] }),
        makeFeature({ name: 'both', hookTypes: ['PreToolUse', 'PostToolUse'] }),
      ];
      const registry = new FeatureRegistry(features);
      const preFeatures = registry.getByHookType('PreToolUse');
      expect(preFeatures).toHaveLength(2);
      expect(preFeatures.map((f) => f.meta.name)).toContain('pre-only');
      expect(preFeatures.map((f) => f.meta.name)).toContain('both');
    });

    it('returns empty array when no features match', () => {
      const features = [makeFeature({ name: 'pre', hookTypes: ['PreToolUse'] })];
      const registry = new FeatureRegistry(features);
      expect(registry.getByHookType('Stop')).toHaveLength(0);
    });
  });

  describe('getEnabled', () => {
    it('returns features that are enabled in config', () => {
      const features = [
        makeFeature({ name: 'cmd-guard', hookTypes: ['PreToolUse'], configPath: 'guards.command' }),
        makeFeature({ name: 'file-guard', hookTypes: ['PreToolUse'], configPath: 'guards.file' }),
      ];
      const registry = new FeatureRegistry(features);
      const config = makeConfig({
        guards: {
          ...DEFAULT_CONFIG.guards,
          command: { ...DEFAULT_CONFIG.guards.command, enabled: true },
          file: { ...DEFAULT_CONFIG.guards.file, enabled: false },
        },
      });

      const enabled = registry.getEnabled('PreToolUse', config);
      expect(enabled).toHaveLength(1);
      expect(enabled[0]!.meta.name).toBe('cmd-guard');
    });

    it('treats features without configPath as always enabled', () => {
      const features = [
        makeFeature({ name: 'always-on', hookTypes: ['PreToolUse'], configPath: '' }),
      ];
      const registry = new FeatureRegistry(features);
      const enabled = registry.getEnabled('PreToolUse', makeConfig());
      expect(enabled).toHaveLength(1);
    });

    it('filters by hook type AND enabled status', () => {
      const features = [
        makeFeature({ name: 'pre-enabled', hookTypes: ['PreToolUse'], configPath: '' }),
        makeFeature({ name: 'post-enabled', hookTypes: ['PostToolUse'], configPath: '' }),
      ];
      const registry = new FeatureRegistry(features);
      const enabled = registry.getEnabled('PreToolUse', makeConfig());
      expect(enabled).toHaveLength(1);
      expect(enabled[0]!.meta.name).toBe('pre-enabled');
    });

    it('defaults to enabled when config key is missing', () => {
      const features = [
        makeFeature({ name: 'optional', hookTypes: ['PreToolUse'], configPath: 'nonexistent.path' }),
      ];
      const registry = new FeatureRegistry(features);
      const enabled = registry.getEnabled('PreToolUse', makeConfig());
      expect(enabled).toHaveLength(1);
    });

    it('handles deeply nested configPath', () => {
      const features = [
        makeFeature({ name: 'deep', hookTypes: ['PostToolUse'], configPath: 'validators.lint' }),
      ];
      const registry = new FeatureRegistry(features);

      const enabledConfig = makeConfig({
        validators: { ...DEFAULT_CONFIG.validators, lint: { command: 'npx eslint', enabled: true } },
      });
      expect(registry.getEnabled('PostToolUse', enabledConfig)).toHaveLength(1);

      const disabledConfig = makeConfig({
        validators: { ...DEFAULT_CONFIG.validators, lint: { command: 'npx eslint', enabled: false } },
      });
      expect(registry.getEnabled('PostToolUse', disabledConfig)).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('returns feature by exact name', () => {
      const features = [makeFeature({ name: 'target' }), makeFeature({ name: 'other' })];
      const registry = new FeatureRegistry(features);
      const found = registry.get('target');
      expect(found).toBeDefined();
      expect(found!.meta.name).toBe('target');
    });

    it('returns undefined for unknown name', () => {
      const registry = new FeatureRegistry([makeFeature({ name: 'known' })]);
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('returns undefined from empty registry', () => {
      const registry = new FeatureRegistry([]);
      expect(registry.get('anything')).toBeUndefined();
    });
  });

  describe('register', () => {
    it('adds a new feature to the registry', () => {
      const registry = new FeatureRegistry([]);
      expect(registry.getAll()).toHaveLength(0);

      registry.register(makeFeature({ name: 'new-feature' }));
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('new-feature')).toBeDefined();
    });

    it('allows registering multiple features', () => {
      const registry = new FeatureRegistry([]);
      registry.register(makeFeature({ name: 'a' }));
      registry.register(makeFeature({ name: 'b' }));
      registry.register(makeFeature({ name: 'c' }));
      expect(registry.getAll()).toHaveLength(3);
    });

    it('registered features appear in getByHookType results', () => {
      const registry = new FeatureRegistry([]);
      registry.register(makeFeature({ name: 'dynamic', hookTypes: ['Stop'] }));
      expect(registry.getByHookType('Stop')).toHaveLength(1);
    });

    it('replaces existing feature with same name instead of duplicating', () => {
      const registry = new FeatureRegistry([]);
      const original = makeFeature({ name: 'dup', description: 'original', priority: 10 });
      const replacement = makeFeature({ name: 'dup', description: 'replacement', priority: 20 });

      registry.register(original);
      registry.register(replacement);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('dup')!.meta.description).toBe('replacement');
      expect(registry.get('dup')!.meta.priority).toBe(20);
    });

    it('does not grow when re-registering multiple times', () => {
      const registry = new FeatureRegistry([]);
      registry.register(makeFeature({ name: 'same' }));
      registry.register(makeFeature({ name: 'same' }));
      registry.register(makeFeature({ name: 'same' }));
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('removes all features from the registry', () => {
      const registry = new FeatureRegistry([
        makeFeature({ name: 'a' }),
        makeFeature({ name: 'b' }),
      ]);
      expect(registry.getAll()).toHaveLength(2);
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('allows registering features after clear', () => {
      const registry = new FeatureRegistry([makeFeature({ name: 'old' })]);
      registry.clear();
      registry.register(makeFeature({ name: 'new' }));
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('new')).toBeDefined();
    });
  });

  describe('built-in features validation', () => {
    it('all built-in features have valid hook types', () => {
      const registry = new FeatureRegistry();
      const validTypes: HookEventType[] = [
        'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit',
        'Notification', 'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact',
        'Setup', 'SessionStart', 'SessionEnd', 'PermissionRequest',
      ];

      for (const feature of registry.getAll()) {
        for (const hookType of feature.meta.hookTypes) {
          expect(validTypes).toContain(hookType);
        }
      }
    });

    it('all built-in features have unique names', () => {
      const registry = new FeatureRegistry();
      const names = registry.getAll().map((f) => f.meta.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('expected built-in feature count matches', () => {
      const registry = new FeatureRegistry();
      expect(registry.getAll()).toHaveLength(26);
    });
  });
});
