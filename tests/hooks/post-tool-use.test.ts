import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../src/runtime/output-formatter.js';
import { loadEnabledHandlersAsync } from '../../src/registry/index.js';
import { DEFAULT_CONFIG } from '../../src/config.js';
import type {
  HookHandler,
  HookHandlerResult,
  HookInputBase,
  PostToolUseInput,
  ToolkitConfig,
  VSCodeHookOutput,
} from '../../src/types.js';

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

const postToolInput: PostToolUseInput = {
  session_id: 'test-session-002',
  tool_name: 'Write',
  tool_input: { file_path: '/tmp/test.ts', content: 'console.log("hello")' },
  tool_output: '{"success":true}',
};

describe('PostToolUse hook integration', () => {
  it('loads handlers for PostToolUse hook type', async () => {
    const handlers = await loadEnabledHandlersAsync<PostToolUseInput>('PostToolUse', DEFAULT_CONFIG);
    expect(handlers).toBeInstanceOf(Array);
  });

  it('processes post-tool-use input without crashing', async () => {
    const handlers = await loadEnabledHandlersAsync<PostToolUseInput>('PostToolUse', DEFAULT_CONFIG);
    const results = await executeHandlers(handlers, postToolInput, DEFAULT_CONFIG);

    // PostToolUse handlers should not block (exit 0 or no result)
    const exitCode = results.lastResult?.exitCode ?? 0;
    expect(exitCode).toBeLessThanOrEqual(1);
  });

  it('formats VS Code output for PostToolUse', () => {
    const results = {
      lastResult: undefined as HookHandlerResult | undefined,
      stdout: '',
      stderr: '',
    };

    const output = formatOutput('PostToolUse', results, true);
    const parsed = JSON.parse(output) as VSCodeHookOutput;

    expect(parsed).toHaveProperty('hookSpecificOutput');
  });

  it('returns empty string for Claude Code with no output', () => {
    const results = {
      lastResult: undefined as HookHandlerResult | undefined,
      stdout: '',
      stderr: '',
    };

    const output = formatOutput('PostToolUse', results, false);
    expect(output).toBe('');
  });
});
