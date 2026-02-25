/**
 * Read/write helpers for JSONL (JSON Lines) files.
 *
 * JSONL is used throughout the toolkit for session logs, error patterns,
 * change records, and rate-limiting state.
 */

import fs from 'node:fs';

/**
 * Reads and parses a JSONL file into an array of typed records.
 *
 * Returns an empty array if the file does not exist or cannot be read.
 * Malformed lines are silently skipped.
 *
 * @typeParam T - The expected record shape.
 * @param filePath - Absolute path to the JSONL file.
 * @returns Parsed records from the file.
 */
export function readJsonlRecords<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];

  const records: T[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        records.push(JSON.parse(line) as T);
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Best-effort read
  }

  return records;
}

/**
 * Appends a single JSON record as a new line in a JSONL file.
 *
 * @param filePath - Absolute path to the JSONL file.
 * @param record - The value to serialize and append.
 */
export function appendJsonlRecord(filePath: string, record: unknown): void {
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8');
}
