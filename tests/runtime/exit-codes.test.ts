import { describe, it, expect } from 'vitest';
import { EXIT_PROCEED, EXIT_ERROR, EXIT_BLOCK, exitWithBlock } from '../../src/runtime/exit-codes.js';

describe('exit-codes', () => {
  it('EXIT_PROCEED is 0', () => {
    expect(EXIT_PROCEED).toBe(0);
  });

  it('EXIT_ERROR is 1', () => {
    expect(EXIT_ERROR).toBe(1);
  });

  it('EXIT_BLOCK is 2', () => {
    expect(EXIT_BLOCK).toBe(2);
  });

  it('exitWithBlock is a function', () => {
    expect(typeof exitWithBlock).toBe('function');
  });
});
