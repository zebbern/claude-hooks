import type { PreToolUseInput, GuardResult, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { WRITE_TOOLS, collectWriteContent } from '../../utils/tool-inputs.js';
import { guardResultToHandlerResult } from '../../utils/guard-result.js';
import { countLines } from '../../utils/text.js';

/**
 * Checks whether a Write/Edit/MultiEdit operation exceeds the configured max line limit.
 *
 * - For `Write`: counts lines in `tool_input.content`.
 * - For `Edit`: counts lines in `tool_input.new_string`.
 * - For `MultiEdit`: sums lines across all `tool_input.edits[].new_string`.
 *
 * @param input - The `PreToolUse` hook input.
 * @param config - The resolved toolkit configuration.
 * @returns A {@link GuardResult} with `action: 'block'` if over limit, else `'proceed'`.
 */
export function checkDiffSize(input: PreToolUseInput, config: ToolkitConfig): GuardResult {
  if (!WRITE_TOOLS.has(input.tool_name)) {
    return { action: 'proceed' };
  }

  if (!config.guards.diffSize.enabled) {
    return { action: 'proceed' };
  }

  const maxLines = config.guards.diffSize.maxLines;
  const chunks = collectWriteContent(input);
  let totalLines = 0;
  for (const chunk of chunks) {
    totalLines += countLines(chunk);
  }

  if (totalLines > maxLines) {
    return {
      action: 'block',
      message: `Diff size ${totalLines} lines exceeds maximum of ${maxLines} lines`,
      details: { totalLines, maxLines, toolName: input.tool_name },
    };
  }

  return { action: 'proceed' };
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const result = checkDiffSize(input as PreToolUseInput, config);
    return guardResultToHandlerResult(result, 'Diff size exceeded');
  };
}
