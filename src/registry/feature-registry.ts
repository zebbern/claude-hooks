import type { FeatureModule, FeatureMeta, HookEventType, HookInputBase, ToolkitConfig } from '../types.js';
import { builtInFeatures } from '../features/index.js';

/**
 * Resolves a dot-separated config path to check if a feature is enabled.
 * Returns `true` if configPath is empty (always-enabled features) or if
 * the resolved config section has `enabled: true`.
 */
export function isFeatureEnabled(meta: FeatureMeta, config: ToolkitConfig): boolean {
  if (!meta.configPath) {
    return true;
  }

  const parts = meta.configPath.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return true;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === 'object' && current !== null && 'enabled' in current) {
    return (current as { enabled: boolean }).enabled;
  }

  return true;
}

/**
 * Registry that discovers, stores, and queries feature modules.
 *
 * Initialized with all built-in features. Supports querying by hook type,
 * name, and enabled status.
 */
export class FeatureRegistry {
  private readonly features: FeatureModule<HookInputBase>[];

  constructor(features?: FeatureModule<HookInputBase>[]) {
    this.features = features ? [...features] : [...builtInFeatures];
  }

  /** Returns all registered feature modules. */
  getAll(): FeatureModule<HookInputBase>[] {
    return [...this.features];
  }

  /** Returns feature modules whose `hookTypes` include the given type. */
  getByHookType(hookType: HookEventType): FeatureModule<HookInputBase>[] {
    return this.features.filter((f) => f.meta.hookTypes.includes(hookType));
  }

  /** Returns enabled feature modules for the given hook type, respecting config. */
  getEnabled(hookType: HookEventType, config: ToolkitConfig): FeatureModule<HookInputBase>[] {
    return this.features
      .filter((f) => f.meta.hookTypes.includes(hookType))
      .filter((f) => isFeatureEnabled(f.meta, config));
  }

  /** Returns a feature module by name, or `undefined` if not found. */
  get(name: string): FeatureModule<HookInputBase> | undefined {
    return this.features.find((f) => f.meta.name === name);
  }

  /** Registers a new feature module. Replaces existing registration with the same name. */
  register(feature: FeatureModule<HookInputBase>): void {
    const existingIndex = this.features.findIndex(f => f.meta.name === feature.meta.name);
    if (existingIndex !== -1) {
      this.features[existingIndex] = feature;
      return;
    }
    this.features.push(feature);
  }

  /** Removes all registered features. Intended for testing. */
  clear(): void {
    this.features.length = 0;
  }
}

let defaultRegistry: FeatureRegistry | undefined;

/** Returns the singleton feature registry, creating it on first call. */
export function getFeatureRegistry(): FeatureRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new FeatureRegistry();
  }
  return defaultRegistry;
}
