import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { suggestSimilar, formatUnknownValue, formatInvalidJsonError, formatConfigParseError } from '../../src/cli-errors.js';

/**
 * Helper to run the CLI as a subprocess and capture stdout, stderr, and exit code.
 */
function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const cliPath = path.resolve(__dirname, '..', '..', 'dist', 'cli.js');
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    timeout: 15_000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

describe('cli-errors helpers', () => {
  describe('suggestSimilar', () => {
    const options = ['minimal', 'security', 'quality', 'full'];

    it('returns exact prefix match', () => {
      expect(suggestSimilar('sec', options)).toBe('security');
    });

    it('returns close Levenshtein match', () => {
      expect(suggestSimilar('securty', options)).toBe('security');
    });

    it('returns null for completely unrelated input', () => {
      expect(suggestSimilar('xyzabc123', options)).toBeNull();
    });

    it('returns match for startsWith match', () => {
      expect(suggestSimilar('min', options)).toBe('minimal');
    });

    it('handles empty options list', () => {
      expect(suggestSimilar('test', [])).toBeNull();
    });

    it('finds close match for feature names', () => {
      const features = ['command-guard', 'file-guard', 'path-guard', 'secret-leak-guard', 'logger'];
      expect(suggestSimilar('comand-guard', features)).toBe('command-guard');
    });

    it('finds match when value starts with option', () => {
      const features = ['logger', 'lint-validator'];
      expect(suggestSimilar('loggerx', features)).toBe('logger');
    });
  });

  describe('formatUnknownValue', () => {
    it('includes label, value, and available options', () => {
      const result = formatUnknownValue('preset', 'xyz', ['minimal', 'security', 'quality', 'full']);
      expect(result).toContain("Unknown preset 'xyz'");
      expect(result).toContain('Available presets:');
      expect(result).toContain('minimal');
      expect(result).toContain('security');
    });

    it('includes did-you-mean when close match exists', () => {
      const result = formatUnknownValue('preset', 'securty', ['minimal', 'security', 'quality', 'full']);
      expect(result).toContain("Unknown preset 'securty'");
      expect(result).toContain('Did you mean');
      expect(result).toContain('security');
    });

    it('omits did-you-mean when no close match', () => {
      const result = formatUnknownValue('preset', 'xyzabc123', ['minimal', 'security', 'quality', 'full']);
      expect(result).toContain("Unknown preset 'xyzabc123'");
      expect(result).not.toContain('Did you mean');
    });
  });

  describe('formatInvalidJsonError', () => {
    it('includes context and expected format', () => {
      const result = formatInvalidJsonError('in --input', '{"tool_name": "Write"}');
      expect(result).toContain('Invalid JSON in --input');
      expect(result).toContain('Expected format:');
      expect(result).toContain('{"tool_name": "Write"}');
    });
  });

  describe('formatConfigParseError', () => {
    it('includes path, error, and suggestion to validate', () => {
      const result = formatConfigParseError('/some/path/config.json', 'Unexpected token');
      expect(result).toContain("Failed to parse config at '/some/path/config.json'");
      expect(result).toContain('Unexpected token');
      expect(result).toContain('claude-hooks config validate');
    });
  });
});

describe('improved CLI error messages', () => {
  it('shows available presets on invalid preset for init', () => {
    const result = runCli(['init', '.', '--preset', 'badpreset']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown preset 'badpreset'");
    expect(result.stderr).toContain('Available presets:');
    expect(result.stderr).toContain('minimal');
    expect(result.stderr).toContain('security');
  });

  it('shows available hook types on invalid hook type for test', () => {
    const result = runCli(['test', 'BadHookType', '--input', '{}']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown hook type 'BadHookType'");
    expect(result.stderr).toContain('PreToolUse');
    expect(result.stderr).toContain('PostToolUse');
  });

  it('shows expected JSON format on invalid JSON for test --input', () => {
    const result = runCli(['test', 'PreToolUse', '--input', 'not-json']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid JSON');
    expect(result.stderr).toContain('Expected format:');
  });

  it('shows contextual config parse error', () => {
    // Create a temporary bad config and try to validate it
    const fs = require('node:fs');
    const os = require('node:os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-err-'));
    const configPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(configPath, '{invalid json content', 'utf-8');

    const result = runCli(['config', 'validate', '--config', configPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Failed to parse config');
    expect(result.stderr).toContain('claude-hooks config validate');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows did-you-mean for close feature name in add', () => {
    const result = runCli(['add', 'comand-guard']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
    expect(result.stderr).toContain('Did you mean');
    expect(result.stderr).toContain('command-guard');
  });

  it('shows available presets on invalid preset for config generate', () => {
    const result = runCli(['config', 'generate', '--preset', 'badpreset', '--dry-run']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown preset 'badpreset'");
    expect(result.stderr).toContain('Available presets:');
  });
});
