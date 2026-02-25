import { execFile as execFileCb, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { HookEventType, HookHandler, HookInputBase } from '../../types.js';

const execFileAsync = promisify(execFileCb);

const GIT_TIMEOUT_MS = 5_000;

function runGitCommandSync(args: string): string | null {
  try {
    return execFileSync('git', args.split(' '), {
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

async function runGitCommandAsync(args: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args.split(' '), {
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Reads the current branch name directly from `.git/HEAD` without spawning
 * a child process.  Handles both symbolic refs (`ref: refs/heads/…`) and
 * detached HEAD (bare commit hash).
 *
 * @returns The branch name, a short hash for detached HEAD, or `null` on failure.
 */
function readBranchFromGitHead(): string | null {
  try {
    const head = readFileSync('.git/HEAD', 'utf-8').trim();
    if (head.startsWith('ref: refs/heads/')) {
      return head.slice('ref: refs/heads/'.length);
    }
    // Detached HEAD — return short hash (matches `git rev-parse --short`)
    if (/^[0-9a-f]{40,64}$/i.test(head)) {
      return head.slice(0, 7);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Assembles a human-readable git context string from branch, status, and log
 * fragments.
 */
function buildContextString(
  branch: string | null,
  status: string | null,
  log: string | null,
): string {
  const lines: string[] = [];

  if (branch) {
    lines.push(`Branch: ${branch}`);
  }

  if (status !== null) {
    const changeCount = status
      .split('\n')
      .filter((line) => line.trim().length > 0).length;
    lines.push(`Working tree changes: ${changeCount} file(s)`);
  }

  if (log) {
    lines.push('Recent commits:');
    for (const line of log.split('\n')) {
      if (line.trim()) {
        lines.push(`  ${line.trim()}`);
      }
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Git context unavailable';
}

/**
 * Collects git branch, working-tree status, and recent commits asynchronously.
 *
 * - Branch is read from `.git/HEAD` (no child process).
 * - `git status` and `git log` run concurrently via `Promise.all`.
 *
 * @returns A multi-line string with branch, change count, and recent commits.
 */
export async function getGitContextAsync(): Promise<string> {
  try {
    const branch = readBranchFromGitHead();

    const [status, log] = await Promise.all([
      runGitCommandAsync('status --porcelain'),
      runGitCommandAsync('log --oneline -5'),
    ]);

    return buildContextString(branch, status, log);
  } catch {
    return 'Git context unavailable';
  }
}

/**
 * Collects git branch, working-tree status, and recent commits (synchronous).
 *
 * Runs `git rev-parse`, `git status --porcelain`, and `git log --oneline -5`
 * sequentially.  Returns a human-readable string suitable for injection as
 * additional context.  Returns `'Git context unavailable'` if git commands fail.
 *
 * @deprecated Prefer {@link getGitContextAsync} for better performance
 *   (~3× faster on Windows due to concurrent child processes).
 * @returns A multi-line string with branch, change count, and recent commits.
 */
export function getGitContext(): string {
  const branch = runGitCommandSync('rev-parse --abbrev-ref HEAD');
  const status = runGitCommandSync('status --porcelain');
  const log = runGitCommandSync('log --oneline -5');
  return buildContextString(branch, status, log);
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async () => {
    const gitContext = await getGitContextAsync();
    return {
      exitCode: 0,
      stdout: JSON.stringify({ additionalContext: gitContext }),
    };
  };
}
