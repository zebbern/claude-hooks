import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTypecheckValidator } from '../../src/validators/typecheck-validator.js';
import type { ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, default: { ...actual, existsSync: vi.fn() } };
});

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let execFileSyncMock: ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let existsSyncMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const cp = await import('node:child_process');
  execFileSyncMock = cp.execFileSync as unknown as ReturnType<typeof vi.fn>;
  execFileSyncMock.mockReset();

  const fsMod = await import('node:fs');
  existsSyncMock = fsMod.default.existsSync as ReturnType<typeof vi.fn>;
  existsSyncMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function enabledConfig(): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    validators: {
      ...DEFAULT_CONFIG.validators,
      typecheck: { ...DEFAULT_CONFIG.validators.typecheck, enabled: true },
    },
  };
}

describe('typecheck-validator', () => {
  describe('when disabled', () => {
    it('returns passed when disabled', () => {
      const result = runTypecheckValidator(DEFAULT_CONFIG);
      expect(result.passed).toBe(true);
      expect(result.output).toBe('Typecheck validator disabled');
    });
  });

  describe('when enabled', () => {
    it('skips when no tsconfig.json found', () => {
      existsSyncMock.mockReturnValue(false);
      const result = runTypecheckValidator(enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toContain('No tsconfig.json');
    });

    it('returns passed on successful typecheck', () => {
      existsSyncMock.mockReturnValue(true);
      execFileSyncMock.mockReturnValue('');
      const result = runTypecheckValidator(enabledConfig());
      expect(result.passed).toBe(true);
    });

    it('returns failed on typecheck errors', () => {
      existsSyncMock.mockReturnValue(true);
      const error = Object.assign(new Error('tsc error'), {
        status: 2,
        stdout: 'src/index.ts(5,3): error TS2322',
        stderr: '',
      });
      execFileSyncMock.mockImplementation(() => { throw error; });

      const result = runTypecheckValidator(enabledConfig());
      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it('handles missing tsc gracefully (exit 127)', () => {
      existsSyncMock.mockReturnValue(true);
      const error = Object.assign(new Error('not found'), {
        status: 127,
        stdout: '',
        stderr: 'tsc: not found',
      });
      execFileSyncMock.mockImplementation(() => { throw error; });

      const result = runTypecheckValidator(enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toBe('TypeScript compiler not available');
    });

    it('handles "not recognized" error gracefully', () => {
      existsSyncMock.mockReturnValue(true);
      const error = Object.assign(new Error('not recognized'), {
        status: 1,
        stdout: '',
        stderr: 'tsc is not recognized',
      });
      execFileSyncMock.mockImplementation(() => { throw error; });

      const result = runTypecheckValidator(enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toBe('TypeScript compiler not available');
    });

    it('uses command from config', () => {
      existsSyncMock.mockReturnValue(true);
      execFileSyncMock.mockReturnValue('');
      const result = runTypecheckValidator(enabledConfig());
      expect(result.command).toBe('npx tsc --noEmit');
    });

    it('handles non-ExecSyncError gracefully', () => {
      existsSyncMock.mockReturnValue(true);
      execFileSyncMock.mockImplementation(() => { throw new TypeError('Unexpected'); });

      const result = runTypecheckValidator(enabledConfig());
      expect(result.passed).toBe(true);
      expect(result.output).toBe('TypeScript compiler not available');
    });
  });
});
