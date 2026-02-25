import { describe, it, expect } from 'vitest';
import { isFeatureEnabled } from '../../src/registry/feature-registry.js';
import type { FeatureMeta, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeMeta(overrides: Partial<FeatureMeta> = {}): FeatureMeta {
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

function makeConfig(overrides: Partial<ToolkitConfig> = {}): ToolkitConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe('isFeatureEnabled', () => {
  it('returns true when configPath is empty (always-on feature)', () => {
    const meta = makeMeta({ configPath: '' });
    expect(isFeatureEnabled(meta, makeConfig())).toBe(true);
  });

  it('returns true when configPath resolves to enabled: true', () => {
    const meta = makeMeta({ configPath: 'guards.command' });
    const config = makeConfig({
      guards: { ...DEFAULT_CONFIG.guards, command: { ...DEFAULT_CONFIG.guards.command, enabled: true } },
    });
    expect(isFeatureEnabled(meta, config)).toBe(true);
  });

  it('returns false when configPath resolves to enabled: false', () => {
    const meta = makeMeta({ configPath: 'guards.command' });
    const config = makeConfig({
      guards: { ...DEFAULT_CONFIG.guards, command: { ...DEFAULT_CONFIG.guards.command, enabled: false } },
    });
    expect(isFeatureEnabled(meta, config)).toBe(false);
  });

  it('returns true when configPath does not exist in config', () => {
    const meta = makeMeta({ configPath: 'nonexistent.feature' });
    expect(isFeatureEnabled(meta, makeConfig())).toBe(true);
  });

  it('handles deeply nested configPath', () => {
    const meta = makeMeta({ configPath: 'validators.lint' });
    const enabledConfig = makeConfig({
      validators: { ...DEFAULT_CONFIG.validators, lint: { command: 'eslint', enabled: true } },
    });
    expect(isFeatureEnabled(meta, enabledConfig)).toBe(true);

    const disabledConfig = makeConfig({
      validators: { ...DEFAULT_CONFIG.validators, lint: { command: 'eslint', enabled: false } },
    });
    expect(isFeatureEnabled(meta, disabledConfig)).toBe(false);
  });

  it('returns true when resolved object has no enabled property', () => {
    const meta = makeMeta({ configPath: 'permissions' });
    expect(isFeatureEnabled(meta, makeConfig())).toBe(true);
  });

  it('returns true when intermediate path resolves to non-object', () => {
    const meta = makeMeta({ configPath: 'logDir.nested' });
    expect(isFeatureEnabled(meta, makeConfig())).toBe(true);
  });
});
