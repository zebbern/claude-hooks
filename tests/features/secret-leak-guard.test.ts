import { describe, it, expect } from 'vitest';
import { checkSecretLeak } from '../../src/features/secret-leak-guard/index.js';
import { createHandler } from '../../src/features/secret-leak-guard/handler.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeConfig(
  customPatterns: string[] = [],
  allowedPatterns: string[] = [],
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    guards: {
      ...DEFAULT_CONFIG.guards,
      secretLeak: { customPatterns, allowedPatterns, enabled },
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

describe('secret-leak-guard', () => {
  describe('checkSecretLeak', () => {
    it('proceeds for non-write tools', () => {
      const result = checkSecretLeak(makeInput('Read'), makeConfig());
      expect(result.action).toBe('proceed');
    });

    it('proceeds when disabled', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'AKIAIOSFODNN7EXAMPLE1' }),
        makeConfig([], [], false),
      );
      expect(result.action).toBe('proceed');
    });

    it('proceeds when content has no secrets', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'const x = 42;\nconsole.log(x);' }),
        makeConfig(),
      );
      expect(result.action).toBe('proceed');
    });

    it('blocks when AWS access key found', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'const key = "AKIAIOSFODNN7EXAMPLE1";' }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('AWS access key');
    });

    it('blocks when GitHub token found', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";' }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('GitHub token');
    });

    it('blocks when OpenAI key found', () => {
      const result = checkSecretLeak(
        makeInput('Edit', { new_string: 'const key = "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh";' }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('OpenAI key');
    });

    it('blocks when private key block found', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----' }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('Private key');
    });

    it('blocks when connection string with password found', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'DATABASE_URL=postgres://admin:secret123@db.example.com:5432/mydb' }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('Connection string');
    });

    it('blocks when generic api_key pattern found', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'api_key = "abcdefghijklmnopqrst"' }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('Generic API key');
    });

    it('respects customPatterns config', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'CUSTOM_SECRET_12345' }),
        makeConfig(['CUSTOM_SECRET_\\d+']),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('Custom pattern');
    });

    it('respects allowedPatterns (false positive suppression)', () => {
      const result = checkSecretLeak(
        makeInput('Write', { content: 'const key = "AKIAIOSFODNN7EXAMPLE1";' }),
        makeConfig([], ['AKIAIOSFODNN7EXAMPLE1']),
      );
      expect(result.action).toBe('proceed');
    });

    it('scans MultiEdit edits correctly', () => {
      const edits = [
        { new_string: 'const a = 1;' },
        { new_string: 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";' },
      ];
      const result = checkSecretLeak(
        makeInput('MultiEdit', { edits }),
        makeConfig(),
      );
      expect(result.action).toBe('block');
      expect(result.message).toContain('GitHub token');
    });

    it('handles empty content gracefully', () => {
      const result = checkSecretLeak(makeInput('Write', { content: '' }), makeConfig());
      expect(result.action).toBe('proceed');
    });
  });

  describe('createHandler', () => {
    it('returns block result when secret found', async () => {
      const handler = createHandler('PreToolUse');
      const result = await handler(
        makeInput('Write', { content: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' }),
        makeConfig(),
      );
      expect(result).toBeDefined();
      expect(result!.exitCode).toBe(2);
    });

    it('returns undefined when no secret found', async () => {
      const handler = createHandler('PreToolUse');
      const result = await handler(
        makeInput('Write', { content: 'normal code' }),
        makeConfig(),
      );
      expect(result).toBeUndefined();
    });
  });
});
