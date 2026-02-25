import { normalizeHookInput } from './input-normalizer.js';

const STDIN_TIMEOUT_MS = 5_000;

/** Maximum allowed stdin payload size (10 MB). Prevents memory exhaustion from large payloads. */
export const MAX_STDIN_BYTES = 10 * 1024 * 1024;

/**
 * Error thrown when stdin input cannot be parsed as valid JSON.
 *
 * Possible causes: empty input, non-object JSON, parse failure, TTY stdin, or
 * a 5-second read timeout.
 */
export class StdinParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StdinParseError';
  }
}

/**
 * Reads raw JSON from stdin without normalization.
 *
 * Collects raw `Buffer` chunks until the stream ends (or a 5-second timeout),
 * then parses the result as a JSON object. Does not apply input normalization,
 * making it suitable for format detection before processing.
 *
 * @returns The parsed JSON object without normalization.
 * @throws {StdinParseError} If stdin is empty, not valid JSON, not an object, is a TTY, or times out.
 */
export async function readStdinRaw(): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let resolved = false;

    const finalize = () => {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('end');
      process.stdin.removeAllListeners('error');

      if (chunks.length === 0) {
        reject(new StdinParseError('No input received on stdin'));
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf-8').replace(/\r\n/g, '\n').trim();
        if (!raw) {
          reject(new StdinParseError('Empty input received on stdin'));
          return;
        }
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
          reject(new StdinParseError('Stdin input must be a JSON object'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reject(new StdinParseError(`Failed to parse stdin as JSON: ${msg}`));
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('error');
        reject(new StdinParseError('Stdin read timed out after 5 seconds'));
      }
    }, STDIN_TIMEOUT_MS);

    if (process.stdin.isTTY) {
      clearTimeout(timer);
      reject(new StdinParseError('No piped input available (stdin is a TTY)'));
      return;
    }

    // Collect raw Buffers without setEncoding to avoid type confusion
    let totalBytes = 0;
    process.stdin.on('data', (chunk: Buffer) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += buf.length;
      if (totalBytes > MAX_STDIN_BYTES) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          process.stdin.removeAllListeners('data');
          process.stdin.removeAllListeners('end');
          process.stdin.removeAllListeners('error');
          reject(new StdinParseError(`Stdin payload exceeds ${MAX_STDIN_BYTES / (1024 * 1024)} MB limit`));
        }
        return;
      }
      chunks.push(buf);
    });
    process.stdin.on('end', finalize);
    process.stdin.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new StdinParseError(`Stdin read error: ${err.message}`));
      }
    });
    process.stdin.resume();
  });
}

/**
 * Reads and parses JSON from stdin with input normalization.
 *
 * Reads raw stdin via {@link readStdinRaw}, then applies
 * {@link normalizeHookInput} to convert VS Code camelCase fields to snake_case.
 *
 * @deprecated Use {@link readStdinRaw} + {@link normalizeHookInput} instead.
 * Retained for backward compatibility in the CLI test command.
 * @typeParam T - The expected shape of the parsed JSON.
 * @returns The parsed and normalized JSON object.
 * @throws {StdinParseError} If stdin is empty, not valid JSON, not an object, is a TTY, or times out.
 */
export async function readStdinJson<T>(): Promise<T> {
  const raw = await readStdinRaw();
  return normalizeHookInput<T>(raw);
}
