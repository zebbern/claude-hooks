import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  askChoice,
  askYesNo,
  askString,
  runInitWizard,
} from '../../src/cli-prompts.js';
import type { ReadlineInterface, InitWizardAnswers } from '../../src/cli-prompts.js';

/**
 * Creates a mock readline interface that answers questions sequentially.
 * Each call to `question` resolves with the next answer from the array.
 */
function createMockReadline(answers: string[]): ReadlineInterface {
  let index = 0;
  return {
    question: (_query: string, callback: (answer: string) => void) => {
      const answer = index < answers.length ? answers[index] : '';
      index++;
      callback(answer);
    },
    close: vi.fn(),
  };
}

describe('askChoice', () => {
  it('returns default choice when user presses Enter', async () => {
    const rl = createMockReadline(['']);
    const result = await askChoice(rl, 'Pick one', ['a', 'b', 'c'], 'b');
    expect(result).toBe('b');
  });

  it('returns user selection when valid', async () => {
    const rl = createMockReadline(['c']);
    const result = await askChoice(rl, 'Pick one', ['a', 'b', 'c'], 'a');
    expect(result).toBe('c');
  });

  it('is case-insensitive', async () => {
    const rl = createMockReadline(['SECURITY']);
    const result = await askChoice(rl, 'Preset?', ['minimal', 'security', 'full'], 'minimal');
    expect(result).toBe('security');
  });

  it('returns default for invalid input', async () => {
    const rl = createMockReadline(['invalid']);
    const result = await askChoice(rl, 'Pick one', ['a', 'b', 'c'], 'b');
    expect(result).toBe('b');
  });
});

describe('askYesNo', () => {
  it('returns default true when user presses Enter', async () => {
    const rl = createMockReadline(['']);
    const result = await askYesNo(rl, 'Enable?', true);
    expect(result).toBe(true);
  });

  it('returns default false when user presses Enter', async () => {
    const rl = createMockReadline(['']);
    const result = await askYesNo(rl, 'Enable?', false);
    expect(result).toBe(false);
  });

  it('returns true for "y"', async () => {
    const rl = createMockReadline(['y']);
    const result = await askYesNo(rl, 'Enable?', false);
    expect(result).toBe(true);
  });

  it('returns true for "yes"', async () => {
    const rl = createMockReadline(['yes']);
    const result = await askYesNo(rl, 'Enable?', false);
    expect(result).toBe(true);
  });

  it('returns false for "n"', async () => {
    const rl = createMockReadline(['n']);
    const result = await askYesNo(rl, 'Enable?', true);
    expect(result).toBe(false);
  });

  it('returns false for "no"', async () => {
    const rl = createMockReadline(['no']);
    const result = await askYesNo(rl, 'Enable?', true);
    expect(result).toBe(false);
  });

  it('returns default for unrecognized input', async () => {
    const rl = createMockReadline(['maybe']);
    const result = await askYesNo(rl, 'Enable?', true);
    expect(result).toBe(true);
  });

  it('is case-insensitive', async () => {
    const rl = createMockReadline(['YES']);
    const result = await askYesNo(rl, 'Enable?', false);
    expect(result).toBe(true);
  });
});

describe('askString', () => {
  it('returns default when user presses Enter', async () => {
    const rl = createMockReadline(['']);
    const result = await askString(rl, 'Path?', 'default.json');
    expect(result).toBe('default.json');
  });

  it('returns user input when provided', async () => {
    const rl = createMockReadline(['custom.json']);
    const result = await askString(rl, 'Path?', 'default.json');
    expect(result).toBe('custom.json');
  });

  it('trims whitespace from input', async () => {
    const rl = createMockReadline(['  custom.json  ']);
    const result = await askString(rl, 'Path?', 'default.json');
    expect(result).toBe('custom.json');
  });
});

describe('runInitWizard', () => {
  it('collects all answers with defaults', async () => {
    // All empty answers → all defaults
    const rl = createMockReadline(['', '', '', '', '']);
    const answers: InitWizardAnswers = await runInitWizard(rl);

    expect(answers.preset).toBe('security');
    expect(answers.format).toBe('claude');
    expect(answers.enableSecretLeak).toBe(true);
    expect(answers.enableFileBackup).toBe(false);
    expect(answers.configPath).toBe('claude-hooks.config.json');
  });

  it('collects custom answers', async () => {
    const rl = createMockReadline(['full', 'both', 'n', 'y', 'my-config.json']);
    const answers: InitWizardAnswers = await runInitWizard(rl);

    expect(answers.preset).toBe('full');
    expect(answers.format).toBe('both');
    expect(answers.enableSecretLeak).toBe(false);
    expect(answers.enableFileBackup).toBe(true);
    expect(answers.configPath).toBe('my-config.json');
  });

  it('accepts recommended preset', async () => {
    const rl = createMockReadline(['recommended', '', '', '', '']);
    const answers: InitWizardAnswers = await runInitWizard(rl);

    expect(answers.preset).toBe('recommended');
  });

  it('accepts minimal preset', async () => {
    const rl = createMockReadline(['minimal', 'vscode', 'y', 'y', '']);
    const answers: InitWizardAnswers = await runInitWizard(rl);

    expect(answers.preset).toBe('minimal');
    expect(answers.format).toBe('vscode');
    expect(answers.enableSecretLeak).toBe(true);
    expect(answers.enableFileBackup).toBe(true);
    expect(answers.configPath).toBe('claude-hooks.config.json');
  });
});
