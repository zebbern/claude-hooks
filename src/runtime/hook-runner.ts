import { loadConfig } from '../config.js';
import { isVSCodeFormat, normalizeHookInput } from './input-normalizer.js';
import { formatOutput } from './output-formatter.js';
import { readStdinRaw } from './stdin-reader.js';
import type { HookEventType, HookHandler, HookHandlerResult, HookInputBase, ToolkitConfig } from '../types.js';

/**
 * Creates and immediately executes a hook runner.
 *
 * Reads the toolkit configuration, parses JSON input from stdin, then runs each handler
 * sequentially. If any handler returns a non-zero exit code, execution stops and the
 * process exits with that code. Handler stdout/stderr is forwarded to the parent process.
 *
 * For VS Code callers (detected via camelCase input fields), output is formatted into
 * the hookSpecificOutput envelope. For Claude Code callers, raw stdout is passed through
 * unchanged for backward compatibility.
 *
 * Exit codes:
 * - `0` — Proceed (hook passed)
 * - `1` — Error (hook encountered an error)
 * - `2` — Block (hook rejected the action)
 *
 * @typeParam T - The expected stdin input shape, extending {@link HookInputBase}.
 * @param hookType - The hook event type (e.g., `'PreToolUse'`, `'PostToolUse'`).
 * @param handlers - Array of handler functions to execute sequentially.
 * @param existingConfig - Optional pre-loaded config. When provided, skips the internal
 *   `loadConfig()` call to avoid duplicate config loading. If omitted, config is loaded
 *   automatically (backward compatible).
 *
 * @example
 * ```ts
 * import { createHookRunner, checkCommand, checkFileAccess } from 'claude-hooks-toolkit';
 * import { loadConfig } from 'claude-hooks-toolkit';
 * import type { PreToolUseInput } from 'claude-hooks-toolkit';
 *
 * const config = loadConfig();
 * createHookRunner<PreToolUseInput>('PreToolUse', [
 *   (input, config) => checkCommand(input, config),
 *   (input, config) => checkFileAccess(input, config),
 * ], config);
 * ```
 */
export function createHookRunner<T extends HookInputBase>(
  hookType: HookEventType,
  handlers: HookHandler<T>[],
  existingConfig?: ToolkitConfig,
): void {
  const run = async () => {
    const config: ToolkitConfig = existingConfig ?? loadConfig();

    // Read raw stdin to detect format before normalization
    const rawInput = await readStdinRaw();
    const isVSCode = isVSCodeFormat(rawInput);

    // Normalize input (readStdinJson already does this, but we need raw first)
    const input = normalizeHookInput<T>(rawInput);

    let lastResult: HookHandlerResult | undefined;
    const contextParts: string[] = [];
    let collectedStderr = '';
    /** Holds the last non-additionalContext stdout for non-context outputs (e.g. decision). */
    let lastRawStdout = '';

    for (const handler of handlers) {
      try {
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
          if (result.stderr) {
            collectedStderr += result.stderr;
          }
          if (result.exitCode !== 0) {
            // Format and write output before exiting
            const mergedStdout = mergeStdout(contextParts, lastRawStdout);
            const formattedOutput = formatOutput(hookType, {
              lastResult,
              stdout: mergedStdout,
              stderr: collectedStderr,
            }, isVSCode);
            if (formattedOutput) {
              process.stdout.write(formattedOutput);
            }
            if (!isVSCode && collectedStderr) {
              process.stderr.write(collectedStderr);
            }
            process.exit(result.exitCode);
            return;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[${hookType}] Handler error: ${message}\n`);
        process.exit(1);
        return;
      }
    }

    // Format and write final output
    const mergedStdout = mergeStdout(contextParts, lastRawStdout);
    const formattedOutput = formatOutput(hookType, {
      lastResult,
      stdout: mergedStdout,
      stderr: collectedStderr,
    }, isVSCode);
    if (formattedOutput) {
      process.stdout.write(formattedOutput);
    }

    process.exit(lastResult?.exitCode ?? 0);
  };

  run().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[${hookType}] Fatal error: ${message}\n`);
    process.exit(1);
  });
}

/**
 * Attempts to parse a string as a JSON object.
 * Returns undefined if parsing fails or the result is not a plain object.
 */
function tryParseStdoutJson(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not valid JSON — return undefined
  }
  return undefined;
}

/**
 * Merges collected additionalContext parts into a single valid JSON stdout string.
 *
 * When multiple handlers produce `{ additionalContext: "..." }`, their context
 * values are joined with a separator. When only one handler produced context,
 * its output is used directly (no separator). Non-context stdout (e.g. decision
 * objects) is preserved from the last handler.
 */
function mergeStdout(contextParts: string[], lastRawStdout: string): string {
  if (contextParts.length === 0) {
    return lastRawStdout;
  }

  if (contextParts.length === 1) {
    // Single context — rebuild from lastRawStdout but ensure additionalContext is set
    const parsed = tryParseStdoutJson(lastRawStdout);
    if (parsed) {
      // Preserve any extra fields (e.g. decision) alongside the context
      return JSON.stringify({ ...parsed, additionalContext: contextParts[0] });
    }
    return JSON.stringify({ additionalContext: contextParts[0] });
  }

  // Multiple contexts — merge into single additionalContext, preserving other
  // fields from the last handler's output
  const merged = contextParts.join('\n\n---\n\n');
  const parsed = tryParseStdoutJson(lastRawStdout);
  if (parsed) {
    return JSON.stringify({ ...parsed, additionalContext: merged });
  }
  return JSON.stringify({ additionalContext: merged });
}