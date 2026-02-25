import { describe, it, expect } from 'vitest';
import { checkFileAccess } from '../../src/guards/file-guard.js';
import type { PreToolUseInput, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeInput(toolName: string, filePath: string): PreToolUseInput {
  return {
    session_id: 'test-session',
    tool_name: toolName,
    tool_input: { file_path: filePath },
  };
}

function configWithOverrides(overrides: Partial<ToolkitConfig['guards']['file']> = {}): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    guards: {
      ...DEFAULT_CONFIG.guards,
      file: { ...DEFAULT_CONFIG.guards.file, ...overrides },
    },
  };
}

describe('file-guard', () => {
  describe('blocks protected files', () => {
    it('blocks .env write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/.env'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
      expect(result.message).toContain('.env');
    });

    it('blocks .env.local write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/.env.local'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks .env.production write', () => {
      const result = checkFileAccess(makeInput('Edit', '/project/.env.production'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks .env.development write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/.env.development'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks *.pem write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/cert.pem'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks *.key write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/private.key'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks id_rsa write', () => {
      const result = checkFileAccess(makeInput('Write', '/home/user/.ssh/id_rsa'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks id_rsa.pub write', () => {
      const result = checkFileAccess(makeInput('Write', '/home/user/.ssh/id_rsa.pub'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks *.secret* write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/db.secret.json'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });

    it('blocks MultiEdit on protected files', () => {
      const result = checkFileAccess(makeInput('MultiEdit', '/project/.env'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
    });
  });

  describe('allows safe files', () => {
    it('allows .env.sample', () => {
      const result = checkFileAccess(makeInput('Write', '/project/.env.sample'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('allows .env.example', () => {
      const result = checkFileAccess(makeInput('Write', '/project/.env.example'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('allows normal .ts file write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/src/index.ts'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('allows normal .json file write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/package.json'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('allows normal .js file write', () => {
      const result = checkFileAccess(makeInput('Write', '/project/dist/index.js'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });
  });

  describe('non-write tools', () => {
    it('proceeds for Read tool', () => {
      const result = checkFileAccess(makeInput('Read', '/project/.env'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('proceeds for Grep tool', () => {
      const result = checkFileAccess(makeInput('Grep', '/project/.env'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('proceeds for Bash tool', () => {
      const result = checkFileAccess(makeInput('Bash', '/project/.env'), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });
  });

  describe('disabled guard', () => {
    it('proceeds when guard is disabled', () => {
      const config = configWithOverrides({ enabled: false });
      const result = checkFileAccess(makeInput('Write', '/project/.env'), config);
      expect(result.action).toBe('proceed');
    });
  });

  describe('edge cases', () => {
    it('proceeds for empty file_path', () => {
      const result = checkFileAccess(makeInput('Write', ''), DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('proceeds for non-string file_path', () => {
      const input: PreToolUseInput = {
        session_id: 'test',
        tool_name: 'Write',
        tool_input: { file_path: 42 as unknown as string },
      };
      const result = checkFileAccess(input, DEFAULT_CONFIG);
      expect(result.action).toBe('proceed');
    });

    it('block result includes details', () => {
      const result = checkFileAccess(makeInput('Write', '/project/.env'), DEFAULT_CONFIG);
      expect(result.action).toBe('block');
      expect(result.details).toBeDefined();
      expect(result.details?.filePath).toBe('/project/.env');
      expect(result.details?.matchedPattern).toBe('.env');
    });
  });
});
