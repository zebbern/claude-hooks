import fs from 'node:fs';
import path from 'node:path';
import type { ToolkitConfig } from './types.js';
import { validateConfig } from './config-validator.js';
import { DEFAULT_CONFIG } from './config-defaults.js';
import { CONFIG_PRESETS, isPresetName } from './config-presets.js';

export { DEFAULT_CONFIG } from './config-defaults.js';
export { CONFIG_PRESETS, isPresetName } from './config-presets.js';

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

/**
 * Removes a nested field from an object using a dot-separated path.
 * Mutates the object in place.
 */
function deleteNestedField(obj: Record<string, unknown>, dotPath: string): void {
  const parts = dotPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== 'object' || current[part] === null) {
      return;
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1]!;
  delete current[lastPart];
}

/**
 * Returns a deep clone of `config` with all fields listed in `invalidPaths` removed.
 * This ensures invalid user values are not merged on top of defaults.
 */
function stripInvalidFields(config: Record<string, unknown>, invalidPaths: string[]): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  for (const fieldPath of invalidPaths) {
    deleteNestedField(cloned, fieldPath);
  }
  return cloned;
}

/**
 * Maximum depth for recursive `extends` resolution.
 * Prevents runaway recursion even when no circular reference is detected.
 */
const MAX_EXTENDS_DEPTH = 10;

/**
 * Resolves the `extends` field from a raw config object.
 *
 * If `extends` is a preset name (`minimal`, `security`, `quality`, `full`),
 * the corresponding preset config is returned. If it is a file path, the
 * referenced config file is loaded (and its own `extends` resolved recursively).
 *
 * @param config   - The raw parsed config object that may contain an `extends` field.
 * @param configFilePath - Absolute path of the config file (for resolving relative paths).
 * @param seen     - Set of already-visited absolute file paths (circular reference detection).
 * @param depth    - Current recursion depth.
 * @returns A partial config object from the resolved base, or an empty object.
 */
function resolveExtends(
  config: Record<string, unknown>,
  configFilePath: string,
  seen: Set<string>,
  depth: number = 0,
): Record<string, unknown> {
  const extendsValue = config.extends;
  if (extendsValue === undefined || typeof extendsValue !== 'string') {
    return {};
  }

  if (depth >= MAX_EXTENDS_DEPTH) {
    process.stderr.write(
      `[claude-hooks-toolkit] Maximum extends depth (${MAX_EXTENDS_DEPTH}) reached, skipping further inheritance\n`,
    );
    return {};
  }

  // Preset name — return the preset config directly
  if (isPresetName(extendsValue)) {
    return structuredClone(CONFIG_PRESETS[extendsValue]);
  }

  // File path — resolve relative to the config file's directory
  const configDir = path.dirname(configFilePath);
  const extendedPath = path.resolve(configDir, extendsValue);

  // Circular reference detection
  if (seen.has(extendedPath)) {
    process.stderr.write(
      `[claude-hooks-toolkit] Circular extends detected: ${extendedPath}, skipping\n`,
    );
    return {};
  }
  seen.add(extendedPath);

  try {
    if (!fs.existsSync(extendedPath)) {
      process.stderr.write(
        `[claude-hooks-toolkit] Extended config file not found: ${extendedPath}\n`,
      );
      return {};
    }
    const raw = fs.readFileSync(extendedPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      process.stderr.write(
        `[claude-hooks-toolkit] Extended config file is not a JSON object: ${extendedPath}\n`,
      );
      return {};
    }

    const extendedConfig = parsed as Record<string, unknown>;

    // Recursively resolve the extended config's own `extends`
    const parentConfig = resolveExtends(extendedConfig, extendedPath, seen, depth + 1);

    // Strip the `extends` field from the resolved config
    const { extends: _ext, ...configWithoutExtends } = extendedConfig;

    // Merge: grandparent ← parent
    return deepMerge(parentConfig, configWithoutExtends);
  } catch {
    process.stderr.write(
      `[claude-hooks-toolkit] Failed to load extended config: ${extendedPath}\n`,
    );
    return {};
  }
}

/**
 * Loads the toolkit configuration from `claude-hooks.config.json`.
 *
 * Reads the config file from `projectDir` (or the current working directory), then
 * deep-merges it with {@link DEFAULT_CONFIG}. If the file does not exist or cannot be
 * parsed, the defaults are returned unchanged.
 *
 * **Important:** Arrays in the user config **replace** the corresponding default arrays
 * rather than being merged. For example, setting `blockedPatterns` to a single entry
 * removes all built-in patterns.
 *
 * @param projectDir - Directory containing `claude-hooks.config.json`. Defaults to `process.cwd()`.
 * @returns The resolved {@link ToolkitConfig}.
 *
 * @example
 * ```ts
 * import { loadConfig } from 'claude-hooks-toolkit';
 *
 * const config = loadConfig('/path/to/project');
 * console.log(config.guards.command.enabled); // true
 * ```
 */
export function loadConfig(projectDir?: string): ToolkitConfig {
  const baseDir = projectDir ?? process.cwd();
  const configPath = path.join(baseDir, 'claude-hooks.config.json');

  try {
    if (!fs.existsSync(configPath)) {
      return structuredClone(DEFAULT_CONFIG);
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      process.stderr.write(`[claude-hooks-toolkit] Config file is not a JSON object, using defaults\n`);
      return structuredClone(DEFAULT_CONFIG);
    }

    const userConfig = parsed as Record<string, unknown>;

    // Resolve `extends` before validation — produces a base config to merge under user values
    const extendedBase = resolveExtends(userConfig, configPath, new Set([configPath]));

    // Strip `extends` from user config before validation (it is not a runtime property)
    const { extends: _extends, ...configWithoutExtends } = userConfig;

    const validation = validateConfig(configWithoutExtends);
    for (const warning of validation.warnings) {
      process.stderr.write(`[claude-hooks-toolkit] Config warning: ${warning}\n`);
    }
    for (const error of validation.errors) {
      process.stderr.write(`[claude-hooks-toolkit] Config error: ${error}\n`);
    }

    const mergeSource = validation.invalidPaths.length > 0
      ? stripInvalidFields(configWithoutExtends, validation.invalidPaths)
      : configWithoutExtends;

    // Merge order: DEFAULT_CONFIG ← extended base ← user config
    const withExtends = deepMerge(
      structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>,
      extendedBase,
    );
    return deepMerge(
      withExtends,
      mergeSource,
    ) as unknown as ToolkitConfig;
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}
