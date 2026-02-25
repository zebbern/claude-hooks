import { describe, it, expect } from 'vitest';
import { normalizeHookInput, isVSCodeFormat, sanitizeSessionId } from '../../src/runtime/input-normalizer.js';
import type { HookInputBase, PreToolUseInput, PostToolUseInput, StopInput, SubagentStartInput, PermissionRequestInput } from '../../src/types.js';

describe('isVSCodeFormat', () => {
  it('returns true when input has sessionId but not session_id', () => {
    expect(isVSCodeFormat({ sessionId: 'abc123' })).toBe(true);
  });

  it('returns false when input has session_id', () => {
    expect(isVSCodeFormat({ session_id: 'abc123' })).toBe(false);
  });

  it('returns false when input has both sessionId and session_id', () => {
    expect(isVSCodeFormat({ sessionId: 'abc', session_id: 'abc' })).toBe(false);
  });

  it('returns false when input has neither field', () => {
    expect(isVSCodeFormat({ tool_name: 'Write' })).toBe(false);
  });
});

describe('normalizeHookInput', () => {
  describe('snake_case passthrough (Claude Code format)', () => {
    it('returns snake_case input unchanged', () => {
      const input = { session_id: 'sess-001', tool_name: 'Write' };
      const result = normalizeHookInput<PreToolUseInput>(input);
      expect(result.session_id).toBe('sess-001');
      expect(result.tool_name).toBe('Write');
    });

    it('preserves all fields for PreToolUseInput', () => {
      const input = {
        session_id: 'sess-002',
        tool_name: 'Read',
        tool_input: { file_path: '/src/index.ts' },
      };
      const result = normalizeHookInput<PreToolUseInput>(input);
      expect(result).toEqual(input);
    });

    it('preserves all fields for PostToolUseInput', () => {
      const input = {
        session_id: 'sess-003',
        tool_name: 'Write',
        tool_input: { file_path: '/src/app.ts' },
        tool_output: 'File written successfully',
      };
      const result = normalizeHookInput<PostToolUseInput>(input);
      expect(result).toEqual(input);
    });

    it('preserves all fields for StopInput', () => {
      const input = {
        session_id: 'sess-004',
        stop_hook_active: true,
        transcript_path: '/tmp/transcript.json',
      };
      const result = normalizeHookInput<StopInput>(input);
      expect(result).toEqual(input);
    });
  });

  describe('camelCase normalization (VS Code format)', () => {
    it('maps sessionId to session_id', () => {
      const input = { sessionId: 'vsc-001' };
      const result = normalizeHookInput<HookInputBase>(input);
      expect(result.session_id).toBe('vsc-001');
      expect((result as unknown as Record<string, unknown>)['sessionId']).toBeUndefined();
    });

    it('preserves snake_case fields that are the same in both formats', () => {
      const input = {
        sessionId: 'vsc-002',
        tool_name: 'Read',
        tool_input: { file_path: '/src/app.ts' },
      };
      const result = normalizeHookInput<PreToolUseInput>(input);
      expect(result.session_id).toBe('vsc-002');
      expect(result.tool_name).toBe('Read');
      expect(result.tool_input).toEqual({ file_path: '/src/app.ts' });
    });

    it('preserves extra VS Code fields (hookEventName)', () => {
      const input = {
        sessionId: 'vsc-003',
        hookEventName: 'PreToolUse',
        tool_name: 'Write',
        tool_input: {},
      };
      const result = normalizeHookInput<PreToolUseInput>(input);
      expect(result.session_id).toBe('vsc-003');
      expect((result as unknown as Record<string, unknown>)['hookEventName']).toBe('PreToolUse');
    });

    it('preserves extra VS Code fields (cwd, timestamp)', () => {
      const input = {
        sessionId: 'vsc-004',
        cwd: '/home/user/project',
        timestamp: '2026-02-24T12:00:00Z',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      };
      const result = normalizeHookInput<PreToolUseInput>(input);
      expect(result.session_id).toBe('vsc-004');
      expect((result as unknown as Record<string, unknown>)['cwd']).toBe('/home/user/project');
      expect((result as unknown as Record<string, unknown>)['timestamp']).toBe('2026-02-24T12:00:00Z');
    });

    it('normalizes SubagentStartInput with sessionId', () => {
      const input = {
        sessionId: 'vsc-005',
        agent_id: 'agent-1',
        agent_type: 'implementer',
      };
      const result = normalizeHookInput<SubagentStartInput>(input);
      expect(result.session_id).toBe('vsc-005');
      expect(result.agent_id).toBe('agent-1');
      expect(result.agent_type).toBe('implementer');
    });

    it('normalizes PermissionRequestInput with sessionId', () => {
      const input = {
        sessionId: 'vsc-006',
        tool_name: 'Write',
        tool_input: { file_path: '/etc/passwd' },
        hook_event_name: 'PreToolUse',
      };
      const result = normalizeHookInput<PermissionRequestInput>(input);
      expect(result.session_id).toBe('vsc-006');
      expect(result.tool_name).toBe('Write');
      expect(result.hook_event_name).toBe('PreToolUse');
    });
  });

  describe('edge cases', () => {
    it('handles empty object', () => {
      const result = normalizeHookInput<HookInputBase>({});
      expect(result).toEqual({});
    });

    it('preserves nested objects without deep conversion', () => {
      const input = {
        sessionId: 'vsc-007',
        tool_name: 'Write',
        tool_input: { sessionId: 'nested-should-stay', filePath: '/x' },
      };
      const result = normalizeHookInput<PreToolUseInput>(input);
      expect(result.session_id).toBe('vsc-007');
      // Nested sessionId should NOT be converted
      expect(result.tool_input['sessionId']).toBe('nested-should-stay');
    });

    it('handles input with only extra fields and no sessionId or session_id', () => {
      const input = { hookEventName: 'Setup', cwd: '/tmp' };
      const result = normalizeHookInput<Record<string, unknown>>(input);
      expect(result['hookEventName']).toBe('Setup');
      expect(result['cwd']).toBe('/tmp');
    });

    it('preserves boolean, number, null, and array values', () => {
      const input = {
        sessionId: 'vsc-008',
        stop_hook_active: true,
        count: 42,
        nullField: null,
        arrayField: [1, 2, 3],
      };
      const result = normalizeHookInput<Record<string, unknown>>(input);
      expect(result['session_id']).toBe('vsc-008');
      expect(result['stop_hook_active']).toBe(true);
      expect(result['count']).toBe(42);
      expect(result['nullField']).toBeNull();
      expect(result['arrayField']).toEqual([1, 2, 3]);
    });
  });
});

describe('sanitizeSessionId', () => {
  it('passes through alphanumeric session_id unchanged', () => {
    expect(sanitizeSessionId('abc123')).toBe('abc123');
  });

  it('passes through hyphens and underscores unchanged', () => {
    expect(sanitizeSessionId('sess-001_test')).toBe('sess-001_test');
  });

  it('replaces path traversal characters', () => {
    expect(sanitizeSessionId('../../etc/cron.d/evil')).toBe('______etc_cron_d_evil');
  });

  it('replaces special characters', () => {
    expect(sanitizeSessionId('sess@id#123!$%')).toBe('sess_id_123___');
  });

  it('replaces spaces', () => {
    expect(sanitizeSessionId('sess id with spaces')).toBe('sess_id_with_spaces');
  });

  it('handles empty string', () => {
    expect(sanitizeSessionId('')).toBe('');
  });
});

describe('normalizeHookInput session_id sanitization', () => {
  it('sanitizes session_id in snake_case input', () => {
    const input = { session_id: '../../evil', tool_name: 'Write' };
    const result = normalizeHookInput<{ session_id: string }>(input);
    expect(result.session_id).toBe('______evil');
  });

  it('sanitizes session_id after camelCase normalization', () => {
    const input = { sessionId: '../bad/path' };
    const result = normalizeHookInput<{ session_id: string }>(input);
    expect(result.session_id).toBe('___bad_path');
  });

  it('leaves safe session_id unchanged in snake_case input', () => {
    const input = { session_id: 'safe-session_123' };
    const result = normalizeHookInput<{ session_id: string }>(input);
    expect(result.session_id).toBe('safe-session_123');
  });

  it('leaves safe session_id unchanged in camelCase input', () => {
    const input = { sessionId: 'safe-session_456' };
    const result = normalizeHookInput<{ session_id: string }>(input);
    expect(result.session_id).toBe('safe-session_456');
  });

  it('skips sanitization when session_id is not a string', () => {
    const input = { session_id: 12345 };
    const result = normalizeHookInput<{ session_id: number }>(input);
    expect(result.session_id).toBe(12345);
  });

  it('skips sanitization when session_id is missing', () => {
    const input = { tool_name: 'Read' };
    const result = normalizeHookInput<Record<string, unknown>>(input);
    expect(result['session_id']).toBeUndefined();
  });

  it('does not mutate the original snake_case input object', () => {
    const input = { session_id: '../../evil', tool_name: 'Write' };
    const originalSessionId = input.session_id;
    normalizeHookInput<{ session_id: string }>(input);
    expect(input.session_id).toBe(originalSessionId);
  });
});
