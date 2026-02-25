import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ValidatorResult, ToolkitConfig, PostToolUseInput, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { isExecSyncError } from '../../runtime/exec-utils.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';

/**
 * Runs `tsc --noEmit` to verify TypeScript compilation.
 *
 * Skips automatically if `validators.typecheck.enabled` is `false`, no `tsconfig.json`
 * exists in the current working directory, or TypeScript is not installed.
 *
 * @param config - The resolved toolkit configuration (uses `validators.typecheck.command` and `enabled`).
 * @returns A {@link ValidatorResult} indicating pass/fail, compiler output, and exit code.
 */
export function runTypecheckValidator(config: ToolkitConfig): ValidatorResult {
  if (!config.validators.typecheck.enabled) {
    return { passed: true, output: 'Typecheck validator disabled', command: '', exitCode: 0 };
  }

  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return { passed: true, output: 'No tsconfig.json found, skipping typecheck', command: '', exitCode: 0 };
  }

  const command = config.validators.typecheck.command;
  const parts = command.split(/\s+/);
  const cmd = parts[0];
  if (!cmd) {
    return { passed: true, output: 'No typecheck command configured', command: '', exitCode: 0 };
  }
  const cmdArgs = parts.slice(1);

  try {
    const output = execFileSync(cmd, cmdArgs, {
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { passed: true, output: output.trim(), command, exitCode: 0 };
  } catch (err: unknown) {
    if (isExecSyncError(err)) {
      if (err.status === 127 || (err.stderr && /not found|not recognized/i.test(err.stderr))) {
        return { passed: true, output: 'TypeScript compiler not available', command, exitCode: 0 };
      }
      const output = [err.stdout ?? '', err.stderr ?? ''].filter(Boolean).join('\n').trim();
      return { passed: false, output: output || 'Typecheck failed', command, exitCode: err.status ?? 1 };
    }
    return { passed: true, output: 'TypeScript compiler not available', command, exitCode: 0 };
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const postInput = input as PostToolUseInput;
    if (!WRITE_TOOLS.has(postInput.tool_name)) {
      return undefined;
    }

    const result = runTypecheckValidator(config);
    if (!result.passed) {
      return { exitCode: 2, stderr: `Typecheck failed:\n${result.output}` };
    }
    return undefined;
  };
}
