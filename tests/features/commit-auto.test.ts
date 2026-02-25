import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autoCommitChanges } from '../../src/features/commit-auto/index.js';
import { createHandler } from '../../src/features/commit-auto/handler.js';
import type { StopInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

const mockExecFileSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

beforeEach(() => {
  mockExecFileSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeConfig(
  messageTemplate = '',
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    autoCommit: { messageTemplate, enabled },
  };
}

function makeStopInput(sessionId = 'test-session'): StopInput {
  return {
    session_id: sessionId,
    stop_hook_active: false,
    transcript_path: '/tmp/transcript.txt',
  };
}

describe('commit-auto', () => {
  describe('autoCommitChanges', () => {
    it('skips when disabled', () => {
      const result = autoCommitChanges(makeStopInput(), makeConfig('', false));
      expect(result.committed).toBe(false);
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('skips when no uncommitted changes', () => {
      mockExecFileSync.mockReturnValue(''); // git status --porcelain returns empty
      const result = autoCommitChanges(makeStopInput(), makeConfig());
      expect(result.committed).toBe(false);
    });

    it('stages and commits changes', () => {
      mockExecFileSync
        .mockReturnValueOnce(' M src/app.ts\n') // git status --porcelain
        .mockReturnValueOnce('') // git add -A
        .mockReturnValueOnce(' src/app.ts | 5 +++++\n 1 file changed, 5 insertions(+)\n') // git diff --cached --stat
        .mockReturnValueOnce(''); // git commit

      const result = autoCommitChanges(makeStopInput(), makeConfig());
      expect(result.committed).toBe(true);
      expect(result.message).toContain('1 file modified');
    });

    it('auto-generates commit message from diff stat', () => {
      mockExecFileSync
        .mockReturnValueOnce(' M src/a.ts\n M src/b.ts\n') // git status
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce(' src/a.ts | 2 ++\n src/b.ts | 3 +++\n 2 files changed\n') // git diff --cached --stat
        .mockReturnValueOnce(''); // git commit

      const result = autoCommitChanges(makeStopInput(), makeConfig());
      expect(result.committed).toBe(true);
      expect(result.message).toContain('2 files modified');
      expect(result.message).toContain('feat(claude)');
    });

    it('uses custom messageTemplate when configured', () => {
      mockExecFileSync
        .mockReturnValueOnce(' M src/app.ts\n') // git status
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce(' src/app.ts | 5 +++++\n 1 file changed\n') // git diff
        .mockReturnValueOnce(''); // git commit

      const result = autoCommitChanges(
        makeStopInput(),
        makeConfig('chore: auto-commit {files} files'),
      );
      expect(result.committed).toBe(true);
      expect(result.message).toBe('chore: auto-commit 1 files');
    });

    it('replaces {session_id} placeholder in template', () => {
      mockExecFileSync
        .mockReturnValueOnce(' M src/app.ts\n') // git status
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce(' src/app.ts | 1 +\n 1 file changed\n') // git diff
        .mockReturnValueOnce(''); // git commit

      const result = autoCommitChanges(
        makeStopInput('my-session-123'),
        makeConfig('fix: session {session_id} changes'),
      );
      expect(result.message).toBe('fix: session my-session-123 changes');
    });

    it('handles git not available', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('git: command not found');
      });

      const result = autoCommitChanges(makeStopInput(), makeConfig());
      expect(result.committed).toBe(false);
    });

    it('handles commit failure gracefully', () => {
      mockExecFileSync
        .mockReturnValueOnce(' M src/app.ts\n') // git status
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce(' 1 file changed\n') // git diff
        .mockImplementationOnce(() => {
          throw new Error('commit failed');
        }); // git commit

      const result = autoCommitChanges(makeStopInput(), makeConfig());
      expect(result.committed).toBe(false);
    });

    it('never crashes on error', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('unexpected error');
      });

      expect(() => autoCommitChanges(makeStopInput(), makeConfig())).not.toThrow();
    });

    it('passes commit message as separate arg (no shell injection)', () => {
      mockExecFileSync
        .mockReturnValueOnce(' M src/app.ts\n')
        .mockReturnValueOnce('')
        .mockReturnValueOnce(' src/app.ts | 1 +\n 1 file changed\n')
        .mockReturnValueOnce('');

      autoCommitChanges(makeStopInput(), makeConfig('msg with "quotes" and $(cmd)'));

      // The commit call is the 4th invocation
      const commitCall = mockExecFileSync.mock.calls[3];
      expect(commitCall[0]).toBe('git');
      expect(commitCall[1]).toContain('-m');
      // Message is passed as a separate array element, not shell-interpolated
      expect(commitCall[1]).toContain('msg with "quotes" and $(cmd)');
    });
  });

  describe('createHandler', () => {
    it('returns undefined (never blocks)', async () => {
      mockExecFileSync.mockReturnValue(''); // No changes
      const handler = createHandler('Stop');
      const result = await handler(makeStopInput(), makeConfig());
      expect(result).toBeUndefined();
    });
  });
});
