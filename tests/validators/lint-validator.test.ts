import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runLintValidator } from '../../src/validators/lint-validator.js';
import type { ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let execFileSyncMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const cp = await import('node:child_process');
  execFileSyncMock = cp.execFileSync as unknown as ReturnType<typeof vi.fn>;
  execFileSyncMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function enabledConfig(): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    validators: {
      ...DEFAULT_CONFIG.validators,
      lint: { ...DEFAULT_CONFIG.validators.lint, enabled: true },
    },
  };
}

describe('lint-validator', () => {
  describe('skips unsupported extensions', () => {
    it('skips .md files', () => {
      const result = runLintValidator('README.md', enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toContain('unsupported extension');
    });

    it('skips .css files', () => {
      const result = runLintValidator('styles.css', enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toContain('unsupported extension');
    });

    it('skips .json files', () => {
      const result = runLintValidator('data.json', enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toContain('unsupported extension');
    });

    it('skips .html files', () => {
      const result = runLintValidator('index.html', enabledConfig());
      expect(result.passed).toBe(true);
    });
  });

  describe('when disabled', () => {
    it('returns passed for supported extension when disabled', () => {
      const result = runLintValidator('index.ts', DEFAULT_CONFIG);
      expect(result.passed).toBe(true);
      expect(result.output).toBe('Lint validator disabled');
    });
  });

  describe('when enabled', () => {
    it('returns passed on successful lint', () => {
      execFileSyncMock.mockReturnValue('No errors found');
      const result = runLintValidator('index.ts', enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.command).toContain('eslint');
    });

    it('returns failed on lint failure', () => {
      const error = Object.assign(new Error('Lint failed'), {
        status: 1,
        stdout: 'src/index.ts: error no-unused-vars',
        stderr: '',
      });
      execFileSyncMock.mockImplementation(() => { throw error; });

      const result = runLintValidator('index.ts', enabledConfig());
      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('handles missing linter gracefully (exit 127)', () => {
      const error = Object.assign(new Error('not found'), {
        status: 127,
        stdout: '',
        stderr: 'eslint: not found',
      });
      execFileSyncMock.mockImplementation(() => { throw error; });

      const result = runLintValidator('index.ts', enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toBe('Linter not available');
    });

    it('handles "not recognized" error gracefully', () => {
      const error = Object.assign(new Error('not recognized'), {
        status: 1,
        stdout: '',
        stderr: 'eslint is not recognized as an internal command',
      });
      execFileSyncMock.mockImplementation(() => { throw error; });

      const result = runLintValidator('index.ts', enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toBe('Linter not available');
    });

    it('supports .tsx files', () => {
      execFileSyncMock.mockReturnValue('');
      const result = runLintValidator('component.tsx', enabledConfig());
      expect(result.passed).toBe(true);
    });

    it('supports .jsx files', () => {
      execFileSyncMock.mockReturnValue('');
      const result = runLintValidator('app.jsx', enabledConfig());
      expect(result.passed).toBe(true);
    });

    it('supports .py files', () => {
      execFileSyncMock.mockReturnValue('');
      const result = runLintValidator('script.py', enabledConfig());
      expect(result.passed).toBe(true);
    });

    it('handles filePath with spaces safely', () => {
      execFileSyncMock.mockReturnValue('');
      const result = runLintValidator('my project/src/app.ts', enabledConfig());
      expect(result.passed).toBe(true);
      // filePath with spaces is passed as a separate array element, not shell-interpolated
      const callArgs = execFileSyncMock.mock.calls[0];
      expect(callArgs[1]).toContain('my project/src/app.ts');
    });

    it('handles filePath with special characters safely', () => {
      execFileSyncMock.mockReturnValue('');
      const result = runLintValidator('src/$(whoami).ts', enabledConfig());
      expect(result.passed).toBe(true);
      const callArgs = execFileSyncMock.mock.calls[0];
      expect(callArgs[1]).toContain('src/$(whoami).ts');
    });
  });
});
