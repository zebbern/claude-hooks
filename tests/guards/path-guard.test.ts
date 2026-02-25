import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { checkPathTraversal } from '../../src/guards/path-guard.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeInput(filePath: string): PreToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: 'Write',
    tool_input: { file_path: filePath },
  };
}

// Use a consistent test cwd — works cross-platform
const TEST_CWD = process.cwd();

describe('path-guard', () => {
  describe('allows paths within cwd', () => {
    it('allows relative path within cwd', () => {
      const result = checkPathTraversal(makeInput('src/index.ts'), TEST_CWD);
      expect(result.action).toBe('proceed');
    });

    it('allows nested subdirectory paths', () => {
      const result = checkPathTraversal(makeInput('src/guards/command-guard.ts'), TEST_CWD);
      expect(result.action).toBe('proceed');
    });

    it('allows path that resolves to cwd exactly', () => {
      const result = checkPathTraversal(makeInput('.'), TEST_CWD);
      expect(result.action).toBe('proceed');
    });

    it('allows absolute path within cwd', () => {
      const absolutePath = path.join(TEST_CWD, 'src', 'index.ts');
      const result = checkPathTraversal(makeInput(absolutePath), TEST_CWD);
      expect(result.action).toBe('proceed');
    });

    it('allows current directory reference', () => {
      const result = checkPathTraversal(makeInput('./package.json'), TEST_CWD);
      expect(result.action).toBe('proceed');
    });
  });

  describe('blocks paths outside cwd', () => {
    it('blocks path traversal with ../', () => {
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD);
      expect(result.action).toBe('block');
      expect(result.message).toContain('path traversal');
    });

    it('blocks absolute path outside cwd', () => {
      // Use a path guaranteed to be outside test cwd
      const outsidePath = path.resolve(TEST_CWD, '..', 'outside-project', 'file.txt');
      const result = checkPathTraversal(makeInput(outsidePath), TEST_CWD);
      expect(result.action).toBe('block');
    });

    it('blocks parent directory traversal', () => {
      const result = checkPathTraversal(makeInput('..'), TEST_CWD);
      expect(result.action).toBe('block');
    });

    it('block result includes details', () => {
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD);
      expect(result.action).toBe('block');
      expect(result.details).toBeDefined();
      expect(result.details?.filePath).toBe('../../../etc/passwd');
      expect(result.details?.projectRoot).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('proceeds for empty file_path', () => {
      const result = checkPathTraversal(makeInput(''), TEST_CWD);
      expect(result.action).toBe('proceed');
    });

    it('proceeds for non-string file_path', () => {
      const input: PreToolUseInput = {
        session_id: 'test',
        tool_name: 'Write',
        tool_input: { file_path: null as unknown as string },
      };
      const result = checkPathTraversal(input, TEST_CWD);
      expect(result.action).toBe('proceed');
    });
  });

  describe('respects config.guards.path.enabled', () => {
    it('proceeds when path guard is disabled', () => {
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        guards: {
          ...DEFAULT_CONFIG.guards,
          path: { ...DEFAULT_CONFIG.guards.path, enabled: false },
        },
      };
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD, config);
      expect(result.action).toBe('proceed');
    });

    it('blocks when enabled (default)', () => {
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD, DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks traversal when enabled is explicitly true', () => {
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        guards: {
          ...DEFAULT_CONFIG.guards,
          path: { ...DEFAULT_CONFIG.guards.path, enabled: true },
        },
      };
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD, config);
      expect(result.action).toBe('block');
    });
  });

  describe('respects allowedRoots', () => {
    it('allows path within an allowedRoot', () => {
      const parentDir = path.resolve(TEST_CWD, '..');
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        guards: {
          ...DEFAULT_CONFIG.guards,
          path: { enabled: true, allowedRoots: [parentDir] },
        },
      };
      const outsidePath = path.join(parentDir, 'some-other-project', 'file.txt');
      const result = checkPathTraversal(makeInput(outsidePath), TEST_CWD, config);
      expect(result.action).toBe('proceed');
    });

    it('blocks path not in cwd or allowedRoots', () => {
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        guards: {
          ...DEFAULT_CONFIG.guards,
          path: { enabled: true, allowedRoots: [path.resolve(TEST_CWD, 'subdir')] },
        },
      };
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD, config);
      expect(result.action).toBe('block');
    });

    it('allows without config argument (backward compat)', () => {
      // When no config is passed, paths within cwd should proceed
      const result = checkPathTraversal(makeInput('src/index.ts'), TEST_CWD);
      expect(result.action).toBe('proceed');
    });

    it('blocks without config argument for paths outside cwd', () => {
      const result = checkPathTraversal(makeInput('../../../etc/passwd'), TEST_CWD);
      expect(result.action).toBe('block');
    });

    it('allows path when matching any of multiple allowedRoots', () => {
      const root1 = path.resolve(TEST_CWD, '..', 'project-a');
      const root2 = path.resolve(TEST_CWD, '..', 'project-b');
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        guards: {
          ...DEFAULT_CONFIG.guards,
          path: { enabled: true, allowedRoots: [root1, root2] },
        },
      };
      const targetPath = path.join(root2, 'src', 'index.ts');
      const result = checkPathTraversal(makeInput(targetPath), TEST_CWD, config);
      expect(result.action).toBe('proceed');
    });

    it('blocks sibling directory whose name shares a prefix with allowedRoot', () => {
      const root = path.resolve(TEST_CWD, '..', 'project');
      const config: ToolkitConfig = {
        ...DEFAULT_CONFIG,
        guards: {
          ...DEFAULT_CONFIG.guards,
          path: { enabled: true, allowedRoots: [root] },
        },
      };
      // project-evil is NOT inside /project — only shares a string prefix
      const evilPath = path.resolve(TEST_CWD, '..', 'project-evil', 'file.txt');
      const result = checkPathTraversal(makeInput(evilPath), TEST_CWD, config);
      expect(result.action).toBe('block');
    });
  });

  describe('startsWith boundary safety', () => {
    it('blocks sibling directory whose name shares a prefix with cwd', () => {
      // Given cwd is /project, /project-evil/file.txt must be blocked
      const parentDir = path.resolve(TEST_CWD, '..');
      const cwdDir = path.join(parentDir, 'project');
      const evilPath = path.join(parentDir, 'project-evil', 'file.txt');
      const result = checkPathTraversal(makeInput(evilPath), cwdDir);
      expect(result.action).toBe('block');
    });

    it('allows path in subdirectory of cwd', () => {
      const parentDir = path.resolve(TEST_CWD, '..');
      const cwdDir = path.join(parentDir, 'project');
      const safePath = path.join(cwdDir, 'subdir', 'file.txt');
      const result = checkPathTraversal(makeInput(safePath), cwdDir);
      expect(result.action).toBe('proceed');
    });
  });
});
