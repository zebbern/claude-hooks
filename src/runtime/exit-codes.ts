/** Exit code indicating the hook passed and execution should proceed. */
export const EXIT_PROCEED = 0 as const;

/** Exit code indicating the hook encountered an error. */
export const EXIT_ERROR = 1 as const;

/** Exit code indicating the hook rejected (blocked) the action. */
export const EXIT_BLOCK = 2 as const;

/**
 * Writes a message to stderr and exits the process with {@link EXIT_BLOCK} (code 2).
 *
 * @param message - The block reason written to stderr.
 * @returns Never — the process exits.
 */
export function exitWithBlock(message: string): never {
  process.stderr.write(message + '\n');
  process.exit(EXIT_BLOCK);
}
