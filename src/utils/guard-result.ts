/**
 * Converts a GuardResult into a HookHandlerResult.
 *
 * Guards return `{ action: 'block' | 'proceed' }`. Hook handlers need
 * `{ exitCode, stderr }` or `undefined`. This utility bridges the two.
 */

import type { GuardResult, HookHandlerResult } from '../types.js';

/**
 * Maps a guard check result to a hook handler result.
 *
 * - `block` → `{ exitCode: 2, stderr: message }`
 * - `warn` → `{ exitCode: 0, stderr: message }`
 * - `proceed` → `undefined`
 *
 * @param result - The guard result to convert.
 * @param fallbackMessage - Message used when the guard result has no message.
 * @returns A handler result for blocks, or `undefined` to proceed.
 */
export function guardResultToHandlerResult(
  result: GuardResult,
  fallbackMessage: string,
): HookHandlerResult | undefined {
  if (result.action === 'block') {
    return { exitCode: 2, stderr: result.message ?? fallbackMessage };
  }
  if (result.action === 'warn') {
    return {
      exitCode: 0,
      stderr: result.message ?? fallbackMessage,
      stdout: JSON.stringify({ additionalContext: result.message ?? fallbackMessage }),
    };
  }
  return undefined;
}
