import { describe, it, expect } from 'vitest';
import { countLines } from '../../src/utils/text.js';

describe('countLines', () => {
  it('returns 0 for empty string', () => {
    expect(countLines('')).toBe(0);
  });

  it('returns 1 for a single line without newline', () => {
    expect(countLines('hello')).toBe(1);
  });

  it('counts multiple lines', () => {
    expect(countLines('line1\nline2\nline3')).toBe(3);
  });

  it('counts trailing newline as an extra line', () => {
    // "hello\n" splits into ["hello", ""] → 2 elements
    expect(countLines('hello\n')).toBe(2);
  });

  it('handles Windows \\r\\n line endings', () => {
    // split('\n') treats \r\n as a single split point
    // "a\r\nb\r\nc" → ["a\r", "b\r", "c"] → 3
    expect(countLines('a\r\nb\r\nc')).toBe(3);
  });

  it('returns 0 for falsy-like empty string', () => {
    expect(countLines('')).toBe(0);
  });
});
