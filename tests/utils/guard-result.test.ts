import { describe, it, expect } from 'vitest';
import { guardResultToHandlerResult } from '../../src/utils/guard-result.js';

describe('guardResultToHandlerResult', () => {
  it('returns exitCode 2 with message for block action', () => {
    const result = guardResultToHandlerResult(
      { action: 'block', message: 'Blocked by guard' },
      'fallback',
    );
    expect(result).toEqual({ exitCode: 2, stderr: 'Blocked by guard' });
  });

  it('uses fallback message when block result has no message', () => {
    const result = guardResultToHandlerResult(
      { action: 'block' },
      'fallback message',
    );
    expect(result).toEqual({ exitCode: 2, stderr: 'fallback message' });
  });

  it('returns exitCode 0 with message for warn action', () => {
    const result = guardResultToHandlerResult(
      { action: 'warn', message: 'Warning: risky operation' },
      'fallback',
    );
    expect(result).toEqual({
      exitCode: 0,
      stderr: 'Warning: risky operation',
      stdout: JSON.stringify({ additionalContext: 'Warning: risky operation' }),
    });
  });

  it('uses fallback message when warn result has no message', () => {
    const result = guardResultToHandlerResult(
      { action: 'warn' },
      'fallback warning',
    );
    expect(result).toEqual({
      exitCode: 0,
      stderr: 'fallback warning',
      stdout: JSON.stringify({ additionalContext: 'fallback warning' }),
    });
  });

  it('returns undefined for proceed action', () => {
    const result = guardResultToHandlerResult(
      { action: 'proceed' },
      'fallback',
    );
    expect(result).toBeUndefined();
  });
});
