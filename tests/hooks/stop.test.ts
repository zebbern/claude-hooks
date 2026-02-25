import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../src/runtime/output-formatter.js';
import type { HookHandler, HookHandlerResult, HookInputBase, StopInput, ToolkitConfig, VSCodeHookOutput } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function parseOutput(raw: string): VSCodeHookOutput {
  return JSON.parse(raw) as VSCodeHookOutput;
}

function makeResults(overrides: {
  exitCode?: 0 | 1 | 2;
  stdout?: string;
  stderr?: string;
} = {}): { lastResult: HookHandlerResult | undefined; stdout: string; stderr: string } {
  const exitCode = overrides.exitCode ?? 0;
  return {
    lastResult: { exitCode, stdout: overrides.stdout, stderr: overrides.stderr },
    stdout: overrides.stdout ?? '',
    stderr: overrides.stderr ?? '',
  };
}

/**
 * Simulates the handler execution logic from createHookRunner
 * for testing Stop hook blocking behavior.
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

const stopInput: StopInput = {
  session_id: 'test-session-123',
  stop_hook_active: true,
  transcript_path: '/tmp/transcript.json',
};

describe('Stop hook blocking', () => {
  describe('no blocking features → allows (exit 0)', () => {
    it('allows stop when no handlers return results', async () => {
      const handlers: HookHandler<StopInput>[] = [
        async () => undefined,
      ];
      const result = await executeHandlers(handlers, stopInput, DEFAULT_CONFIG);
      expect(result.lastResult).toBeUndefined();
    });

    it('allows stop when all handlers return exitCode 0', async () => {
      const handlers: HookHandler<StopInput>[] = [
        async () => ({ exitCode: 0 }),
        async () => ({ exitCode: 0, stdout: 'ok' }),
      ];
      const result = await executeHandlers(handlers, stopInput, DEFAULT_CONFIG);
      expect(result.lastResult?.exitCode).toBe(0);
    });

    it('formats VS Code output with continue=true when allowed', () => {
      const results = makeResults({});
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.continue).toBe(true);
      expect(output.hookSpecificOutput?.hookEventName).toBe('Stop');
      expect(output.hookSpecificOutput?.decision).toBeUndefined();
    });
  });

  describe('blocking feature → blocks (exit 2) with reason', () => {
    it('blocks stop when a handler returns exitCode 2', async () => {
      const handlers: HookHandler<StopInput>[] = [
        async () => ({
          exitCode: 2 as const,
          stderr: 'Unsaved changes detected. Please save before stopping.',
        }),
      ];
      const result = await executeHandlers(handlers, stopInput, DEFAULT_CONFIG);
      expect(result.lastResult?.exitCode).toBe(2);
      expect(result.stderr).toBe('Unsaved changes detected. Please save before stopping.');
    });

    it('formats VS Code block output with hookSpecificOutput.decision', () => {
      const results = makeResults({
        exitCode: 2,
        stderr: 'Unsaved changes detected. Please save before stopping.',
      });
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.continue).toBe(false);
      expect(output.stopReason).toBe('Unsaved changes detected. Please save before stopping.');
      expect(output.hookSpecificOutput?.decision).toBe('block');
      expect(output.hookSpecificOutput?.reason).toBe('Unsaved changes detected. Please save before stopping.');
    });

    it('extracts reason from stdout JSON reason field', () => {
      const results = makeResults({
        exitCode: 2,
        stdout: JSON.stringify({
          decision: 'block',
          reason: 'Tests are still failing. Fix before stopping.',
        }),
      });
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.hookSpecificOutput?.decision).toBe('block');
      expect(output.hookSpecificOutput?.reason).toBe('Tests are still failing. Fix before stopping.');
    });

    it('extracts reason from stdout JSON message field when reason is absent', () => {
      const results = makeResults({
        exitCode: 2,
        stdout: JSON.stringify({
          message: 'Build failed. Cannot stop.',
        }),
      });
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.hookSpecificOutput?.decision).toBe('block');
      expect(output.hookSpecificOutput?.reason).toBe('Build failed. Cannot stop.');
    });

    it('falls back to stderr when stdout has no reason or message', () => {
      const results = makeResults({
        exitCode: 2,
        stderr: 'Lint errors remain',
      });
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.hookSpecificOutput?.reason).toBe('Lint errors remain');
    });

    it('uses default message when no reason source available', () => {
      const results = makeResults({ exitCode: 2 });
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.hookSpecificOutput?.decision).toBe('block');
      expect(output.hookSpecificOutput?.reason).toBe('Operation blocked by hook');
    });

    it('blocks via stdout decision even without exitCode 2', () => {
      const results = makeResults({
        exitCode: 0,
        stdout: JSON.stringify({
          decision: 'block',
          reason: 'Uncommitted changes detected.',
        }),
      });
      const output = parseOutput(formatOutput('Stop', results, true));
      expect(output.continue).toBe(false);
      expect(output.hookSpecificOutput?.decision).toBe('block');
      expect(output.hookSpecificOutput?.reason).toBe('Uncommitted changes detected.');
    });
  });

  describe('multiple features: one blocks → entire hook blocks', () => {
    it('stops at first blocking handler (most restrictive wins)', async () => {
      const executionOrder: string[] = [];
      const handlers: HookHandler<StopInput>[] = [
        async () => {
          executionOrder.push('handler-1');
          return { exitCode: 0 as const };
        },
        async () => {
          executionOrder.push('handler-2-blocks');
          return {
            exitCode: 2 as const,
            stderr: 'Cannot stop: tests failing',
          };
        },
        async () => {
          executionOrder.push('handler-3-should-not-run');
          return { exitCode: 0 as const };
        },
      ];
      const result = await executeHandlers(handlers, stopInput, DEFAULT_CONFIG);
      expect(result.lastResult?.exitCode).toBe(2);
      expect(executionOrder).toEqual(['handler-1', 'handler-2-blocks']);
      expect(executionOrder).not.toContain('handler-3-should-not-run');
    });

    it('allows when all handlers pass', async () => {
      const handlers: HookHandler<StopInput>[] = [
        async () => ({ exitCode: 0 as const, stdout: 'summary generated' }),
        async () => ({ exitCode: 0 as const }),
        async () => ({ exitCode: 0 as const, stdout: 'committed' }),
      ];
      const result = await executeHandlers(handlers, stopInput, DEFAULT_CONFIG);
      expect(result.lastResult?.exitCode).toBe(0);
    });

    it('formats the blocking reason from the blocking handler', async () => {
      const handlers: HookHandler<StopInput>[] = [
        async () => ({ exitCode: 0 as const }),
        async () => ({
          exitCode: 2 as const,
          stdout: JSON.stringify({ decision: 'block', reason: 'Pending TODO items remain' }),
        }),
      ];
      const result = await executeHandlers(handlers, stopInput, DEFAULT_CONFIG);

      const output = parseOutput(formatOutput('Stop', result, true));
      expect(output.continue).toBe(false);
      expect(output.hookSpecificOutput?.decision).toBe('block');
      expect(output.hookSpecificOutput?.reason).toBe('Pending TODO items remain');
    });
  });

  describe('Claude Code passthrough (non-VS Code)', () => {
    it('returns raw stdout for Claude Code when allowed', () => {
      const results = makeResults({ stdout: 'session ended' });
      const output = formatOutput('Stop', results, false);
      expect(output).toBe('session ended');
    });

    it('returns raw stdout for Claude Code when blocked', () => {
      const results = makeResults({
        exitCode: 2,
        stdout: JSON.stringify({ decision: 'block', reason: 'Cannot stop yet' }),
      });
      const output = formatOutput('Stop', results, false);
      expect(output).toBe(JSON.stringify({ decision: 'block', reason: 'Cannot stop yet' }));
    });
  });
});
