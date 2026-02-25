import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../src/runtime/output-formatter.js';
import type { HookHandlerResult, HookEventType, VSCodeHookOutput } from '../../src/types.js';

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

describe('formatOutput', () => {
  describe('Claude Code passthrough (isVSCode = false)', () => {
    it('returns raw stdout unchanged', () => {
      const results = makeResults({ stdout: '{"additionalContext":"hello"}' });
      const output = formatOutput('PreToolUse', results, false);
      expect(output).toBe('{"additionalContext":"hello"}');
    });

    it('returns empty string when stdout is empty', () => {
      const results = makeResults({});
      const output = formatOutput('PreToolUse', results, false);
      expect(output).toBe('');
    });

    it('returns non-JSON stdout unchanged', () => {
      const results = makeResults({ stdout: 'plain text' });
      const output = formatOutput('PreToolUse', results, false);
      expect(output).toBe('plain text');
    });

    it('does not wrap block results', () => {
      const results = makeResults({ exitCode: 2, stderr: 'blocked' });
      const output = formatOutput('PreToolUse', results, false);
      expect(output).toBe('');
    });
  });

  describe('VS Code format (isVSCode = true)', () => {
    describe('PreToolUse', () => {
      it('formats proceed result with continue=true', () => {
        const results = makeResults({});
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
      });

      it('formats block (exitCode=2) with deny decision', () => {
        const results = makeResults({ exitCode: 2, stderr: 'Dangerous command blocked' });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(false);
        expect(output.stopReason).toBe('Dangerous command blocked');
        expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(output.hookSpecificOutput?.permissionDecisionReason).toBe('Dangerous command blocked');
      });

      it('formats deny decision from handler stdout', () => {
        const results = makeResults({
          stdout: JSON.stringify({ decision: 'deny', message: 'Auto-denied tool: Write' }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(false);
        expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
        expect(output.hookSpecificOutput?.permissionDecisionReason).toBe('Auto-denied tool: Write');
      });

      it('formats allow decision from handler stdout', () => {
        const results = makeResults({
          stdout: JSON.stringify({ decision: 'allow', message: 'Auto-allowed' }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.permissionDecision).toBe('allow');
      });

      it('formats ask decision from handler stdout', () => {
        const results = makeResults({
          stdout: JSON.stringify({ decision: 'ask', message: 'Requires user confirmation: Write' }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.permissionDecision).toBe('ask');
        expect(output.hookSpecificOutput?.permissionDecisionReason).toBe('Requires user confirmation: Write');
      });

      it('includes updatedInput when present in allow decision', () => {
        const results = makeResults({
          stdout: JSON.stringify({
            decision: 'allow',
            updatedInput: { command: 'ls -la' },
          }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.hookSpecificOutput?.updatedInput).toEqual({ command: 'ls -la' });
      });

      it('includes updatedInput without explicit decision', () => {
        const results = makeResults({
          stdout: JSON.stringify({
            updatedInput: { file_path: '/safe/path.txt' },
          }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.updatedInput).toEqual({ file_path: '/safe/path.txt' });
      });

      it('includes updatedInput with ask decision', () => {
        const results = makeResults({
          stdout: JSON.stringify({
            decision: 'ask',
            message: 'Please confirm',
            updatedInput: { command: 'modified-cmd' },
          }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.hookSpecificOutput?.permissionDecision).toBe('ask');
        expect(output.hookSpecificOutput?.updatedInput).toEqual({ command: 'modified-cmd' });
      });

      it('omits updatedInput when not present in stdout', () => {
        const results = makeResults({
          stdout: JSON.stringify({ decision: 'allow', message: 'ok' }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.hookSpecificOutput?.updatedInput).toBeUndefined();
      });

      it('omits updatedInput when decision is deny', () => {
        const results = makeResults({
          stdout: JSON.stringify({
            decision: 'deny',
            message: 'Not allowed',
            updatedInput: { command: 'should-be-ignored' },
          }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.hookSpecificOutput?.updatedInput).toBeUndefined();
      });

      it('omits updatedInput when blocked (exitCode=2)', () => {
        const results = makeResults({
          exitCode: 2,
          stdout: JSON.stringify({ updatedInput: { command: 'ignored' } }),
          stderr: 'Blocked',
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.hookSpecificOutput?.updatedInput).toBeUndefined();
      });

      it('includes additionalContext when present', () => {
        const results = makeResults({
          stdout: JSON.stringify({ additionalContext: 'Project uses ESM modules' }),
        });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.additionalContext).toBe('Project uses ESM modules');
      });

      it('uses default message when stderr and message are empty on block', () => {
        const results = makeResults({ exitCode: 2 });
        const output = parseOutput(formatOutput('PreToolUse', results, true));
        expect(output.hookSpecificOutput?.permissionDecisionReason).toBe('Operation blocked by hook');
      });
    });

    describe('PostToolUse', () => {
      it('formats proceed result with continue=true', () => {
        const results = makeResults({});
        const output = parseOutput(formatOutput('PostToolUse', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
      });

      it('formats block result with decision=block', () => {
        const results = makeResults({ exitCode: 2, stderr: 'Lint errors found' });
        const output = parseOutput(formatOutput('PostToolUse', results, true));
        expect(output.continue).toBe(false);
        expect(output.decision).toBe('block');
        expect(output.reason).toBe('Lint errors found');
      });

      it('includes additionalContext', () => {
        const results = makeResults({
          stdout: JSON.stringify({ additionalContext: 'File has 3 warnings' }),
        });
        const output = parseOutput(formatOutput('PostToolUse', results, true));
        expect(output.hookSpecificOutput?.additionalContext).toBe('File has 3 warnings');
      });
    });

    describe('Stop', () => {
      it('formats proceed result', () => {
        const results = makeResults({});
        const output = parseOutput(formatOutput('Stop', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.hookEventName).toBe('Stop');
      });

      it('formats block with decision in hookSpecificOutput', () => {
        const results = makeResults({ exitCode: 2, stderr: 'Run tests before finishing' });
        const output = parseOutput(formatOutput('Stop', results, true));
        expect(output.continue).toBe(false);
        expect(output.stopReason).toBe('Run tests before finishing');
        expect(output.hookSpecificOutput?.decision).toBe('block');
        expect(output.hookSpecificOutput?.reason).toBe('Run tests before finishing');
      });
    });

    describe('SessionStart', () => {
      it('formats proceed result with additionalContext', () => {
        const results = makeResults({
          stdout: JSON.stringify({ additionalContext: 'Project info injected' }),
        });
        const output = parseOutput(formatOutput('SessionStart', results, true));
        expect(output.continue).toBe(true);
        expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');
        expect(output.hookSpecificOutput?.additionalContext).toBe('Project info injected');
      });

      it('formats block result', () => {
        const results = makeResults({ exitCode: 2, stderr: 'Session blocked' });
        const output = parseOutput(formatOutput('SessionStart', results, true));
        expect(output.continue).toBe(false);
        expect(output.stopReason).toBe('Session blocked');
      });
    });

    describe('other hook types', () => {
      const otherHookTypes: HookEventType[] = [
        'Notification',
        'UserPromptSubmit',
        'SubagentStart',
        'SubagentStop',
        'PreCompact',
        'Setup',
        'SessionEnd',
        'PostToolUseFailure',
        'PermissionRequest',
      ];

      for (const hookType of otherHookTypes) {
        it(`formats ${hookType} proceed result`, () => {
          const results = makeResults({});
          const output = parseOutput(formatOutput(hookType, results, true));
          expect(output.continue).toBe(true);
          expect(output.hookSpecificOutput?.hookEventName).toBe(hookType);
        });

        it(`formats ${hookType} block result`, () => {
          const results = makeResults({ exitCode: 2, stderr: 'blocked' });
          const output = parseOutput(formatOutput(hookType, results, true));
          expect(output.continue).toBe(false);
          expect(output.stopReason).toBe('blocked');
        });
      }
    });
  });

  describe('edge cases', () => {
    it('handles undefined lastResult for VS Code', () => {
      const results = {
        lastResult: undefined,
        stdout: '',
        stderr: '',
      };
      const output = parseOutput(formatOutput('PreToolUse', results, true));
      expect(output.continue).toBe(true);
      expect(output.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    });

    it('handles non-JSON stdout for VS Code', () => {
      const results = makeResults({ stdout: 'not json at all' });
      const output = parseOutput(formatOutput('PostToolUse', results, true));
      expect(output.continue).toBe(true);
      expect(output.hookSpecificOutput?.hookEventName).toBe('PostToolUse');
    });

    it('handles stdout that is a JSON array (not object)', () => {
      const results = makeResults({ stdout: '[1, 2, 3]' });
      const output = parseOutput(formatOutput('PreToolUse', results, true));
      expect(output.continue).toBe(true);
    });

    it('extracts message from parsed stdout over stderr', () => {
      const results = makeResults({
        exitCode: 2,
        stdout: JSON.stringify({ message: 'Specific error from handler' }),
        stderr: 'Generic stderr',
      });
      const output = parseOutput(formatOutput('PreToolUse', results, true));
      expect(output.hookSpecificOutput?.permissionDecisionReason).toBe('Specific error from handler');
    });

    it('falls back to stderr when stdout has no message', () => {
      const results = makeResults({
        exitCode: 2,
        stdout: JSON.stringify({ someOtherField: true }),
        stderr: 'Stderr message',
      });
      const output = parseOutput(formatOutput('PreToolUse', results, true));
      expect(output.hookSpecificOutput?.permissionDecisionReason).toBe('Stderr message');
    });

    it('produces valid JSON output for VS Code', () => {
      const results = makeResults({ stdout: JSON.stringify({ additionalContext: 'test' }) });
      const raw = formatOutput('SessionStart', results, true);
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('handles empty handlers (lastResult undefined) for Claude Code', () => {
      const results = {
        lastResult: undefined,
        stdout: '',
        stderr: '',
      };
      const output = formatOutput('PreToolUse', results, false);
      expect(output).toBe('');
    });
  });
});
