import type { HookEventType, HookExitCode, HookHandlerResult, VSCodeHookSpecificOutput, VSCodeHookOutput } from '../types.js';

/**
 * Formats handler results into VS Code-compatible hookSpecificOutput JSON.
 *
 * VS Code hooks expect a JSON object on stdout with `hookSpecificOutput` containing
 * hook-event-specific fields. This formatter transforms raw {@link HookHandlerResult}
 * data into that structure while preserving backward compatibility for Claude Code
 * callers (which receive the raw stdout string unchanged).
 *
 * @param hookType - The hook event type (e.g., `'PreToolUse'`, `'PostToolUse'`).
 * @param results - Collected handler results (stdout, stderr, exitCode).
 * @param isVSCode - Whether the caller is VS Code (detected from input format).
 * @returns The formatted stdout string to write to process.stdout.
 */
export function formatOutput(
  hookType: HookEventType,
  results: { lastResult: HookHandlerResult | undefined; stdout: string; stderr: string },
  isVSCode: boolean,
): string {
  if (!isVSCode) {
    return results.stdout;
  }

  return formatVSCodeOutput(hookType, results);
}

/**
 * Builds the VS Code hookSpecificOutput JSON for a given hook event.
 *
 * Parses the raw stdout (if JSON) to extract handler-specific fields like
 * `additionalContext`, `decision`, and `updatedInput`, then wraps them in the
 * expected VS Code envelope.
 */
function formatVSCodeOutput(
  hookType: HookEventType,
  results: { lastResult: HookHandlerResult | undefined; stdout: string; stderr: string },
): string {
  const exitCode: HookExitCode = results.lastResult?.exitCode ?? 0;
  const isBlocked = exitCode === 2;

  const parsedStdout = tryParseJson(results.stdout);

  const hookSpecific: VSCodeHookSpecificOutput = {
    hookEventName: hookType,
  };

  const output: VSCodeHookOutput = {};

  switch (hookType) {
    case 'PreToolUse':
      formatPreToolUse(hookSpecific, output, parsedStdout, results.stderr, isBlocked);
      break;
    case 'PostToolUse':
      formatPostToolUse(hookSpecific, output, parsedStdout, results.stderr, isBlocked);
      break;
    case 'Stop':
      formatStop(hookSpecific, output, parsedStdout, results.stderr, isBlocked);
      break;
    case 'PermissionRequest':
      formatPermissionRequest(hookSpecific, output, parsedStdout, results.stderr, isBlocked);
      break;
    default:
      formatDefault(hookSpecific, output, parsedStdout, results.stderr, isBlocked);
      break;
  }

  output.hookSpecificOutput = hookSpecific;

  return JSON.stringify(output);
}

function formatPreToolUse(
  hookSpecific: VSCodeHookSpecificOutput,
  output: VSCodeHookOutput,
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
  isBlocked: boolean,
): void {
  if (isBlocked) {
    hookSpecific.permissionDecision = 'deny';
    hookSpecific.permissionDecisionReason = extractMessage(parsedStdout, stderr);
    output.continue = false;
    output.stopReason = hookSpecific.permissionDecisionReason;
  } else {
    // Check if handler returned a permission decision
    if (parsedStdout?.decision === 'deny') {
      hookSpecific.permissionDecision = 'deny';
      hookSpecific.permissionDecisionReason = extractMessage(parsedStdout, stderr);
      output.continue = false;
      output.stopReason = hookSpecific.permissionDecisionReason;
    } else if (parsedStdout?.decision === 'ask') {
      hookSpecific.permissionDecision = 'ask';
      hookSpecific.permissionDecisionReason = extractMessage(parsedStdout, stderr);
      output.continue = true;
    } else if (parsedStdout?.decision === 'allow') {
      hookSpecific.permissionDecision = 'allow';
      output.continue = true;
    } else {
      output.continue = true;
    }

    // Include updatedInput for any non-deny decision (allow, ask, or no decision)
    if (parsedStdout?.updatedInput != null && hookSpecific.permissionDecision !== 'deny') {
      hookSpecific.updatedInput = parsedStdout.updatedInput as Record<string, unknown>;
    }

    if (parsedStdout?.additionalContext) {
      hookSpecific.additionalContext = String(parsedStdout.additionalContext);
    }
  }
}

function formatPostToolUse(
  hookSpecific: VSCodeHookSpecificOutput,
  output: VSCodeHookOutput,
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
  isBlocked: boolean,
): void {
  if (isBlocked) {
    output.decision = 'block';
    output.reason = extractMessage(parsedStdout, stderr);
    output.continue = false;
  } else {
    output.continue = true;
  }

  if (parsedStdout?.additionalContext) {
    hookSpecific.additionalContext = String(parsedStdout.additionalContext);
  }
}

function formatStop(
  hookSpecific: VSCodeHookSpecificOutput,
  output: VSCodeHookOutput,
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
  isBlocked: boolean,
): void {
  // Block if exitCode === 2 or handler stdout contains decision: 'block'
  const stdoutBlocked = parsedStdout?.decision === 'block';
  if (isBlocked || stdoutBlocked) {
    hookSpecific.decision = 'block';
    hookSpecific.reason = extractStopReason(parsedStdout, stderr);
    output.continue = false;
    output.stopReason = hookSpecific.reason;
  } else {
    output.continue = true;
  }

  if (parsedStdout?.additionalContext) {
    hookSpecific.additionalContext = String(parsedStdout.additionalContext);
  }
}

function isPermissionDecision(value: unknown): value is 'allow' | 'deny' | 'ask' {
  return value === 'allow' || value === 'deny' || value === 'ask';
}

function formatPermissionRequest(
  hookSpecific: VSCodeHookSpecificOutput,
  output: VSCodeHookOutput,
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
  isBlocked: boolean,
): void {
  if (parsedStdout?.decision && isPermissionDecision(parsedStdout.decision)) {
    hookSpecific.permissionDecision = parsedStdout.decision;
    hookSpecific.permissionDecisionReason = extractMessage(parsedStdout, stderr);
  }

  if (parsedStdout?.decision === 'deny' || isBlocked) {
    output.continue = false;
    output.stopReason = extractMessage(parsedStdout, stderr);
  } else {
    output.continue = true;
  }
}

function formatDefault(
  hookSpecific: VSCodeHookSpecificOutput,
  output: VSCodeHookOutput,
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
  isBlocked: boolean,
): void {
  if (isBlocked) {
    output.continue = false;
    output.stopReason = extractMessage(parsedStdout, stderr);
  } else {
    output.continue = true;
  }

  if (parsedStdout?.additionalContext) {
    hookSpecific.additionalContext = String(parsedStdout.additionalContext);
  }
}

/**
 * Extracts a human-readable message from handler output.
 * Checks parsed JSON for `message`, then falls back to stderr.
 */
function extractMessage(
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
): string {
  if (parsedStdout?.message && typeof parsedStdout.message === 'string') {
    return parsedStdout.message;
  }
  if (stderr) {
    return stderr;
  }
  return 'Operation blocked by hook';
}

/**
 * Extracts a reason string for Stop hook blocking.
 * Checks parsed JSON for `reason`, then `message`, then falls back to stderr.
 */
function extractStopReason(
  parsedStdout: Record<string, unknown> | undefined,
  stderr: string,
): string {
  if (parsedStdout?.reason && typeof parsedStdout.reason === 'string') {
    return parsedStdout.reason;
  }
  return extractMessage(parsedStdout, stderr);
}

/**
 * Attempts to parse a string as JSON. Returns undefined if parsing fails
 * or the result is not a plain object.
 */
function tryParseJson(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON — ignore
  }
  return undefined;
}
