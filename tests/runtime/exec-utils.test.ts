import { describe, it, expect } from 'vitest';
import { isExecSyncError } from '../../src/runtime/exec-utils.js';

describe('isExecSyncError', () => {
  describe('returns true for valid ExecSyncError objects', () => {
    it('returns true for object with numeric status', () => {
      expect(isExecSyncError({ status: 1, stdout: '', stderr: '' })).toBe(true);
    });

    it('returns true for object with null status', () => {
      expect(isExecSyncError({ status: null, stdout: '', stderr: '' })).toBe(true);
    });

    it('returns true for object with status 0', () => {
      expect(isExecSyncError({ status: 0, stdout: '', stderr: '' })).toBe(true);
    });

    it('returns true for Error-like object with status', () => {
      const err = new Error('fail');
      (err as unknown as Record<string, unknown>).status = 1;
      (err as unknown as Record<string, unknown>).stdout = '';
      (err as unknown as Record<string, unknown>).stderr = '';
      expect(isExecSyncError(err)).toBe(true);
    });

    it('returns true for object with only status (minimal)', () => {
      expect(isExecSyncError({ status: 127 })).toBe(true);
    });
  });

  describe('returns false for non-ExecSyncError values', () => {
    it('returns false for null', () => {
      expect(isExecSyncError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isExecSyncError(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isExecSyncError('error')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isExecSyncError(42)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(isExecSyncError(true)).toBe(false);
    });

    it('returns false for object without status', () => {
      expect(isExecSyncError({ message: 'fail' })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isExecSyncError({})).toBe(false);
    });

    it('returns false for array', () => {
      expect(isExecSyncError([1, 2, 3])).toBe(false);
    });

    it('returns false for plain Error without status', () => {
      expect(isExecSyncError(new Error('plain'))).toBe(false);
    });
  });
});
