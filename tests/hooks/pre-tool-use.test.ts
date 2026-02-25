import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../src/runtime/output-formatter.js';
import { loadEnabledHandlersAsync } from '../../src/registry/index.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import type {
  HookHandler,
  HookHandlerResult,
  HookInputBase,
  PreToolUseInput,
  ToolkitConfig,
  VSCodeHookOutput,
} from '../../src/types.js';

/**
 * Simulates the handler execution logic from createHookRunner.
 */
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

const safeInput: PreToolUseInput = {
  session_id: 'test-session-001',
  tool_name: 'Read',
  tool_input: { file_path: 'src/index.ts' },
};

const dangerousInput: PreToolUseInput = {
  session_id: 'test-session-001',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf /' },
};

describe('PreToolUse hook integration', () => {
  it('loads handlers for PreToolUse hook type', async () => {
    const handlers = await loadEnabledHandlersAsync<PreToolUseInput>('PreToolUse', DEFAULT_CONFIG);
    expect(handlers.length).toBeGreaterThan(0);
  });

  it('allows safe read operations through the pipeline', async () => {
    const handlers = await loadEnabledHandlersAsync<PreToolUseInput>('PreToolUse', DEFAULT_CONFIG);
    const results = await executeHandlers(handlers, safeInput, DEFAULT_CONFIG);

    // Read tool should proceed (exit 0 or no result)
    const exitCode = results.lastResult?.exitCode ?? 0;
    expect(exitCode).toBe(0);
  });

  it('blocks dangerous command through command-guard', async () => {
    const handlers = await loadEnabledHandlersAsync<PreToolUseInput>('PreToolUse', DEFAULT_CONFIG);
    const results = await executeHandlers(handlers, dangerousInput, DEFAULT_CONFIG);

    expect(results.lastResult).toBeDefined();
    expect(results.lastResult!.exitCode).toBe(2);
    expect(results.stderr).toBeTruthy();
  });

  it('formats VS Code output correctly for blocked command', async () => {
    const handlers = await loadEnabledHandlersAsync<PreToolUseInput>('PreToolUse', DEFAULT_CONFIG);
    const results = await executeHandlers(handlers, dangerousInput, DEFAULT_CONFIG);

    const output = formatOutput('PreToolUse', results, true);
    const parsed = JSON.parse(output) as VSCodeHookOutput;

    expect(parsed).toHaveProperty('hookSpecificOutput');
    expect(parsed.hookSpecificOutput).toHaveProperty('permissionDecision', 'deny');
  });

  it('formats Claude Code output as raw stdout', async () => {
    const handlers = await loadEnabledHandlersAsync<PreToolUseInput>('PreToolUse', DEFAULT_CONFIG);
    const results = await executeHandlers(handlers, safeInput, DEFAULT_CONFIG);

    const output = formatOutput('PreToolUse', results, false);
    // Claude Code gets raw stdout (no JSON envelope)
    expect(output).toBe(results.stdout);
  });
});
