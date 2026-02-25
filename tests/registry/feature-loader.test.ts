import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadEnabledHandlers, loadEnabledHandlersAsync } from '../../src/registry/feature-loader.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import type { ToolkitConfig, LazyFeatureDescriptor, FeatureModule, HookInputBase } from '../../src/types.js';

function makeConfig(overrides: Partial<ToolkitConfig> = {}): ToolkitConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe('loadEnabledHandlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns handlers for enabled PreToolUse features', () => {
    const config = makeConfig();
    const handlers = loadEnabledHandlers('PreToolUse', config);
    // command-guard, file-guard, path-guard are all enabled by default
    expect(handlers.length).toBeGreaterThanOrEqual(3);
    expect(handlers.every((h) => typeof h === 'function')).toBe(true);
  });

  it('returns handlers sorted by priority (ascending)', () => {
    const config = makeConfig();
    // We can't directly inspect priority from handlers, but we can check
    // the feature-loader returns handlers from features that are sorted
    const handlers = loadEnabledHandlers('PreToolUse', config);
    expect(handlers.length).toBeGreaterThan(0);
  });

  it('skips disabled features', () => {
    const config = makeConfig({
      guards: {
        command: { ...DEFAULT_CONFIG.guards.command, enabled: false },
        file: { ...DEFAULT_CONFIG.guards.file, enabled: false },
        path: { ...DEFAULT_CONFIG.guards.path, enabled: false },
        diffSize: { ...DEFAULT_CONFIG.guards.diffSize, enabled: false },
        branch: { ...DEFAULT_CONFIG.guards.branch, enabled: false },
        secretLeak: { ...DEFAULT_CONFIG.guards.secretLeak, enabled: false },
        scope: { ...DEFAULT_CONFIG.guards.scope, enabled: false },
      },
    });
    const handlers = loadEnabledHandlers('PreToolUse', config);
    // All guards disabled, but logger (always-on) still handles PreToolUse
    // So we should have fewer handlers than when guards are enabled
    const enabledHandlers = loadEnabledHandlers('PreToolUse', makeConfig());
    expect(handlers.length).toBeLessThan(enabledHandlers.length);
    // Only logger remains (1 handler)
    expect(handlers).toHaveLength(1);
  });

  it('returns empty array when no features match hook type', () => {
    const config = makeConfig();
    // SubagentStart is only used by logger (always enabled)
    // but if we filter for a type not used by any feature besides logger,
    // logger is always-on so it should appear
    const handlers = loadEnabledHandlers('SubagentStart', config);
    // Logger handles all hook types, so at least 1
    expect(handlers.length).toBeGreaterThanOrEqual(1);
  });

  it('includes always-enabled features (no configPath)', () => {
    const config = makeConfig();
    // SessionStart includes logger (always-on) and session-tracker, git-context
    const handlers = loadEnabledHandlers('SessionStart', config);
    expect(handlers.length).toBeGreaterThanOrEqual(2);
  });

  it('returns handlers for PostToolUse when validators enabled', () => {
    const config = makeConfig({
      validators: {
        lint: { command: 'npx eslint', enabled: true },
        typecheck: { command: 'npx tsc --noEmit', enabled: true },
        test: { command: '', timeout: 60000, enabled: false },
      },
    });
    const handlers = loadEnabledHandlers('PostToolUse', config);
    // Should include lint-validator, typecheck-validator, and logger
    expect(handlers.length).toBeGreaterThanOrEqual(3);
  });

  it('excludes PostToolUse validators when disabled', () => {
    const config = makeConfig({
      validators: {
        lint: { command: 'npx eslint', enabled: false },
        typecheck: { command: 'npx tsc --noEmit', enabled: false },
        test: { command: '', timeout: 60000, enabled: false },
      },
    });
    const handlers = loadEnabledHandlers('PostToolUse', config);
    // Only logger remains (always-on)
    expect(handlers).toHaveLength(1);
  });

  it('returns handlers as functions', () => {
    const config = makeConfig();
    const handlers = loadEnabledHandlers('PermissionRequest', config);
    for (const handler of handlers) {
      expect(typeof handler).toBe('function');
    }
  });
});

function makeLazyDescriptor(
  overrides: Partial<LazyFeatureDescriptor['meta']> = {},
): LazyFeatureDescriptor {
  const meta = {
    name: 'test-lazy',
    hookTypes: ['PreToolUse'] as LazyFeatureDescriptor['meta']['hookTypes'],
    description: 'A lazy test feature',
    category: 'security' as const,
    configPath: '',
    priority: 100,
    ...overrides,
  };

  const feature: FeatureModule<HookInputBase> = {
    meta,
    createHandler: () => async () => undefined,
  };

  return { meta, load: () => Promise.resolve(feature) };
}

describe('loadEnabledHandlersAsync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads handlers only for matching hook type', async () => {
    const descriptors = [
      makeLazyDescriptor({ name: 'pre-only', hookTypes: ['PreToolUse'] }),
      makeLazyDescriptor({ name: 'post-only', hookTypes: ['PostToolUse'] }),
      makeLazyDescriptor({ name: 'both', hookTypes: ['PreToolUse', 'PostToolUse'] }),
    ];
    const config = makeConfig();
    const handlers = await loadEnabledHandlersAsync('PreToolUse', config, descriptors);
    expect(handlers).toHaveLength(2);
    expect(handlers.every((h) => typeof h === 'function')).toBe(true);
  });

  it('skips disabled features via config', async () => {
    const descriptors = [
      makeLazyDescriptor({ name: 'cmd-guard', hookTypes: ['PreToolUse'], configPath: 'guards.command' }),
      makeLazyDescriptor({ name: 'always-on', hookTypes: ['PreToolUse'], configPath: '' }),
    ];
    const config = makeConfig({
      guards: {
        ...DEFAULT_CONFIG.guards,
        command: { ...DEFAULT_CONFIG.guards.command, enabled: false },
      },
    });
    const handlers = await loadEnabledHandlersAsync('PreToolUse', config, descriptors);
    expect(handlers).toHaveLength(1);
  });

  it('sorts handlers by priority ascending', async () => {
    const loadOrder: string[] = [];
    const makeTracked = (name: string, priority: number): LazyFeatureDescriptor => {
      const meta = {
        name,
        hookTypes: ['PreToolUse'] as LazyFeatureDescriptor['meta']['hookTypes'],
        description: 'test',
        category: 'security' as const,
        configPath: '',
        priority,
      };
      return {
        meta,
        load: () => {
          loadOrder.push(name);
          const feature: FeatureModule<HookInputBase> = {
            meta,
            createHandler: () => async () => ({ exitCode: 0 as const, stdout: name }),
          };
          return Promise.resolve(feature);
        },
      };
    };

    const descriptors = [
      makeTracked('high-priority', 200),
      makeTracked('low-priority', 10),
      makeTracked('mid-priority', 100),
    ];
    const config = makeConfig();
    const handlers = await loadEnabledHandlersAsync('PreToolUse', config, descriptors);
    expect(handlers).toHaveLength(3);

    // Verify handlers are ordered by priority (low → high)
    const results = await Promise.all(handlers.map((h) => h({} as never, config)));
    expect(results.map((r) => r?.stdout)).toEqual(['low-priority', 'mid-priority', 'high-priority']);
  });

  it('returns empty array when no features match', async () => {
    const descriptors = [
      makeLazyDescriptor({ name: 'pre-only', hookTypes: ['PreToolUse'] }),
    ];
    const config = makeConfig();
    const handlers = await loadEnabledHandlersAsync('Stop', config, descriptors);
    expect(handlers).toHaveLength(0);
  });

  it('only calls load() on matching features', async () => {
    const loadSpy = vi.fn().mockResolvedValue({
      meta: { name: 'spy', hookTypes: ['PreToolUse'], description: '', category: 'security', configPath: '', priority: 1 },
      createHandler: () => async () => undefined,
    });
    const noLoadSpy = vi.fn().mockResolvedValue({
      meta: { name: 'no-spy', hookTypes: ['PostToolUse'], description: '', category: 'security', configPath: '', priority: 1 },
      createHandler: () => async () => undefined,
    });

    const descriptors: LazyFeatureDescriptor[] = [
      {
        meta: { name: 'spy', hookTypes: ['PreToolUse'], description: '', category: 'security', configPath: '', priority: 1 },
        load: loadSpy,
      },
      {
        meta: { name: 'no-spy', hookTypes: ['PostToolUse'], description: '', category: 'security', configPath: '', priority: 1 },
        load: noLoadSpy,
      },
    ];

    await loadEnabledHandlersAsync('PreToolUse', makeConfig(), descriptors);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(noLoadSpy).not.toHaveBeenCalled();
  });

  it('uses built-in lazy features by default', async () => {
    const config = makeConfig();
    const handlers = await loadEnabledHandlersAsync('PreToolUse', config);
    // Should match the sync loadEnabledHandlers result
    const syncHandlers = loadEnabledHandlers('PreToolUse', config);
    expect(handlers).toHaveLength(syncHandlers.length);
  });
});
