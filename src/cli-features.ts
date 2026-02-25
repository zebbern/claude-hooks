import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { ReportFormat } from './types.js';
import { ALL_HOOK_EVENT_TYPES } from './types.js';
import { loadConfig } from './config.js';
import { getFeatureRegistry } from './registry/feature-registry.js';
import { enableFeatureInConfig, disableFeatureInConfig } from './config-modifier.js';
import { createReporter } from './reporter/index.js';
import { formatUnknownValue, suggestSimilar } from './cli-errors.js';

/** Registers the `add`, `remove`, `eject`, and `list` subcommands on the given Commander program. */
export function registerFeatureCommands(program: Command, verboseLog: (msg: string) => void): void {
  registerAddCommand(program);
  registerRemoveCommand(program);
  registerEjectCommand(program);
  registerListCommand(program, verboseLog);
}

function registerAddCommand(program: Command): void {
  program
    .command('add')
    .description('Enable one or more features in the config')
    .argument('<features...>', 'Feature names to enable')
    .option('-d, --dir <path>', 'Project directory', '.')
    .option('--dry-run', 'Preview what config changes would be made', false)
    .addHelpText('after', `
Examples:
  $ claude-hooks add secret-leak-guard           Enable a single feature
  $ claude-hooks add logger cost-tracker          Enable multiple features
  $ claude-hooks add file-guard -d ./my-project   Enable in a specific directory
  $ claude-hooks add secret-leak-guard --dry-run  Preview changes
`)
    .action((featureNames: string[], options: { dir: string; dryRun: boolean }) => {
      const registry = getFeatureRegistry();
      const resolvedDir = path.resolve(options.dir);
      const allFeatureNames = registry.getAll().map((f) => f.meta.name);
      const results: string[] = [];

      for (const name of featureNames) {
        const feature = registry.get(name);
        if (!feature) {
          const suggestion = suggestSimilar(name, allFeatureNames);
          let msg = formatUnknownValue('feature', name, allFeatureNames);
          if (suggestion) {
            msg = `Feature '${name}' not found. Available features: ${allFeatureNames.join(', ')}\n\n  Did you mean ${pc.bold(suggestion)}?`;
          }
          console.error(msg);
          process.exit(1);
        }

        if (!feature.meta.configPath) {
          results.push(`  ℹ ${name} — always enabled (no config toggle)`);
          continue;
        }

        if (options.dryRun) {
          results.push(`  [dry-run] ${name} — would set ${feature.meta.configPath}.enabled = true`);
        } else {
          enableFeatureInConfig(feature.meta.configPath, resolvedDir);
          results.push(`  ✅ ${name} — enabled`);
        }
      }

      console.log('\nFeature changes:');
      for (const line of results) {
        console.log(line);
      }
      console.log('');
    });
}

function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .description('Disable one or more features in the config')
    .argument('<features...>', 'Feature names to disable')
    .option('-d, --dir <path>', 'Project directory', '.')
    .option('--dry-run', 'Preview what config changes would be made', false)
    .addHelpText('after', `
Examples:
  $ claude-hooks remove logger                    Disable a single feature
  $ claude-hooks remove logger cost-tracker       Disable multiple features
  $ claude-hooks remove file-guard -d ./project   Disable in a specific directory
  $ claude-hooks remove logger --dry-run          Preview changes
`)
    .action((featureNames: string[], options: { dir: string; dryRun: boolean }) => {
      const registry = getFeatureRegistry();
      const resolvedDir = path.resolve(options.dir);
      const allFeatureNames = registry.getAll().map((f) => f.meta.name);
      const results: string[] = [];

      for (const name of featureNames) {
        const feature = registry.get(name);
        if (!feature) {
          const suggestion = suggestSimilar(name, allFeatureNames);
          let msg = formatUnknownValue('feature', name, allFeatureNames);
          if (suggestion) {
            msg = `Feature '${name}' not found. Available features: ${allFeatureNames.join(', ')}\n\n  Did you mean ${pc.bold(suggestion)}?`;
          }
          console.error(msg);
          process.exit(1);
        }

        if (!feature.meta.configPath) {
          results.push(`  ℹ ${name} — always enabled (cannot be disabled)`);
          continue;
        }

        if (options.dryRun) {
          results.push(`  [dry-run] ${name} — would set ${feature.meta.configPath}.enabled = false`);
        } else {
          disableFeatureInConfig(feature.meta.configPath, resolvedDir);
          results.push(`  ❌ ${name} — disabled`);
        }
      }

      console.log('\nFeature changes:');
      for (const line of results) {
        console.log(line);
      }
      console.log('');
    });
}

function registerEjectCommand(program: Command): void {
  program
    .command('eject')
    .description('Eject a feature into a local, user-owned hook script')
    .argument('<feature>', 'Feature name to eject')
    .option('-d, --dir <path>', 'Project directory', '.')
    .option('--dry-run', 'Preview what files would be copied', false)
    .addHelpText('after', `
Examples:
  $ claude-hooks eject command-guard              Eject command-guard for customization
  $ claude-hooks eject file-guard -d ./project    Eject into a specific directory
  $ claude-hooks eject command-guard --dry-run    Preview without copying
`)
    .action((featureName: string, options: { dir: string; dryRun: boolean }) => {
      const registry = getFeatureRegistry();
      const resolvedDir = path.resolve(options.dir);
      const allFeatureNames = registry.getAll().map((f) => f.meta.name);

      const feature = registry.get(featureName);
      if (!feature) {
        const suggestion = suggestSimilar(featureName, allFeatureNames);
        let msg = formatUnknownValue('feature', featureName, allFeatureNames);
        if (suggestion) {
          msg = `Feature '${featureName}' not found. Available features: ${allFeatureNames.join(', ')}\n\n  Did you mean ${pc.bold(suggestion)}?`;
        }
        console.error(msg);
        process.exit(1);
      }

      const ejectedDir = path.join(resolvedDir, '.claude', 'hooks', featureName);

      // --- dry-run mode ---
      if (options.dryRun) {
        console.log(pc.bold(`[dry-run] Preview of eject for ${featureName}:`));
        console.log('');
        console.log(`[dry-run] Would create directory: ${path.relative(resolvedDir, ejectedDir)}/`);
        console.log(`[dry-run] Would copy: handler.js → ${path.relative(resolvedDir, path.join(ejectedDir, 'handler.js'))}`);
        console.log(`[dry-run] Would copy: meta.js → ${path.relative(resolvedDir, path.join(ejectedDir, 'meta.js'))}`);
        console.log(`[dry-run] Would create: ${path.relative(resolvedDir, path.join(ejectedDir, 'index.js'))}`);
        if (feature.meta.configPath) {
          console.log(`[dry-run] Would set ${feature.meta.configPath}.enabled = false in config`);
        }
        console.log('');
        console.log(pc.dim('[dry-run] No files were written.'));
        return;
      }

    fs.mkdirSync(ejectedDir, { recursive: true });

    // Find the compiled feature source in dist/
    const featureSourceDir = path.join(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
      'features',
      featureName,
    );

    const handlerSrcPath = path.join(featureSourceDir, 'handler.js');
    const metaSrcPath = path.join(featureSourceDir, 'meta.js');
    const indexSrcPath = path.join(featureSourceDir, 'index.js');

    if (fs.existsSync(handlerSrcPath)) {
      fs.copyFileSync(handlerSrcPath, path.join(ejectedDir, 'handler.js'));
    }
    if (fs.existsSync(metaSrcPath)) {
      fs.copyFileSync(metaSrcPath, path.join(ejectedDir, 'meta.js'));
    }
    if (fs.existsSync(indexSrcPath)) {
      fs.copyFileSync(indexSrcPath, path.join(ejectedDir, 'index.js'));
    }

    // Create a minimal entry script (compiled JavaScript — edit freely)
    const hookTypes = feature.meta.hookTypes;
    const entryContent = [
      `// Ejected from claude-hooks-toolkit: ${featureName}`,
      `// These are compiled JavaScript files — edit freely.`,
      `//`,
      `// Hook types: ${hookTypes.join(', ')}`,
      `// Original priority: ${String(feature.meta.priority)}`,
      ``,
      `export { createHandler } from './handler.js';`,
      `export { ${featureName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Meta as meta } from './meta.js';`,
      ``,
    ].join('\n');

    fs.writeFileSync(path.join(ejectedDir, 'index.js'), entryContent, 'utf-8');

    // Disable the built-in feature if it has a configPath
    if (feature.meta.configPath) {
      disableFeatureInConfig(feature.meta.configPath, resolvedDir);
    }

    console.log(`\n✅ Ejected ${featureName} to ${path.relative(resolvedDir, ejectedDir)}/`);
    console.log('');
    console.log('Files created (compiled JavaScript — edit freely):');
    console.log(`  ${path.relative(resolvedDir, path.join(ejectedDir, 'index.js'))}`);
    if (fs.existsSync(path.join(ejectedDir, 'handler.js'))) {
      console.log(`  ${path.relative(resolvedDir, path.join(ejectedDir, 'handler.js'))}`);
    }
    if (fs.existsSync(path.join(ejectedDir, 'meta.js'))) {
      console.log(`  ${path.relative(resolvedDir, path.join(ejectedDir, 'meta.js'))}`);
    }
    console.log('');
    console.log('This feature is now user-owned. Edit the handler to customize behavior.');
    if (feature.meta.configPath) {
      console.log(`The built-in ${featureName} has been disabled in config.`);
    }
    console.log('');
  });
}

function registerListCommand(program: Command, verboseLog: (msg: string) => void): void {
  const listCommand = program
    .command('list')
    .description('List available hooks, guards, validators, and presets')
    .addHelpText('after', `
Examples:
  $ claude-hooks list                    List hooks, guards, validators, presets
  $ claude-hooks list --hooks            List all hook types
  $ claude-hooks list --features         List all features grouped by category
  $ claude-hooks list --presets          List available presets
  $ claude-hooks list --format json      Output as JSON
`);

  listCommand
    .option('--hooks', 'List all hook types')
    .option('--guards', 'List available guards')
    .option('--validators', 'List available validators')
    .option('--presets', 'List available presets')
    .option('--features', 'List all features grouped by category')
    .option('--verbose', 'Show additional detail (hookTypes, configPath, priority)')
    .option('--format <format>', 'Output format (terminal, json)', 'terminal')
    .action((options: { hooks?: boolean; guards?: boolean; validators?: boolean; presets?: boolean; features?: boolean; verbose?: boolean; format?: string }) => {
      const format = options.format === 'json' ? 'json' : 'terminal';
      const reporter = createReporter(format as ReportFormat);
      const showAll = !options.hooks && !options.guards && !options.validators && !options.presets && !options.features;

      if (showAll || options.hooks) {
        console.log('\nHook Types:');
        console.log(reporter.formatHookList(ALL_HOOK_EVENT_TYPES));
      }
      if (showAll || options.guards) {
        console.log('\nGuards:');
        console.log(reporter.formatGuardList());
      }
      if (showAll || options.validators) {
        console.log('\nValidators:');
        console.log(reporter.formatValidatorList());
      }
      if (showAll || options.presets) {
        console.log('\nPresets:');
        console.log(reporter.formatPresetList());
      }
      if (options.features) {
        const registry = getFeatureRegistry();
        const config = loadConfig();
        const metas = registry.getAll().map((f) => f.meta);
        verboseLog(`Loaded ${metas.length} features from registry`);
        console.log('\nFeatures:');
        console.log(reporter.formatFeatureList(metas, config, options.verbose ?? false));
      }
      console.log('');
    });
}
