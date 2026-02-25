import { createHookRunner } from '../runtime/index.js';
import { loadEnabledHandlersAsync } from '../registry/index.js';
import { loadConfig } from '../config.js';
import type { HookEventType, HookInputMap } from '../types.js';

/**
 * Shared hook dispatcher — loads config, resolves enabled handlers for the
 * given hook type, and starts the hook runner pipeline.
 *
 * Each hook entry-point file delegates to this function so the
 * config → handlers → runner wiring lives in one place.
 */
export async function runHook<K extends HookEventType>(hookType: K): Promise<void> {
  const config = loadConfig();
  const handlers = await loadEnabledHandlersAsync<HookInputMap[K]>(hookType, config);
  createHookRunner<HookInputMap[K]>(hookType, handlers, config);
}
