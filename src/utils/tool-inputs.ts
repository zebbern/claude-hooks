/**
 * Shared constants and helpers for extracting content from Claude tool inputs.
 *
 * Used by guards, validators, and trackers that inspect Write/Edit/MultiEdit operations.
 */

/** Tool names that perform file write or edit operations. */
export const WRITE_TOOLS: ReadonlySet<string> = new Set(['Write', 'Edit', 'MultiEdit']);

/**
 * Tool names that perform file writes/edits OR execute shell commands.
 *
 * Use this when you need to guard against any operation that can modify the
 * working tree — e.g., branch protection, where both file edits and shell
 * commands (Bash) should be blocked.
 */
export const WRITE_AND_EXEC_TOOLS: ReadonlySet<string> = new Set(['Write', 'Edit', 'MultiEdit', 'Bash']);

/**
 * Checks whether a tool name corresponds to a write/edit operation.
 *
 * @param toolName - The tool name from the hook input.
 * @returns `true` if the tool is `Write`, `Edit`, or `MultiEdit`.
 */
export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}

/**
 * Extracts content strings from Write/Edit/MultiEdit tool inputs.
 *
 * - `Write`: returns the `content` field as a single-element array.
 * - `Edit`: returns the `new_string` field as a single-element array.
 * - `MultiEdit`: returns one element per edit's `new_string`.
 * - Other tools: returns an empty array.
 *
 * @param input - An object with `tool_name` and `tool_input` (matches PreToolUseInput / PostToolUseInput).
 * @returns Non-empty content strings extracted from the tool input.
 */
export function collectWriteContent(
  input: { tool_name: string; tool_input: Record<string, unknown> },
): string[] {
  const chunks: string[] = [];

  switch (input.tool_name) {
    case 'Write': {
      const content = typeof input.tool_input.content === 'string' ? input.tool_input.content : '';
      if (content) chunks.push(content);
      break;
    }
    case 'Edit': {
      const newString = typeof input.tool_input.new_string === 'string' ? input.tool_input.new_string : '';
      if (newString) chunks.push(newString);
      break;
    }
    case 'MultiEdit': {
      const edits = Array.isArray(input.tool_input.edits) ? input.tool_input.edits : [];
      for (const edit of edits) {
        if (typeof edit === 'object' && edit !== null && 'new_string' in edit) {
          const ns = typeof (edit as Record<string, unknown>).new_string === 'string'
            ? (edit as Record<string, unknown>).new_string as string
            : '';
          if (ns) chunks.push(ns);
        }
      }
      break;
    }
  }

  return chunks;
}
