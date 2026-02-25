import readline from 'node:readline';

export interface ReadlineInterface {
  question: (query: string, callback: (answer: string) => void) => void;
  close: () => void;
}

/**
 * Creates a readline interface for interactive prompts.
 * Extracted to allow dependency injection in tests.
 */
export function createReadlineInterface(): ReadlineInterface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts the user with a question and returns the answer as a promise.
 */
function askRaw(rl: ReadlineInterface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer: string) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Asks the user to choose from a list of options.
 *
 * @param rl - The readline interface to use for prompting.
 * @param question - The question to display.
 * @param choices - The valid choices the user can select.
 * @param defaultChoice - The default choice if the user presses Enter.
 * @returns The selected choice string.
 */
export async function askChoice(
  rl: ReadlineInterface,
  question: string,
  choices: readonly string[],
  defaultChoice: string,
): Promise<string> {
  const choiceList = choices
    .map((c) => (c === defaultChoice ? `[${c}]` : c))
    .join(' / ');
  const prompt = `${question} (${choiceList}): `;
  const answer = await askRaw(rl, prompt);

  if (answer === '') {
    return defaultChoice;
  }

  const lower = answer.toLowerCase();
  const match = choices.find((c) => c.toLowerCase() === lower);
  if (match) {
    return match;
  }

  // No valid match — return default
  return defaultChoice;
}

/**
 * Asks the user a yes/no question.
 *
 * @param rl - The readline interface to use for prompting.
 * @param question - The question to display.
 * @param defaultAnswer - The default boolean if the user presses Enter.
 * @returns `true` for yes, `false` for no.
 */
export async function askYesNo(
  rl: ReadlineInterface,
  question: string,
  defaultAnswer: boolean,
): Promise<boolean> {
  const hint = defaultAnswer ? 'Y/n' : 'y/N';
  const prompt = `${question} (${hint}): `;
  const answer = await askRaw(rl, prompt);

  if (answer === '') {
    return defaultAnswer;
  }

  const lower = answer.toLowerCase();
  if (lower === 'y' || lower === 'yes') {
    return true;
  }
  if (lower === 'n' || lower === 'no') {
    return false;
  }

  return defaultAnswer;
}

/**
 * Asks the user for a string value.
 *
 * @param rl - The readline interface to use for prompting.
 * @param question - The question to display.
 * @param defaultValue - The default value if the user presses Enter.
 * @returns The user's input or the default value.
 */
export async function askString(
  rl: ReadlineInterface,
  question: string,
  defaultValue: string,
): Promise<string> {
  const prompt = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;
  const answer = await askRaw(rl, prompt);

  return answer === '' ? defaultValue : answer;
}

/**
 * The collected answers from the interactive init wizard.
 */
export interface InitWizardAnswers {
  preset: string;
  format: string;
  enableSecretLeak: boolean;
  enableFileBackup: boolean;
  configPath: string;
}

/**
 * Runs the interactive init wizard, collecting user preferences.
 *
 * @param rl - The readline interface to use for prompting.
 * @returns The collected answers.
 */
export async function runInitWizard(rl: ReadlineInterface): Promise<InitWizardAnswers> {
  const preset = await askChoice(
    rl,
    'Which preset?',
    ['minimal', 'recommended', 'security', 'quality', 'full'],
    'security',
  );

  const format = await askChoice(
    rl,
    'Output format?',
    ['claude', 'vscode', 'both'],
    'claude',
  );

  const enableSecretLeak = await askYesNo(
    rl,
    'Enable secret-leak detection?',
    true,
  );

  const enableFileBackup = await askYesNo(
    rl,
    'Enable file backup?',
    false,
  );

  const configPath = await askString(
    rl,
    'Config file path?',
    'claude-hooks.config.json',
  );

  return {
    preset,
    format,
    enableSecretLeak,
    enableFileBackup,
    configPath,
  };
}
