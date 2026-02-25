import { describe, it, expect } from 'vitest';
import type { HookHandler, HookHandlerResult, HookInputBase, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function tryParseStdoutJson(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function mergeStdout(contextParts: string[], lastRawStdout: string): string {
  if (contextParts.length === 0) return lastRawStdout;
  if (contextParts.length === 1) {
    const parsed = tryParseStdoutJson(lastRawStdout);
    if (parsed) return JSON.stringify({ ...parsed, additionalContext: contextParts[0] });
    return JSON.stringify({ additionalContext: contextParts[0] });
  }
  const merged = contextParts.join('\n\n---\n\n');
  const parsed = tryParseStdoutJson(lastRawStdout);
  if (parsed) return JSON.stringify({ ...parsed, additionalContext: merged });
  return JSON.stringify({ additionalContext: merged });
}

/**
 * Simulates the handler execution logic from createHookRunner.
 * The actual createHookRunner calls process.exit and reads stdin,
 * so we extract the testable core logic here.
 *
 * Mirrors the real merge logic: JSON outputs with `additionalContext`
 * are collected and merged; non-JSON stdout uses the last handler's value.
 */
async function executeHandlers<T extends HookInputBase>(
  handlers: HookHandler<T>[],
  input: T,
  config: ToolkitConfig,
): Promise<{ lastResult: HookHandlerResult | undefined; stdout: string; stderr: string }> {
  let lastResult: HookHandlerResult | undefined;
  const contextParts: string[] = [];
  let lastRawStdout = '';
  let stderr = '';

  for (const handler of handlers) {
    const result = await handler(input, config);
    if (result !== undefined) {
      lastResult = result;
      if (result.stdout) {
        const parsed = tryParseStdoutJson(result.stdout);
        if (parsed?.additionalContext) {
          contextParts.push(String(parsed.additionalContext));
        }
        lastRawStdout = result.stdout;
      }
      if (result.stderr) stderr += result.stderr;
      if (result.exitCode !== 0) break;
    }
  }

  return { lastResult, stdout: mergeStdout(contextParts, lastRawStdout), stderr };
}

describe('hook-runner handler execution', () => {
  const baseInput: HookInputBase = { session_id: 'test-session' };

  describe('sequential execution', () => {
    it('executes handlers sequentially in order', async () => {
      const order: number[] = [];
      const handlers: HookHandler<HookInputBase>[] = [
        async () => { order.push(1); return undefined; },
        async () => { order.push(2); return undefined; },
        async () => { order.push(3); return undefined; },
      ];
      await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(order).toEqual([1, 2, 3]);
    });

    it('passes input to each handler', async () => {
      const receivedInputs: HookInputBase[] = [];
      const handlers: HookHandler<HookInputBase>[] = [
        async (input) => { receivedInputs.push(input); return undefined; },
        async (input) => { receivedInputs.push(input); return undefined; },
      ];
      await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(receivedInputs).toEqual([baseInput, baseInput]);
    });

    it('passes config to each handler', async () => {
      const receivedConfigs: ToolkitConfig[] = [];
      const handlers: HookHandler<HookInputBase>[] = [
        async (_input, config) => { receivedConfigs.push(config); return undefined; },
        async (_input, config) => { receivedConfigs.push(config); return undefined; },
      ];
      await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(receivedConfigs).toEqual([DEFAULT_CONFIG, DEFAULT_CONFIG]);
    });
  });

  describe('early exit on non-zero exitCode', () => {
    it('stops execution on non-zero exit code', async () => {
      const order: number[] = [];
      const handlers: HookHandler<HookInputBase>[] = [
        async () => { order.push(1); return { exitCode: 0 }; },
        async () => { order.push(2); return { exitCode: 2, stderr: 'blocked' }; },
        async () => { order.push(3); return undefined; },
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(order).toEqual([1, 2]);
      expect(result.lastResult?.exitCode).toBe(2);
      expect(result.stderr).toContain('blocked');
    });

    it('stops on exitCode 1', async () => {
      const order: number[] = [];
      const handlers: HookHandler<HookInputBase>[] = [
        async () => { order.push(1); return { exitCode: 1, stderr: 'error' }; },
        async () => { order.push(2); return undefined; },
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(order).toEqual([1]);
      expect(result.lastResult?.exitCode).toBe(1);
    });

    it('continues execution on exitCode 0', async () => {
      const order: number[] = [];
      const handlers: HookHandler<HookInputBase>[] = [
        async () => { order.push(1); return { exitCode: 0 }; },
        async () => { order.push(2); return { exitCode: 0 }; },
        async () => { order.push(3); return { exitCode: 0 }; },
      ];
      await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('stdout/stderr collection', () => {
    it('keeps last raw stdout when handlers produce non-JSON output', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stdout: 'hello ' }),
        async () => ({ exitCode: 0, stdout: 'world' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stdout).toBe('world');
    });

    it('merges additionalContext from multiple JSON handlers', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stdout: JSON.stringify({ additionalContext: 'Context A' }) }),
        async () => ({ exitCode: 0, stdout: JSON.stringify({ additionalContext: 'Context B' }) }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.additionalContext).toBe('Context A\n\n---\n\nContext B');
    });

    it('uses single additionalContext directly without separator', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0 }),
        async () => ({ exitCode: 0, stdout: JSON.stringify({ additionalContext: 'Only one' }) }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.additionalContext).toBe('Only one');
    });

    it('collects stderr from multiple handlers', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stderr: 'warn1 ' }),
        async () => ({ exitCode: 0, stderr: 'warn2' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stderr).toBe('warn1 warn2');
    });

    it('collects both stdout and stderr', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stdout: 'out', stderr: 'err' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err');
    });

    it('ignores stdout/stderr from undefined results', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => undefined,
        async () => ({ exitCode: 0, stdout: 'only-this' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stdout).toBe('only-this');
    });

    it('does not append undefined stdout/stderr', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0 }),
        async () => ({ exitCode: 0, stdout: 'data' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stdout).toBe('data');
      expect(result.stderr).toBe('');
    });
  });

  describe('lastResult tracking', () => {
    it('returns undefined lastResult when all handlers return undefined', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => undefined,
        async () => undefined,
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.lastResult).toBeUndefined();
    });

    it('tracks last non-undefined result', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stdout: 'first' }),
        async () => undefined,
        async () => ({ exitCode: 0, stdout: 'third' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.lastResult?.stdout).toBe('third');
    });

    it('tracks the blocking result as lastResult', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0 }),
        async () => ({ exitCode: 2, stderr: 'blocked' }),
        async () => ({ exitCode: 0 }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.lastResult?.exitCode).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty handler list', async () => {
      const result = await executeHandlers([], baseInput, DEFAULT_CONFIG);
      expect(result.lastResult).toBeUndefined();
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('handles single handler returning undefined', async () => {
      const handlers: HookHandler<HookInputBase>[] = [async () => undefined];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.lastResult).toBeUndefined();
    });

    it('handles single handler returning result', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stdout: 'done' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.lastResult?.exitCode).toBe(0);
      expect(result.stdout).toBe('done');
    });

    it('handles handler that returns empty strings for stdout/stderr', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('awaits async handlers properly', async () => {
      const handlers: HookHandler<HookInputBase>[] = [
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { exitCode: 0, stdout: 'delayed' };
        },
      ];
      const result = await executeHandlers(handlers, baseInput, DEFAULT_CONFIG);
      expect(result.stdout).toBe('delayed');
    });
  });
});
