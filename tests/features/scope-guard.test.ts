import { describe, it, expect } from 'vitest';
import { checkScope } from '../../src/features/scope-guard/index.js';
import { createHandler } from '../../src/features/scope-guard/handler.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeConfig(allowedPaths: string[] = [], enabled = true): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    guards: {
      ...DEFAULT_CONFIG.guards,
      scope: { allowedPaths, enabled },
    },
  };
}

function makeInput(toolName: string, toolInput: Record<string, unknown> = {}): PreToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: toolInput,
  };
}

describe('scope-guard', () => {
  describe('checkScope', () => {
    it('proceeds for non-write tools', () => {
      const result = checkScope(makeInput('Read', { file_path: '/outside/file.ts' }), makeConfig(['src/**']));
      expect(result.action).toBe('proceed');
    });

    it('proceeds when disabled', () => {
      const result = checkScope(
        makeInput('Write', { file_path: '/outside/file.ts' }),
        makeConfig(['src/**'], false),
      );
      expect(result.action).toBe('proceed');
    });

    it('proceeds when allowedPaths is empty (open scope)', () => {
      const result = checkScope(
        makeInput('Write', { file_path: '/any/where/file.ts' }),
        makeConfig([]),
      );
      expect(result.action).toBe('proceed');
    });

    it('proceeds when file path matches allowed glob', () => {
      const result = checkScope(
        makeInput('Write', { file_path: 'src/components/Button.tsx' }),
        makeConfig(['src/**']),
      );
      expect(result.action).toBe('proceed');
    });

    it('blocks when file path does not match any allowed glob', () => {
      const result = checkScope(
        makeInput('Write', { file_path: 'config/secret.yml' }),
        makeConfig(['src/**']),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('outside allowed scope');
    });

    it('handles multiple allowed patterns', () => {
      const config = makeConfig(['src/**', 'tests/**', '*.md']);
      expect(checkScope(makeInput('Write', { file_path: 'src/app.ts' }), config).action).toBe('proceed');
      expect(checkScope(makeInput('Write', { file_path: 'tests/app.test.ts' }), config).action).toBe('proceed');
      expect(checkScope(makeInput('Write', { file_path: 'README.md' }), config).action).toBe('proceed');
      expect(checkScope(makeInput('Write', { file_path: 'deploy/production.yml' }), config).action).toBe('block');
    });

    it('handles nested paths correctly', () => {
      const result = checkScope(
        makeInput('Edit', { file_path: 'src/deeply/nested/component/Widget.tsx' }),
        makeConfig(['src/**']),
      );
      expect(result.action).toBe('proceed');
    });

    it('handles missing file_path gracefully', () => {
      const result = checkScope(makeInput('Write', {}), makeConfig(['src/**']));
      expect(result.action).toBe('proceed');
    });
  });

  describe('createHandler', () => {
    it('returns block result for out-of-scope file', async () => {
      const handler = createHandler('PreToolUse');
      const result = await handler(
        makeInput('Write', { file_path: 'config/secret.yml' }),
        makeConfig(['src/**']),
      );
      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(2);
    });

    it('returns undefined for in-scope file', async () => {
      const handler = createHandler('PreToolUse');
      const result = await handler(
        makeInput('Write', { file_path: 'src/app.ts' }),
        makeConfig(['src/**']),
      );
      expect(result).toBeUndefined();
    });
  });
});
