import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolkitConfig, HookHandler, HookInputBase } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config-defaults.js';

// Mock the three dependencies that runHook composes
vi.mock('../../src/config.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../src/registry/index.js', () => ({
  loadEnabledHandlersAsync: vi.fn(),
}));

vi.mock('../../src/runtime/index.js', () => ({
  createHookRunner: vi.fn(),
}));

// Import after mocking
const { loadConfig } = await import('../../src/config.js');
const { loadEnabledHandlersAsync } = await import('../../src/registry/index.js');
const { createHookRunner } = await import('../../src/runtime/index.js');
const { runHook } = await import('../../src/hooks/run-hook.js');

describe('runHook', () => {
  const mockConfig = structuredClone(DEFAULT_CONFIG) as ToolkitConfig;
  const mockHandlers: HookHandler<HookInputBase>[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue(mockConfig);
    vi.mocked(loadEnabledHandlersAsync).mockResolvedValue(mockHandlers);
  });

  it('loads config via loadConfig', async () => {
    await runHook('PreToolUse');
    expect(loadConfig).toHaveBeenCalledOnce();
  });

  it('passes hookType and config to loadEnabledHandlersAsync', async () => {
    await runHook('PostToolUse');
    expect(loadEnabledHandlersAsync).toHaveBeenCalledWith('PostToolUse', mockConfig);
  });

  it('calls createHookRunner with hookType, handlers, and config', async () => {
    await runHook('SessionStart');
    expect(createHookRunner).toHaveBeenCalledWith('SessionStart', mockHandlers, mockConfig);
  });

  it('works for different hook types', async () => {
    await runHook('PermissionRequest');
    expect(loadConfig).toHaveBeenCalledOnce();
    expect(loadEnabledHandlersAsync).toHaveBeenCalledWith('PermissionRequest', mockConfig);
    expect(createHookRunner).toHaveBeenCalledWith('PermissionRequest', mockHandlers, mockConfig);
  });
});
