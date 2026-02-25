import fs from 'node:fs';
import path from 'node:path';
import type {
  HookEventType,
  HookHandler,
  HookInputBase,
  ToolkitConfig,
} from '../../types.js';

/**
 * Reads and concatenates project context files for injection.
 *
 * Reads each file listed in `config.contextInjector.contextFiles`, concatenates
 * their content, and returns it. Missing or unreadable files are silently skipped.
 *
 * @param hookType - The current hook event type (for logging/debugging).
 * @param config - The resolved toolkit configuration.
 * @returns The concatenated context content, or `undefined` if no content is available.
 */
export function injectContext(
  _hookType: HookEventType,
  config: ToolkitConfig,
): string | undefined {
  if (!config.contextInjector.enabled) {
    return undefined;
  }

  const contextFiles = config.contextInjector.contextFiles;
  if (!contextFiles || contextFiles.length === 0) {
    return undefined;
  }

  const chunks: string[] = [];

  for (const filePath of contextFiles) {
    try {
      const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      if (!fs.existsSync(resolved)) {
        continue;
      }
      const content = fs.readFileSync(resolved, 'utf-8').trim();
      if (content) {
        chunks.push(content);
      }
    } catch {
      // Skip unreadable files silently
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return chunks.join('\n\n');
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  return async (_input, config) => {
    try {
      const content = injectContext(hookType, config);
      if (!content) {
        return undefined;
      }
      return {
        exitCode: 0,
        stdout: JSON.stringify({ additionalContext: content }),
      };
    } catch {
      // Best-effort — never crash the hook
      return undefined;
    }
  };
}
