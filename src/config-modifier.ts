import fs from 'node:fs';
import path from 'node:path';

/**
 * Sets `enabled: true` at the given dot-separated config path in the
 * `claude-hooks.config.json` file.
 *
 * Creates the config file and any intermediate objects if they don't exist.
 *
 * @param configPath - Dot-separated path (e.g. `"guards.command"`).
 * @param projectDir - Directory containing `claude-hooks.config.json`.
 */
export function enableFeatureInConfig(configPath: string, projectDir: string): void {
  setFeatureEnabled(configPath, projectDir, true);
}

/**
 * Sets `enabled: false` at the given dot-separated config path in the
 * `claude-hooks.config.json` file.
 *
 * Creates the config file and any intermediate objects if they don't exist.
 *
 * @param configPath - Dot-separated path (e.g. `"guards.command"`).
 * @param projectDir - Directory containing `claude-hooks.config.json`.
 */
export function disableFeatureInConfig(configPath: string, projectDir: string): void {
  setFeatureEnabled(configPath, projectDir, false);
}

/**
 * Reads the config file, walks the dot-path to the target object,
 * sets `enabled` to the given value, and writes back.
 */
function setFeatureEnabled(configPath: string, projectDir: string, enabled: boolean): void {
  const configFilePath = path.join(projectDir, 'claude-hooks.config.json');
  let config: Record<string, unknown> = {};

  if (fs.existsSync(configFilePath)) {
    const raw = fs.readFileSync(configFilePath, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  }

  const parts = configPath.split('.');
  let current = config;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;

    if (i === parts.length - 1) {
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      (current[part] as Record<string, unknown>).enabled = enabled;
    } else {
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
  }

  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
