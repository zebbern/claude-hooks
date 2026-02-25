import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveHookPath, resolveAllHookPaths } from '../../src/generator/hook-resolver.js';
import { ALL_HOOK_EVENT_TYPES } from '../../src/types.js';
import type { HookEventType } from '../../src/types.js';

describe('hook-resolver', () => {
  describe('resolveHookPath', () => {
    it('resolves path for PreToolUse', () => {
      const hookPath = resolveHookPath('PreToolUse');
      expect(hookPath).toContain('pre-tool-use.js');
    });

    it('resolves path for PostToolUse', () => {
      const hookPath = resolveHookPath('PostToolUse');
      expect(hookPath).toContain('post-tool-use.js');
    });

    it('resolves path for PermissionRequest', () => {
      const hookPath = resolveHookPath('PermissionRequest');
      expect(hookPath).toContain('permission-request.js');
    });

    it('returns paths ending with .js extension', () => {
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const hookPath = resolveHookPath(hookType);
        expect(hookPath).toMatch(/\.js$/);
      }
    });

    it('returns absolute paths', () => {
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const hookPath = resolveHookPath(hookType);
        expect(path.isAbsolute(hookPath)).toBe(true);
      }
    });

    it('resolves paths under hooks/ directory', () => {
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const hookPath = resolveHookPath(hookType);
        expect(hookPath).toContain('hooks');
      }
    });
  });

  describe('resolveAllHookPaths', () => {
    it('returns all 13 entries', () => {
      const paths = resolveAllHookPaths();
      expect(Object.keys(paths)).toHaveLength(13);
    });

    it('has an entry for every hook type', () => {
      const paths = resolveAllHookPaths();
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        expect(paths[hookType]).toBeDefined();
        expect(typeof paths[hookType]).toBe('string');
      }
    });

    it('all values are absolute paths ending in .js', () => {
      const paths = resolveAllHookPaths();
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        expect(path.isAbsolute(paths[hookType])).toBe(true);
        expect(paths[hookType]).toMatch(/\.js$/);
      }
    });

    it('maps hook types to kebab-case filenames', () => {
      const paths = resolveAllHookPaths();
      const expectedMappings: Partial<Record<HookEventType, string>> = {
        PreToolUse: 'pre-tool-use.js',
        PostToolUse: 'post-tool-use.js',
        PostToolUseFailure: 'post-tool-use-failure.js',
        UserPromptSubmit: 'user-prompt-submit.js',
        SubagentStart: 'subagent-start.js',
        SessionStart: 'session-start.js',
        PermissionRequest: 'permission-request.js',
      };

      for (const [hookType, expectedFilename] of Object.entries(expectedMappings)) {
        expect(paths[hookType as HookEventType]).toContain(expectedFilename);
      }
    });
  });
});
