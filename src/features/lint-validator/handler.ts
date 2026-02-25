import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { ValidatorResult, ToolkitConfig, PostToolUseInput, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { isExecSyncError } from '../../runtime/exec-utils.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);

/**
 * Runs ESLint on a single file and returns the result.
 *
 * Only processes files with supported extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`).
 * Gracefully skips if ESLint is not installed (exit code 127 or "not found" in stderr).
 *
 * @param filePath - Absolute path to the file to lint.
 * @param config - The resolved toolkit configuration (uses `validators.lint.command` and `enabled`).
 * @returns A {@link ValidatorResult} indicating pass/fail, command output, and exit code.
 */
export function runLintValidator(filePath: string, config: ToolkitConfig): ValidatorResult {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { passed: true, output: `Skipped: unsupported extension ${ext}`, command: '', exitCode: 0 };
  }

  if (!config.validators.lint.enabled) {
    return { passed: true, output: 'Lint validator disabled', command: '', exitCode: 0 };
  }

  const commandStr = config.validators.lint.command;
  const parts = commandStr.split(/\s+/);
  const cmd = parts[0];
  if (!cmd) {
    return { passed: true, output: 'No lint command configured', command: '', exitCode: 0 };
  }
  const cmdArgs = parts.slice(1);
  const fullArgs = [...cmdArgs, filePath];
  const command = `${commandStr} ${filePath}`;

  try {
    const output = execFileSync(cmd, fullArgs, {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { passed: true, output: output.trim(), command, exitCode: 0 };
  } catch (err: unknown) {
    if (isExecSyncError(err)) {
      // Command not found — graceful degradation
      if (err.status === 127 || (err.stderr && /not found|not recognized/i.test(err.stderr))) {
        return { passed: true, output: 'Linter not available', command, exitCode: 0 };
      }
      const output = [err.stdout ?? '', err.stderr ?? ''].filter(Boolean).join('\n').trim();
      return { passed: false, output: output || 'Lint check failed', command, exitCode: err.status ?? 1 };
    }
    return { passed: true, output: 'Linter not available', command, exitCode: 0 };
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const postInput = input as PostToolUseInput;
    if (!WRITE_TOOLS.has(postInput.tool_name)) {
      return undefined;
    }

    const filePath = typeof postInput.tool_input.file_path === 'string' ? postInput.tool_input.file_path : '';
    if (!filePath) {
      return undefined;
    }

    const result = runLintValidator(filePath, config);
    if (!result.passed) {
      return { exitCode: 2, stderr: `Lint failed for ${filePath}:\n${result.output}` };
    }
    return undefined;
  };
}
