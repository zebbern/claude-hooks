import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { formatOutput } from '../../src/runtime/output-formatter.js';
import { loadEnabledHandlersAsync } from '../../src/registry/index.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import type {
  HookHandler,
  HookHandlerResult,
  HookInputBase,
  SessionEndInput,
  ToolkitConfig,
  VSCodeHookOutput,
} from '../../src/types.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-session-end-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

async function executeHandlers<T extends HookInputBase>(
  handlers: HookHandler<T>[],
  input: T,
  config: ToolkitConfig,
): Promise<{ lastResult: HookHandlerResult | undefined; stdout: string; stderr: string }> {
  let lastResult: HookHandlerResult | undefined;
  let stdout = '';
  let stderr = '';

  for (const handler of handlers) {
    const result = await handler(input, config);
    if (result !== undefined) {
      lastResult = result;
      if (result.stdout) stdout += result.stdout;
      if (result.stderr) stderr += result.stderr;
      if (result.exitCode !== 0) break;
    }
  }

  return { lastResult, stdout, stderr };
}

function makeConfig(): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    logDir: tempDir,
  };
}

const sessionEndInput: SessionEndInput = {
  session_id: 'test-session-004',
};

describe('SessionEnd hook integration', () => {
  it('loads handlers for SessionEnd hook type', async () => {
    const handlers = await loadEnabledHandlersAsync<SessionEndInput>('SessionEnd', DEFAULT_CONFIG);
    expect(handlers).toBeInstanceOf(Array);
  });

  it('processes session-end input without crashing', async () => {
    const config = makeConfig();
    const handlers = await loadEnabledHandlersAsync<SessionEndInput>('SessionEnd', config);
    const results = await executeHandlers(handlers, sessionEndInput, config);

    // SessionEnd handlers should proceed (exit 0 or no result)
    const exitCode = results.lastResult?.exitCode ?? 0;
    expect(exitCode).toBe(0);
  });

  it('formats VS Code output for SessionEnd', () => {
    const results = {
      lastResult: undefined as HookHandlerResult | undefined,
      stdout: '',
      stderr: '',
    };

    const output = formatOutput('SessionEnd', results, true);
    const parsed = JSON.parse(output) as VSCodeHookOutput;

    expect(parsed).toHaveProperty('hookSpecificOutput');
  });

  it('returns empty string for Claude Code with no output', () => {
    const results = {
      lastResult: undefined as HookHandlerResult | undefined,
      stdout: '',
      stderr: '',
    };

    const output = formatOutput('SessionEnd', results, false);
    expect(output).toBe('');
  });
});
