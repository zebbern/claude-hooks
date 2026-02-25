import type { HookEventType, HookHandler, HookInputBase, LazyFeatureDescriptor, ToolkitConfig } from '../types.js';
import { getFeatureRegistry } from './feature-registry.js';
import { isFeatureEnabled } from './feature-registry.js';
import { lazyBuiltInFeatures } from '../features/lazy-features.js';

/**
 * Loads enabled handlers for a given hook type, sorted by priority (ascending).
 *
 * Queries the feature registry for features matching the hook type that are
 * enabled according to the provided config, then creates handlers from each
 * feature module. Handlers are sorted by priority (lower = earlier in pipeline).
 *
 * @param hookType - The hook event type to load handlers for.
 * @param config - The resolved toolkit configuration for enabled-flag checks.
 * @returns An array of hook handlers sorted by ascending priority.
 */
export function loadEnabledHandlers<T extends HookInputBase>(
  hookType: HookEventType,
  config: ToolkitConfig,
): HookHandler<T>[] {
  const registry = getFeatureRegistry();
  const features = registry.getEnabled(hookType, config);

  // Sort by priority (lower = earlier in pipeline)
  features.sort((a, b) => a.meta.priority - b.meta.priority);

  return features.map((f) => f.createHandler(hookType) as HookHandler<T>);
}

/**
 * Lazily loads enabled handlers for a given hook type, sorted by priority.
 *
 * Unlike {@link loadEnabledHandlers}, this function only dynamically imports
 * the feature modules that match the requested hook type, avoiding the cost
 * of importing all 26 built-in features when only a subset is needed.
 *
 * Feature metadata (which determines hook type matching and enabled status)
 * is loaded eagerly since it's lightweight. The full handler module is only
 * imported when the feature passes both the hook type and enabled filters.
 *
 * @param hookType - The hook event type to load handlers for.
 * @param config - The resolved toolkit configuration for enabled-flag checks.
 * @param descriptors - Optional lazy descriptors (defaults to built-in features).
 * @returns A promise resolving to hook handlers sorted by ascending priority.
 */
export async function loadEnabledHandlersAsync<T extends HookInputBase>(
  hookType: HookEventType,
  config: ToolkitConfig,
  descriptors: LazyFeatureDescriptor[] = lazyBuiltInFeatures,
): Promise<HookHandler<T>[]> {
  // Filter by hook type and enabled status using lightweight metadata only
  const matching = descriptors
    .filter((d) => d.meta.hookTypes.includes(hookType))
    .filter((d) => isFeatureEnabled(d.meta, config));

  // Sort by priority before loading (lower = earlier in pipeline)
  matching.sort((a, b) => a.meta.priority - b.meta.priority);

  // Dynamically import only the matching feature modules in parallel
  const features = await Promise.all(matching.map((d) => d.load()));

  return features.map((f) => f.createHandler(hookType) as HookHandler<T>);
}
