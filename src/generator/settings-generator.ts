import fs from 'node:fs';
import path from 'node:path';
import { resolveHookPath, hookEventToFilename } from './hook-resolver.js';
import { ALL_HOOK_EVENT_TYPES } from '../types.js';
import { DEFAULT_CONFIG } from '../config-defaults.js';
import { CONFIG_PRESETS } from '../config-presets.js';
import { deepMerge } from '../config.js';
import type {
  PresetName,
  ClaudeSettings,
  HooksSettings,
  HookMatcherEntry,
  HookCommandEntry,
  HookEventType,
  ToolkitConfig,
} from '../types.js';

function buildHookCommand(hookType: HookEventType, timeout?: number): HookCommandEntry {
  const hookPath = resolveHookPath(hookType);
  const unixCommand = `node ${hookPath.replace(/\\/g, '/')}`;
  const windowsCommand = `node ${hookPath.replace(/\//g, '\\')}`;
  const entry: HookCommandEntry = {
    type: 'command',
    command: unixCommand,
    windows: windowsCommand,
  };
  if (timeout !== undefined) {
    entry.timeout = timeout;
  }
  return entry;
}

function buildMatcherEntry(matcher: string, hookType: HookEventType, timeout?: number): HookMatcherEntry {
  return {
    matcher,
    hooks: [buildHookCommand(hookType, timeout)],
  };
}

function resolveTimeout(hookType: HookEventType, config?: ToolkitConfig): number | undefined {
  const perHook = config?.hookTimeouts?.[hookType];
  if (perHook !== undefined) return perHook;
  return config?.defaultTimeout ?? undefined;
}

function buildMinimalPreset(config?: ToolkitConfig): HooksSettings {
  const settings: HooksSettings = {};
  for (const hookType of ALL_HOOK_EVENT_TYPES) {
    settings[hookType] = [buildMatcherEntry('', hookType, resolveTimeout(hookType, config))];
  }
  return settings;
}

function buildSecurityPreset(config?: ToolkitConfig): HooksSettings {
  const settings: HooksSettings = {};

  // All hooks get empty matchers by default
  for (const hookType of ALL_HOOK_EVENT_TYPES) {
    settings[hookType] = [buildMatcherEntry('', hookType, resolveTimeout(hookType, config))];
  }

  // PreToolUse gets specific matchers for guards
  const preToolUseTimeout = resolveTimeout('PreToolUse', config);
  settings.PreToolUse = [
    buildMatcherEntry('Bash', 'PreToolUse', preToolUseTimeout),
    buildMatcherEntry('Write', 'PreToolUse', preToolUseTimeout),
    buildMatcherEntry('Edit', 'PreToolUse', preToolUseTimeout),
    buildMatcherEntry('MultiEdit', 'PreToolUse', preToolUseTimeout),
  ];

  // PostToolUse gets matchers for validators
  const postToolUseTimeout = resolveTimeout('PostToolUse', config);
  settings.PostToolUse = [
    buildMatcherEntry('Write', 'PostToolUse', postToolUseTimeout),
    buildMatcherEntry('Edit', 'PostToolUse', postToolUseTimeout),
    buildMatcherEntry('MultiEdit', 'PostToolUse', postToolUseTimeout),
  ];

  return settings;
}

function buildQualityPreset(config?: ToolkitConfig): HooksSettings {
  const settings = buildSecurityPreset(config);

  // Quality adds Bash to PostToolUse for test/lint output validation
  const postToolUseTimeout = resolveTimeout('PostToolUse', config);
  settings.PostToolUse = [
    ...settings.PostToolUse!,
    buildMatcherEntry('Bash', 'PostToolUse', postToolUseTimeout),
  ];

  // Quality adds PostToolUseFailure matchers for error pattern detection
  const postToolUseFailureTimeout = resolveTimeout('PostToolUseFailure', config);
  settings.PostToolUseFailure = [
    buildMatcherEntry('Bash', 'PostToolUseFailure', postToolUseFailureTimeout),
    buildMatcherEntry('Write', 'PostToolUseFailure', postToolUseFailureTimeout),
    buildMatcherEntry('Edit', 'PostToolUseFailure', postToolUseFailureTimeout),
    buildMatcherEntry('MultiEdit', 'PostToolUseFailure', postToolUseFailureTimeout),
  ];

  return settings;
}

function buildFullPreset(config?: ToolkitConfig): HooksSettings {
  const settings = buildQualityPreset(config);

  // Full adds Read to PreToolUse for comprehensive tracking
  const preToolUseTimeout = resolveTimeout('PreToolUse', config);
  settings.PreToolUse = [
    ...settings.PreToolUse!,
    buildMatcherEntry('Read', 'PreToolUse', preToolUseTimeout),
  ];

  // Full adds Read and Bash to PostToolUse for full output tracking
  const postToolUseTimeout = resolveTimeout('PostToolUse', config);
  settings.PostToolUse = [
    ...settings.PostToolUse!,
    buildMatcherEntry('Read', 'PostToolUse', postToolUseTimeout),
  ];

  return settings;
}

/**
 * Generates a `.claude/settings.json` structure for the given preset.
 *
 * Each preset configures progressively more hook matchers:
 * - `minimal` — all hooks with empty (catch-all) matchers, only essential guards.
 * - `security` — adds specific PreToolUse and PostToolUse matchers for guards.
 * - `quality` — security matchers plus PostToolUseFailure matchers and quality validators.
 * - `full` — quality matchers plus Read tool tracking for comprehensive coverage.
 *
 * @param preset - The preset name (`'minimal'`, `'security'`, `'quality'`, or `'full'`).
 * @param _projectDir - The project directory (reserved for future use).
 * @returns A {@link ClaudeSettings} object ready to be written to disk.
 *
 * @example
 * ```ts
 * import { generateSettings, writeSettings } from 'claude-hooks-toolkit';
 *
 * const settings = generateSettings('security', '/my/project');
 * writeSettings(settings, '/my/project/.claude/settings.json');
 * ```
 */
export function generateSettings(preset: PresetName, _projectDir: string, config?: ToolkitConfig): ClaudeSettings {
  let hooks: HooksSettings;

  switch (preset) {
    case 'minimal':
      hooks = buildMinimalPreset(config);
      break;
    case 'security':
      hooks = buildSecurityPreset(config);
      break;
    case 'quality':
      hooks = buildQualityPreset(config);
      break;
    case 'full':
      hooks = buildFullPreset(config);
      break;
  }

  return { hooks };
}

/**
 * Merges generated hook settings into an existing `.claude/settings.json` structure.
 *
 * Hook entries are replaced per hook type — existing non-hook settings are preserved.
 *
 * @param existing - The current settings loaded from disk.
 * @param generated - The newly generated settings to merge in.
 * @returns A new {@link ClaudeSettings} object with merged hooks.
 */
export function mergeWithExisting(existing: ClaudeSettings, generated: ClaudeSettings): ClaudeSettings {
  const merged: ClaudeSettings = { ...existing };

  if (generated.hooks) {
    const existingHooks = (merged.hooks ?? {}) as HooksSettings;
    const generatedHooks = generated.hooks;

    for (const hookType of ALL_HOOK_EVENT_TYPES) {
      const generatedEntries = generatedHooks[hookType];
      if (generatedEntries) {
        existingHooks[hookType] = generatedEntries;
      }
    }

    merged.hooks = existingHooks;
  }

  return merged;
}

/**
 * Writes a {@link ClaudeSettings} object to disk as formatted JSON.
 *
 * Creates parent directories if they do not exist.
 *
 * @param settings - The settings object to write.
 * @param settingsPath - Absolute path to the target file (e.g., `.claude/settings.json`).
 */
export function writeSettings(settings: ClaudeSettings, settingsPath: string): void {
  const dir = path.dirname(settingsPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

/**
 * Generates a `claude-hooks.config.json` object for the given preset.
 *
 * Uses {@link CONFIG_PRESETS} as the single source of truth for preset
 * definitions, deep-merged on top of {@link DEFAULT_CONFIG}.
 *
 * - `minimal` — Only essential guards (command, file, path). No validators, no tracking.
 * - `security` — All security guards (command, file, path, branch, secret-leak). No validators.
 * - `quality` — Security superset + quality validators (lint, typecheck, test-runner, diff-size, error-pattern-detector).
 * - `full` — Everything enabled: security + quality + tracking + integration features.
 *
 * @param preset - The preset name.
 * @returns A complete {@link ToolkitConfig} object.
 */
export function generateToolkitConfig(preset: PresetName): ToolkitConfig {
  const base = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  const presetOverrides = CONFIG_PRESETS[preset];
  return deepMerge(base, presetOverrides) as unknown as ToolkitConfig;
}

/**
 * Generates a map of VS Code `.github/hooks/*.json` files from hook settings.
 *
 * Each entry in the returned map has a key like `"pre-tool-use"` and a value
 * that is the array of {@link HookCommandEntry} objects for that hook event.
 *
 * @param preset - The preset name (`'minimal'`, `'security'`, `'quality'`, or `'full'`).
 * @param _projectDir - The project directory (reserved for future use).
 * @returns A `Map<string, HookCommandEntry[]>` mapping kebab-case event names to hook entries.
 *
 * @example
 * ```ts
 * const files = generateGithubHooksFiles('security', '/my/project');
 * for (const [name, entries] of files) {
 *   writeGithubHookFile(entries, `/my/project/.github/hooks/${name}.json`);
 * }
 * ```
 */
export function generateGithubHooksFiles(
  preset: PresetName,
  _projectDir: string,
  config?: ToolkitConfig,
): Map<string, HookCommandEntry[]> {
  const settings = generateSettings(preset, _projectDir, config);
  const result = new Map<string, HookCommandEntry[]>();

  for (const hookType of ALL_HOOK_EVENT_TYPES) {
    const filename = hookEventToFilename(hookType);
    const matcherEntries = settings.hooks?.[hookType];

    if (!matcherEntries || matcherEntries.length === 0) {
      continue;
    }

    // Flatten all hook commands from all matcher entries into a single array.
    // Each matcher entry's hooks are collected; the matcher context is not used
    // in the VS Code format (VS Code hooks don't have matcher-based filtering).
    const commands: HookCommandEntry[] = [];
    const seenCommands = new Set<string>();

    for (const entry of matcherEntries) {
      for (const hook of entry.hooks) {
        // Deduplicate: same hook type only needs one command entry
        if (!seenCommands.has(hook.command)) {
          seenCommands.add(hook.command);
          commands.push(hook);
        }
      }
    }

    if (commands.length > 0) {
      result.set(filename, commands);
    }
  }

  return result;
}

/**
 * Writes a single VS Code hook file to disk.
 *
 * Creates parent directories if they do not exist.
 *
 * @param entries - The hook command entries to write.
 * @param filePath - Absolute path to the target file (e.g., `.github/hooks/pre-tool-use.json`).
 */
export function writeGithubHookFile(entries: HookCommandEntry[], filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
}

/**
 * Writes all VS Code hook files from a generated map.
 *
 * @param files - The map returned by {@link generateGithubHooksFiles}.
 * @param hooksDir - Absolute path to the `.github/hooks/` directory.
 */
export function writeAllGithubHookFiles(
  files: Map<string, HookCommandEntry[]>,
  hooksDir: string,
): void {
  for (const [name, entries] of files) {
    const filePath = path.join(hooksDir, `${name}.json`);
    writeGithubHookFile(entries, filePath);
  }
}

/**
 * Writes a {@link ToolkitConfig} object to disk as formatted JSON.
 *
 * Creates parent directories if they do not exist.
 *
 * @param config - The toolkit configuration to write.
 * @param configPath - Absolute path to the target file (e.g., `claude-hooks.config.json`).
 */
export function writeToolkitConfig(config: ToolkitConfig, configPath: string): void {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
