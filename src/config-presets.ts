import type { PresetName } from './types.js';

/**
 * Preset configurations that can be referenced via the `extends` field
 * in `claude-hooks.config.json`.
 *
 * Each preset is a partial config object that gets deep-merged on top of
 * {@link DEFAULT_CONFIG}. The user's own config fields are then merged on top
 * of the preset, so user overrides always win.
 *
 * Merge order: `DEFAULT_CONFIG` ← preset config ← user config.
 */
export const CONFIG_PRESETS: Record<PresetName, Record<string, unknown>> = {
  /**
   * Minimal preset — only essential guards: command, file, path.
   * Disables secret-leak (enabled by default) and all other features.
   */
  minimal: {
    guards: {
      secretLeak: { enabled: false },
    },
  },

  /**
   * Security preset — command, file, path (defaults) plus branch protection.
   * Secret-leak stays enabled (default). No validators or tracking.
   */
  security: {
    guards: {
      branch: { enabled: true },
    },
  },

  /**
   * Quality preset — security superset plus diff-size guard,
   * code quality validators, and error pattern detection.
   */
  quality: {
    guards: {
      diffSize: { enabled: true },
      branch: { enabled: true },
    },
    validators: {
      lint: { enabled: true },
      typecheck: { enabled: true },
      test: { enabled: true },
    },
    errorPatternDetector: { enabled: true },
  },

  /**
   * Full preset — everything enabled for maximum coverage.
   * Includes all guards, validators, tracking, and integration features.
   */
  full: {
    guards: {
      diffSize: { enabled: true },
      branch: { enabled: true },
      scope: { enabled: true },
    },
    validators: {
      lint: { enabled: true },
      typecheck: { enabled: true },
      test: { enabled: true },
    },
    fileBackup: { enabled: true },
    costTracker: { enabled: true },
    webhooks: { enabled: true },
    changeSummary: { enabled: true },
    rateLimiter: { enabled: true, maxToolCallsPerSession: 200, maxFileEditsPerSession: 100 },
    todoTracker: { enabled: true },
    errorPatternDetector: { enabled: true },
    contextInjector: { enabled: true },
    autoCommit: { enabled: true },
    projectVisualizer: { enabled: true },
  },
};

/** Valid preset names for use with the `extends` field. */
export const PRESET_NAMES = Object.keys(CONFIG_PRESETS) as PresetName[];

/** Check whether a string is a valid preset name. */
export function isPresetName(value: string): value is PresetName {
  return value in CONFIG_PRESETS;
}
