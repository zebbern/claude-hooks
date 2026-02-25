import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
  HookEventType,
  HookHandler,
  HookInputBase,
  PostToolUseInput,
  ToolkitConfig,
  ValidatorResult,
} from '../../types.js';
import { isExecSyncError } from '../../runtime/exec-utils.js';
import { WRITE_TOOLS } from '../../utils/tool-inputs.js';

/**
 * Auto-detects the project's test runner by checking for config files.
 *
 * Detection priority:
 * 1. `vitest.config.ts` / `vitest.config.js` → `npx vitest run`
 * 2. `jest.config.ts` / `jest.config.js` / `jest` key in package.json → `npx jest`
 * 3. `pytest.ini` / `pyproject.toml` with `[tool.pytest]` → `python -m pytest`
 *
 * @param projectDir - Directory to scan. Defaults to `process.cwd()`.
 * @returns The detected test command, or an empty string if none found.
 */
export function detectTestRunner(projectDir?: string): string {
  const dir = projectDir ?? process.cwd();

  try {
    // Vitest
    if (
      fs.existsSync(path.join(dir, 'vitest.config.ts')) ||
      fs.existsSync(path.join(dir, 'vitest.config.js'))
    ) {
      return 'npx vitest run';
    }

    // Jest
    if (
      fs.existsSync(path.join(dir, 'jest.config.ts')) ||
      fs.existsSync(path.join(dir, 'jest.config.js'))
    ) {
      return 'npx jest';
    }

    // Jest via package.json
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (typeof pkg === 'object' && pkg !== null && 'jest' in pkg) {
          return 'npx jest';
        }
      } catch {
        // Skip malformed package.json
      }
    }

    // Pytest
    if (fs.existsSync(path.join(dir, 'pytest.ini'))) {
      return 'python -m pytest';
    }

    const pyprojectPath = path.join(dir, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        if (content.includes('[tool.pytest]')) {
          return 'python -m pytest';
        }
      } catch {
        // Skip unreadable file
      }
    }
  } catch {
    // Best-effort detection
  }

  return '';
}

/**
 * Runs the project's test suite and returns the result.
 *
 * Uses auto-detection or the configured command. Returns a passing result if
 * no test runner is available. Errors are handled gracefully — never crashes.
 *
 * @param input - The PostToolUse hook input.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link ValidatorResult} indicating pass/fail.
 */
export function runTestValidator(input: PostToolUseInput, config: ToolkitConfig): ValidatorResult {
  if (!config.validators.test.enabled) {
    return { passed: true, output: 'Test validator disabled', command: '', exitCode: 0 };
  }

  if (!WRITE_TOOLS.has(input.tool_name)) {
    return { passed: true, output: 'Skipped: not a write tool', command: '', exitCode: 0 };
  }

  const command = config.validators.test.command || detectTestRunner();
  if (!command) {
    return { passed: true, output: 'No test runner detected', command: '', exitCode: 0 };
  }

  const timeout = config.validators.test.timeout || 60_000;

  try {
    const parts = command.split(/\s+/).filter(Boolean);
    const executable = parts[0];
    if (!executable) {
      return { passed: true, output: 'No test command to execute', command: '', exitCode: 0 };
    }
    const output = execFileSync(executable, parts.slice(1), {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { passed: true, output: output.trim(), command, exitCode: 0 };
  } catch (err: unknown) {
    if (isExecSyncError(err)) {
      // Command not found — graceful degradation
      if (err.status === 127 || (err.stderr && /not found|not recognized/i.test(err.stderr))) {
        return { passed: true, output: 'Test runner not available', command, exitCode: 0 };
      }
      const output = [err.stdout ?? '', err.stderr ?? ''].filter(Boolean).join('\n').trim();
      return { passed: false, output: output || 'Tests failed', command, exitCode: err.status ?? 1 };
    }
    return { passed: true, output: 'Test runner not available', command, exitCode: 0 };
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    try {
      const postInput = input as PostToolUseInput;
      if (!WRITE_TOOLS.has(postInput.tool_name)) {
        return undefined;
      }

      const result = runTestValidator(postInput, config);
      if (!result.passed) {
        return { exitCode: 1, stderr: `Tests failed:\n${result.output}` };
      }
      return undefined;
    } catch {
      // Best-effort — never crash the hook
      return undefined;
    }
  };
}
