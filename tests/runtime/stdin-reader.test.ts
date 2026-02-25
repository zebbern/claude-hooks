import { describe, it, expect } from 'vitest';
import { StdinParseError, MAX_STDIN_BYTES } from '../../src/runtime/stdin-reader.js';

describe('StdinParseError', () => {
  it('is an instance of Error', () => {
    const error = new StdinParseError('test message');
    expect(error).toBeInstanceOf(Error);
  });

  it('has name StdinParseError', () => {
    const error = new StdinParseError('test');
    expect(error.name).toBe('StdinParseError');
  });

  it('preserves message', () => {
    const error = new StdinParseError('failed to parse');
    expect(error.message).toBe('failed to parse');
  });

  it('has a stack trace', () => {
    const error = new StdinParseError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('StdinParseError');
  });

  it('can be caught as Error', () => {
    let caught = false;
    try {
      throw new StdinParseError('catch me');
    } catch (err) {
      if (err instanceof Error) {
        caught = true;
        expect(err.message).toBe('catch me');
      }
    }
    expect(caught).toBe(true);
  });

  it('can be identified by name property', () => {
    const error = new StdinParseError('identify me');
    expect(error.name).toBe('StdinParseError');
    expect(error.name).not.toBe('Error');
  });

  it('preserves empty message', () => {
    const error = new StdinParseError('');
    expect(error.message).toBe('');
  });

  it('preserves message with special characters', () => {
    const msg = 'Failed: "invalid JSON" at position 0\n\ttab';
    const error = new StdinParseError(msg);
    expect(error.message).toBe(msg);
  });

  it('stack trace includes StdinParseError name', () => {
    const error = new StdinParseError('stack test');
    expect(error.stack).toContain('StdinParseError');
  });

  it('is distinguishable from plain Error', () => {
    const stdinErr = new StdinParseError('stdin');
    const plainErr = new Error('plain');
    expect(stdinErr.name).not.toBe(plainErr.name);
    expect(stdinErr).toBeInstanceOf(Error);
    expect(plainErr).not.toBeInstanceOf(StdinParseError);
  });
});

describe('MAX_STDIN_BYTES', () => {
  it('is exported and equals 10 MB', () => {
    expect(MAX_STDIN_BYTES).toBe(10 * 1024 * 1024);
  });

  it('is a positive number', () => {
    expect(MAX_STDIN_BYTES).toBeGreaterThan(0);
  });
});
