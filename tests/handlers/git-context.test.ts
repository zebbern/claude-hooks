import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGitContext, getGitContextAsync } from '../../src/handlers/git-context.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let execFileSyncMock: ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let execFileMock: ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let readFileSyncMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const cp = await import('node:child_process');
  const fs = await import('node:fs');
  execFileSyncMock = cp.execFileSync as ReturnType<typeof vi.fn>;
  execFileMock = cp.execFile as unknown as ReturnType<typeof vi.fn>;
  readFileSyncMock = fs.readFileSync as ReturnType<typeof vi.fn>;
  execFileSyncMock.mockReset();
  execFileMock.mockReset();
  readFileSyncMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('git-context (sync)', () => {
  it('returns string with branch info', () => {
    execFileSyncMock.mockImplementation((_cmd: string, args: string[]) => {
      const joined = args.join(' ');
      if (joined.includes('rev-parse --abbrev-ref HEAD')) return 'main\n';
      if (joined.includes('status --porcelain')) return 'M src/index.ts\nA src/new.ts\n';
      if (joined.includes('log --oneline -5')) return 'abc1234 feat: add feature\ndef5678 fix: bug fix\n';
      return '';
    });

    const result = getGitContext();
    expect(result).toContain('Branch: main');
    expect(result).toContain('Working tree changes: 2 file(s)');
    expect(result).toContain('Recent commits:');
    expect(result).toContain('abc1234 feat: add feature');
  });

  it('returns "Git context unavailable" when not in git repo', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });

    const result = getGitContext();
    expect(result).toBe('Git context unavailable');
  });

  it('never throws', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('Some unexpected error');
    });

    expect(() => getGitContext()).not.toThrow();
  });

  it('handles partial git availability (no log)', () => {
    execFileSyncMock.mockImplementation((_cmd: string, args: string[]) => {
      const joined = args.join(' ');
      if (joined.includes('rev-parse')) return 'develop\n';
      if (joined.includes('status')) return '\n';
      throw new Error('No log');
    });

    const result = getGitContext();
    expect(result).toContain('Branch: develop');
  });

  it('handles empty status (clean working tree)', () => {
    execFileSyncMock.mockImplementation((_cmd: string, args: string[]) => {
      const joined = args.join(' ');
      if (joined.includes('rev-parse')) return 'main\n';
      if (joined.includes('status')) return '';
      if (joined.includes('log')) return 'abc feat: init\n';
      return '';
    });

    const result = getGitContext();
    expect(result).toContain('Working tree changes: 0 file(s)');
  });
});

describe('git-context (async)', () => {
  /** Helper: make the async execFile mock resolve with the given stdout. */
  function mockExecFile(handler: (_cmd: string, args: string[]) => string) {
    execFileMock.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb?: Function) => {
        // node:child_process.execFile can be called with (cmd, args, opts, cb)
        // When promisified, util.promisify turns the cb-style into a promise.
        // In vitest with the mock, promisify will call our mock which should
        // support the callback pattern.
        const callback = typeof _opts === 'function' ? _opts : cb;
        try {
          const stdout = handler(_cmd, args);
          if (callback) {
            process.nextTick(() => callback(null, { stdout }));
          }
        } catch (err) {
          if (callback) {
            process.nextTick(() => callback(err));
          }
        }
        return { stdout: '', stderr: '' };
      },
    );
  }

  it('reads branch from .git/HEAD and runs status+log concurrently', async () => {
    readFileSyncMock.mockReturnValue('ref: refs/heads/feature/fast-git\n');
    mockExecFile((_cmd: string, args: string[]) => {
      const joined = args.join(' ');
      if (joined.includes('status --porcelain')) return 'M handler.ts\n';
      if (joined.includes('log --oneline -5')) return 'aaa1111 feat: speed\n';
      return '';
    });

    const result = await getGitContextAsync();
    expect(result).toContain('Branch: feature/fast-git');
    expect(result).toContain('Working tree changes: 1 file(s)');
    expect(result).toContain('aaa1111 feat: speed');
  });

  it('handles detached HEAD (bare commit hash)', async () => {
    readFileSyncMock.mockReturnValue('a'.repeat(40) + '\n');
    mockExecFile(() => '');

    const result = await getGitContextAsync();
    expect(result).toContain('Branch: aaaaaaa');
  });

  it('returns "Git context unavailable" when .git/HEAD is missing and git fails', async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    mockExecFile(() => {
      throw new Error('not a git repo');
    });

    const result = await getGitContextAsync();
    expect(result).toBe('Git context unavailable');
  });

  it('never throws even on unexpected errors', async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('unexpected');
    });
    mockExecFile(() => {
      throw new Error('unexpected');
    });

    await expect(getGitContextAsync()).resolves.not.toThrow();
  });

  it('handles partial failure (status succeeds, log fails)', async () => {
    readFileSyncMock.mockReturnValue('ref: refs/heads/main\n');
    mockExecFile((_cmd: string, args: string[]) => {
      const joined = args.join(' ');
      if (joined.includes('status --porcelain')) return 'M file.ts\nA new.ts\n';
      throw new Error('log failed');
    });

    const result = await getGitContextAsync();
    expect(result).toContain('Branch: main');
    expect(result).toContain('Working tree changes: 2 file(s)');
    expect(result).not.toContain('Recent commits:');
  });
});
