import type { PermissionRequestInput, PermissionDecisionOutput, ToolkitConfig, HookEventType, HookHandler, HookInputBase } from '../../types.js';
import { getCachedRegex } from '../../utils/regex-safety.js';

export function matchesPattern(toolName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern === toolName) return true;
    const regex = getCachedRegex(`^${pattern}$`);
    return regex !== null && regex.test(toolName);
  });
}

/**
 * Resolves the permission decision for a tool based on config lists.
 * Priority order: deny > ask > allow > ask-user.
 */
export function resolvePermission(toolName: string, config: ToolkitConfig): 'allow' | 'deny' | 'ask' | 'ask-user' {
  if (matchesPattern(toolName, config.permissions.autoDeny)) return 'deny';
  if (matchesPattern(toolName, config.permissions.autoAsk)) return 'ask';
  if (matchesPattern(toolName, config.permissions.autoAllow)) return 'allow';
  return 'ask-user';
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    const permInput = input as PermissionRequestInput;
    const decision = resolvePermission(permInput.tool_name, config);

    if (decision === 'ask-user') {
      return undefined;
    }

    const output: PermissionDecisionOutput = {
      decision,
      message: decision === 'deny'
        ? `Auto-denied tool: ${permInput.tool_name}`
        : decision === 'ask'
          ? `Requires user confirmation: ${permInput.tool_name}`
          : `Auto-allowed tool: ${permInput.tool_name}`,
    };
    return { exitCode: 0, stdout: JSON.stringify(output) };
  };
}
