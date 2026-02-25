/**
 * Counts the number of lines in a text string.
 *
 * @param text - The text to count lines in.
 * @returns The number of lines, or 0 if the text is empty/falsy.
 */
export function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}
