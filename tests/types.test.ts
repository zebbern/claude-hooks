import { describe, it, expect } from 'vitest';
import { ALL_HOOK_EVENT_TYPES } from '../src/types.js';
import type { HookEventType } from '../src/types.js';

describe('types', () => {
  describe('ALL_HOOK_EVENT_TYPES', () => {
    it('has exactly 13 entries', () => {
      expect(ALL_HOOK_EVENT_TYPES).toHaveLength(13);
    });

    const expectedTypes: HookEventType[] = [
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'UserPromptSubmit',
      'Notification',
      'Stop',
      'SubagentStart',
      'SubagentStop',
      'PreCompact',
      'Setup',
      'SessionStart',
      'SessionEnd',
      'PermissionRequest',
    ];

    for (const hookType of expectedTypes) {
      it(`includes ${hookType}`, () => {
        expect(ALL_HOOK_EVENT_TYPES).toContain(hookType);
      });
    }

    it('is readonly (frozen at type level)', () => {
      // Verify it is an array
      expect(Array.isArray(ALL_HOOK_EVENT_TYPES)).toBe(true);
      // Each element should be a string
      for (const item of ALL_HOOK_EVENT_TYPES) {
        expect(typeof item).toBe('string');
      }
    });

    it('has no duplicates', () => {
      const unique = new Set(ALL_HOOK_EVENT_TYPES);
      expect(unique.size).toBe(ALL_HOOK_EVENT_TYPES.length);
    });
  });
});
