import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { ALL_HOOK_EVENT_TYPES } from './types.js';
import { loadConfig } from './config.js';
import { getFeatureRegistry, isFeatureEnabled } from './registry/feature-registry.js';
import { validateConfig } from './config-validator.js';
import { resolveHookPath } from './generator/index.js';

/** Aggregated status data for the project. */
export interface StatusData {
  configuration: {
    path: string;
    exists: boolean;
    valid: boolean | null;
    errors: string[];
    warnings: string[];
  };
  features: {
    total: number;
    enabled: number;
    byCategory: Record<string, { total: number; enabled: number }>;
  };
  hooks: Record<string, { exists: boolean; path: string }>;
  formats: {
    claude: { exists: boolean; path: string };
    vscode: { exists: boolean; path: string };
  };
}

/** Collects installation status for the given project directory. */
export function collectStatus(projectDir: string): StatusData {
  // --- Configuration ---
  const configPath = path.join(projectDir, 'claude-hooks.config.json');
  const configExists = fs.existsSync(configPath);
  let configValid: boolean | null = null;
  let configErrors: string[] = [];
  let configWarnings: string[] = [];

  if (configExists) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        configValid = false;
        configErrors = ['Config file is not a JSON object'];
      } else {
        const validation = validateConfig(parsed as Record<string, unknown>);
        configErrors = validation.errors;
        configWarnings = validation.warnings;
        configValid = validation.errors.length === 0;
      }
    } catch {
      configValid = false;
      configErrors = ['Failed to parse config file as JSON'];
    }
  }

  // --- Features ---
  const config = loadConfig(projectDir);
  const registry = getFeatureRegistry();
  const allFeatures = registry.getAll();
  const categoryOrder = ['security', 'quality', 'tracking', 'integration'];
  const byCategory: Record<string, { total: number; enabled: number }> = {};

  for (const cat of categoryOrder) {
    byCategory[cat] = { total: 0, enabled: 0 };
  }

  let totalEnabled = 0;

  for (const f of allFeatures) {
    const cat = f.meta.category;
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, enabled: 0 };
    }
    byCategory[cat].total++;

    const enabled = isFeatureEnabled(f.meta, config);
    if (enabled) {
      byCategory[cat].enabled++;
      totalEnabled++;
    }
  }

  // --- Hooks ---
  const hookStatus: Record<string, { exists: boolean; path: string }> = {};
  for (const hookType of ALL_HOOK_EVENT_TYPES) {
    const hookPath = resolveHookPath(hookType);
    hookStatus[hookType] = {
      exists: fs.existsSync(hookPath),
      path: hookPath,
    };
  }

  // --- Formats ---
  const claudeSettingsPath = path.join(projectDir, '.claude', 'settings.json');
  const vscodeHooksDir = path.join(projectDir, '.github', 'hooks');

  return {
    configuration: {
      path: configPath,
      exists: configExists,
      valid: configValid,
      errors: configErrors,
      warnings: configWarnings,
    },
    features: {
      total: allFeatures.length,
      enabled: totalEnabled,
      byCategory,
    },
    hooks: hookStatus,
    formats: {
      claude: { exists: fs.existsSync(claudeSettingsPath), path: claudeSettingsPath },
      vscode: { exists: fs.existsSync(vscodeHooksDir), path: vscodeHooksDir },
    },
  };
}

/** Renders status data as a colorized terminal string. */
export function formatStatusTerminal(data: StatusData): string {
  const lines: string[] = [];

  // --- Configuration ---
  lines.push(pc.bold(pc.underline('Configuration')));
  lines.push(`  Path:   ${data.configuration.path}`);
  if (data.configuration.exists) {
    if (data.configuration.valid) {
      lines.push(`  Status: ${pc.green('Valid')}`);
    } else {
      lines.push(`  Status: ${pc.red('Invalid')}`);
      for (const err of data.configuration.errors) {
        lines.push(`    ${pc.red('✗')} ${err}`);
      }
    }
    for (const warn of data.configuration.warnings) {
      lines.push(`    ${pc.yellow('⚠')} ${warn}`);
    }
  } else {
    lines.push(`  Status: ${pc.yellow('Not found')} — using defaults`);
  }

  lines.push('');

  // --- Features ---
  lines.push(pc.bold(pc.underline('Features')));
  lines.push(`  ${data.features.enabled}/${data.features.total} enabled`);
  for (const [cat, counts] of Object.entries(data.features.byCategory)) {
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    const color = counts.enabled === counts.total ? pc.green : counts.enabled > 0 ? pc.yellow : pc.red;
    lines.push(`    ${label.padEnd(14)} ${color(`${counts.enabled}/${counts.total}`)}`);
  }

  lines.push('');

  // --- Hooks ---
  lines.push(pc.bold(pc.underline('Hooks')));
  for (const [hookType, info] of Object.entries(data.hooks)) {
    const icon = info.exists ? pc.green('✓') : pc.red('✗');
    lines.push(`  ${icon} ${hookType}`);
  }

  lines.push('');

  // --- Formats ---
  lines.push(pc.bold(pc.underline('Formats')));
  const claudeIcon = data.formats.claude.exists ? pc.green('✓') : pc.yellow('—');
  const vscodeIcon = data.formats.vscode.exists ? pc.green('✓') : pc.yellow('—');
  lines.push(`  ${claudeIcon} Claude  ${pc.dim('.claude/settings.json')}`);
  lines.push(`  ${vscodeIcon} VS Code ${pc.dim('.github/hooks/')}`);

  lines.push('');

  return lines.join('\n');
}

/** Registers the `status` subcommand on the given Commander program. */
export function registerStatusCommand(program: Command, verboseLog: (msg: string) => void): void {
  program
    .command('status')
    .description('Show overview of current hook installation status')
    .option('-d, --dir <path>', 'Project directory', '.')
    .option('--json', 'Output machine-readable JSON')
    .action((options: { dir: string; json?: boolean }) => {
      const resolvedDir = path.resolve(options.dir);
      verboseLog(`Checking status in ${resolvedDir}`);

      const statusData = collectStatus(resolvedDir);

      if (options.json) {
        console.log(JSON.stringify(statusData, null, 2));
      } else {
        console.log(formatStatusTerminal(statusData));
      }
    });
}
