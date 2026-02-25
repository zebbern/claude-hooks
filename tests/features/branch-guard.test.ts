import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkBranch, _resetBranchCache } from '../../src/features/branch-guard/handler.js';
import { createHandler } from '../../src/features/branch-guard/handler.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import * as fs from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const mockReadFileSync = vi.fn();
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: mockReadFileSync,
    },
    readFileSync: mockReadFileSync,
  };
});

function makeConfig(
  protectedBranches = ['main', 'master', 'production', 'release/*'],
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    guards: {
      ...DEFAULT_CONFIG.guards,
      branch: { protectedBranches, enabled },
    },
  };
}

function makeInput(toolName: string, toolInput: Record<string, unknown> = {}): PreToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: toolInput,
  };
}

describe('branch-guard', () => {
  beforeEach(() => {
    _resetBranchCache();
    vi.mocked(fs.readFileSync).mockReset();
  });

  afterEach(() => {
    _resetBranchCache();
  });

  describe('checkBranch', () => {
    it('proceeds for non-write tools (e.g., Read, Glob)', () => {
      const result = checkBranch(makeInput('Read'), makeConfig());
      expect(result.action).toBe('proceed');
    });

    it('proceeds when disabled', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/main\n');
      const result = checkBranch(makeInput('Write'), makeConfig(['main'], false));
      expect(result.action).toBe('proceed');
    });

    it('proceeds when not on a protected branch', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/feature/my-branch\n');
      const result = checkBranch(makeInput('Write'), makeConfig());
      expect(result.action).toBe('proceed');
    });

    it('blocks when on main branch', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/main\n');
      const result = checkBranch(makeInput('Write'), makeConfig());
      expect(result.action).toBe('block');
      expect(result.message).toContain('main');
    });

    it('blocks when on master branch', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/master\n');
      const result = checkBranch(makeInput('Edit'), makeConfig());
      expect(result.action).toBe('block');
      expect(result.message).toContain('master');
    });

    it('blocks when branch matches wildcard release/*', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/release/v1.0\n');
      const result = checkBranch(makeInput('MultiEdit'), makeConfig());
      expect(result.action).toBe('block');
      expect(result.message).toContain('release/v1.0');
    });

    it('proceeds when .git/HEAD is not readable', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const result = checkBranch(makeInput('Write'), makeConfig());
      expect(result.action).toBe('proceed');
    });

    it('handles detached HEAD (returns hash)', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('abc123def456\n');
      const result = checkBranch(makeInput('Write'), makeConfig());
      // A commit hash won't match typical branch patterns
      expect(result.action).toBe('proceed');
    });

    it('respects custom protectedBranches config', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/staging\n');
      const result = checkBranch(makeInput('Write'), makeConfig(['staging', 'deploy/*']));
      expect(result.action).toBe('block');
      expect(result.message).toContain('staging');
    });

    it('applies to Bash tool', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/main\n');
      const result = checkBranch(makeInput('Bash'), makeConfig());
      expect(result.action).toBe('block');
    });
  });

  describe('createHandler', () => {
    it('returns block result for protected branch', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/main\n');
      const handler = createHandler('PreToolUse');
      const result = await handler(makeInput('Write'), makeConfig());
      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(2);
      expect(result!.stderr).toContain('main');
    });

    it('returns undefined for safe branch', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('ref: refs/heads/feature/safe\n');
      const handler = createHandler('PreToolUse');
      const result = await handler(makeInput('Write'), makeConfig());
      expect(result).toBeUndefined();
    });
  });
});
