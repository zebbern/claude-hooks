import { describe, it, expect } from 'vitest';
import { permissionHandlerMeta } from '../../src/features/permission-handler/meta.js';
import { resolvePermission, matchesPattern, createHandler } from '../../src/features/permission-handler/handler.js';
import type { ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeConfig(overrides: Partial<ToolkitConfig['permissions']> = {}): ToolkitConfig {
  return {
    ...structuredClone(DEFAULT_CONFIG),
    permissions: {
      autoAllow: [],
      autoDeny: [],
      autoAsk: [],
      ...overrides,
    },
  };
}

describe('permission-handler meta', () => {
  it('has the correct name', () => {
    expect(permissionHandlerMeta.name).toBe('permission-handler');
  });

  it('hooks into PermissionRequest', () => {
    expect(permissionHandlerMeta.hookTypes).toContain('PermissionRequest');
  });

  it('belongs to security category', () => {
    expect(permissionHandlerMeta.category).toBe('security');
  });

  it('has low priority (security range)', () => {
    expect(permissionHandlerMeta.priority).toBeLessThan(100);
  });
});

describe('matchesPattern', () => {
  it('returns true for exact match', () => {
    expect(matchesPattern('Write', ['Write'])).toBe(true);
  });

  it('returns false when no patterns match', () => {
    expect(matchesPattern('Write', ['Read', 'Execute'])).toBe(false);
  });

  it('supports regex patterns', () => {
    expect(matchesPattern('Write', ['Wri.*'])).toBe(true);
  });

  it('is case-insensitive for regex', () => {
    expect(matchesPattern('Write', ['write'])).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    expect(matchesPattern('Write', ['[invalid'])).toBe(false);
  });
});

describe('resolvePermission', () => {
  it('returns deny when tool matches autoDeny', () => {
    const config = makeConfig({ autoDeny: ['rm'] });
    expect(resolvePermission('rm', config)).toBe('deny');
  });

  it('returns ask when tool matches autoAsk', () => {
    const config = makeConfig({ autoAsk: ['Write'] });
    expect(resolvePermission('Write', config)).toBe('ask');
  });

  it('returns allow when tool matches autoAllow', () => {
    const config = makeConfig({ autoAllow: ['Read'] });
    expect(resolvePermission('Read', config)).toBe('allow');
  });

  it('returns ask-user when no patterns match', () => {
    const config = makeConfig();
    expect(resolvePermission('SomeUnknownTool', config)).toBe('ask-user');
  });

  it('deny takes priority over ask', () => {
    const config = makeConfig({ autoDeny: ['Write'], autoAsk: ['Write'] });
    expect(resolvePermission('Write', config)).toBe('deny');
  });

  it('deny takes priority over allow', () => {
    const config = makeConfig({ autoDeny: ['Write'], autoAllow: ['Write'] });
    expect(resolvePermission('Write', config)).toBe('deny');
  });

  it('ask takes priority over allow', () => {
    const config = makeConfig({ autoAsk: ['Write'], autoAllow: ['Write'] });
    expect(resolvePermission('Write', config)).toBe('ask');
  });
});

describe('createHandler', () => {
  it('returns undefined for ask-user (no match)', async () => {
    const handler = createHandler('PermissionRequest');
    const config = makeConfig();
    const input = { session_id: 'test', tool_name: 'Unknown', tool_input: {}, hook_event_name: 'PreToolUse' };
    const result = await handler(input, config);
    expect(result).toBeUndefined();
  });

  it('returns allow decision with exitCode 0', async () => {
    const handler = createHandler('PermissionRequest');
    const config = makeConfig({ autoAllow: ['Read'] });
    const input = { session_id: 'test', tool_name: 'Read', tool_input: {}, hook_event_name: 'PreToolUse' };
    const result = await handler(input, config);
    expect(result).toBeDefined();
    expect(result!.exitCode).toBe(0);
    const parsed = JSON.parse(result!.stdout!) as { decision: string; message: string };
    expect(parsed.decision).toBe('allow');
    expect(parsed.message).toContain('Auto-allowed');
  });

  it('returns deny decision with exitCode 0', async () => {
    const handler = createHandler('PermissionRequest');
    const config = makeConfig({ autoDeny: ['Dangerous'] });
    const input = { session_id: 'test', tool_name: 'Dangerous', tool_input: {}, hook_event_name: 'PreToolUse' };
    const result = await handler(input, config);
    expect(result).toBeDefined();
    expect(result!.exitCode).toBe(0);
    const parsed = JSON.parse(result!.stdout!) as { decision: string; message: string };
    expect(parsed.decision).toBe('deny');
    expect(parsed.message).toContain('Auto-denied');
  });

  it('returns ask decision with exitCode 0', async () => {
    const handler = createHandler('PermissionRequest');
    const config = makeConfig({ autoAsk: ['Write'] });
    const input = { session_id: 'test', tool_name: 'Write', tool_input: {}, hook_event_name: 'PreToolUse' };
    const result = await handler(input, config);
    expect(result).toBeDefined();
    expect(result!.exitCode).toBe(0);
    const parsed = JSON.parse(result!.stdout!) as { decision: string; message: string };
    expect(parsed.decision).toBe('ask');
    expect(parsed.message).toContain('Requires user confirmation');
  });
});
