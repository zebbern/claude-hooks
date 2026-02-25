import { execFileSync } from 'node:child_process';
import type {
  HookEventType,
  HookHandler,
  HookInputBase,
  StopInput,
  ToolkitConfig,
} from '../../types.js';

interface AutoCommitResult {
  committed: boolean;
  message?: string;
}

function runGitCommand(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf-8',
    timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function hasUncommittedChanges(): boolean {
  const status = runGitCommand(['status', '--porcelain']);
  return status.length > 0;
}

function getChangedFileCount(): number {
  try {
    const stat = runGitCommand(['diff', '--cached', '--stat']);
    if (!stat) return 0;
    const lines = stat.trim().split('\n');
    // Last line is summary like "3 files changed, ..."; file entries are above
    return Math.max(0, lines.length - 1);
  } catch {
    return 0;
  }
}

function buildCommitMessage(
  input: StopInput,
  config: ToolkitConfig,
  fileCount: number,
): string {
  const template = config.autoCommit.messageTemplate;

  if (template) {
    return template
      .replace('{files}', String(fileCount))
      .replace('{session_id}', input.session_id);
  }

  return `feat(claude): session changes — ${fileCount} file${fileCount !== 1 ? 's' : ''} modified`;
}

/**
 * Automatically stages and commits all changes with a generated message.
 *
 * Runs `git status --porcelain` to check for changes, stages with `git add -A`,
 * and commits with a conventional commit message. Supports a custom template
 * with `{files}` and `{session_id}` placeholders.
 *
 * @param input - The Stop hook input.
 * @param config - The resolved toolkit configuration.
 * @returns Result indicating whether a commit was made and the message used.
 */
export function autoCommitChanges(
  input: StopInput,
  config: ToolkitConfig,
): AutoCommitResult {
  if (!config.autoCommit.enabled) {
    return { committed: false };
  }

  try {
    if (!hasUncommittedChanges()) {
      return { committed: false };
    }

    runGitCommand(['add', '-A']);

    const fileCount = getChangedFileCount();
    const message = buildCommitMessage(input, config, fileCount);

    runGitCommand(['commit', '-m', message]);

    return { committed: true, message };
  } catch {
    // Git not available or command failed — skip silently
    return { committed: false };
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    try {
      autoCommitChanges(input as StopInput, config);
      return undefined;
    } catch {
      // Best-effort — never crash the hook
      return undefined;
    }
  };
}
