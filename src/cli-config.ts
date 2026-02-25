import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { PresetName, ClaudeSettings, ReportFormat, GeneratorFormat } from './types.js';
import { loadConfig } from './config.js';
import { generateSettings, mergeWithExisting, writeSettings, generateGithubHooksFiles, writeAllGithubHookFiles } from './generator/index.js';
import { createReporter } from './reporter/index.js';
import { validateConfig } from './config-validator.js';
import { formatUnknownValue, formatConfigParseError } from './cli-errors.js';

const VALID_PRESETS = new Set<PresetName>(['minimal', 'security', 'quality', 'full']);
const VALID_FORMATS = new Set<GeneratorFormat>(['claude', 'vscode', 'both']);

function isValidPreset(value: string): value is PresetName {
  return VALID_PRESETS.has(value as PresetName);
}

function isValidFormat(value: string): value is GeneratorFormat {
  return VALID_FORMATS.has(value as GeneratorFormat);
}

/** Registers the `config` subcommand (with show, validate, generate) on the given Commander program. */
export function registerConfigCommand(program: Command, verboseLog: (msg: string) => void): void {
  const configCommand = program
    .command('config')
    .description('Manage toolkit configuration')
    .addHelpText('after', `
Examples:
  $ claude-hooks config show             Show current configuration
  $ claude-hooks config validate         Validate the config file
  $ claude-hooks config generate         Generate settings with defaults
`);

  configCommand
    .command('show')
    .description('Show current configuration')
    .option('--format <format>', 'Output format (terminal, json)', 'terminal')
    .addHelpText('after', `
Examples:
  $ claude-hooks config show             Show current configuration
  $ claude-hooks config show --format json  Output as JSON
`)
    .action((options: { format?: string }) => {
      verboseLog('Loading configuration...');
      const config = loadConfig();
      verboseLog(`Config loaded from ${path.resolve('claude-hooks.config.json')}`);
      const format = options.format === 'json' ? 'json' : 'terminal';
      const reporter = createReporter(format as ReportFormat);
      console.log(reporter.formatJson(config));
    });

  configCommand
    .command('validate')
    .description('Validate the toolkit configuration file')
    .option('-c, --config <path>', 'Path to config file', 'claude-hooks.config.json')
    .addHelpText('after', `
Examples:
  $ claude-hooks config validate                          Validate default config
  $ claude-hooks config validate --config custom.json     Validate a custom file
`)
    .action((options: { config: string }) => {
      const configPath = path.resolve(options.config);
      verboseLog(`Validating config file: ${configPath}`);

      if (!fs.existsSync(configPath)) {
        console.error(pc.red(`Config file not found: ${configPath}`));
        process.exit(1);
      }

      let raw: Record<string, unknown>;
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          console.error(pc.red('Config file is not a valid JSON object'));
          process.exit(1);
        }
        raw = parsed as Record<string, unknown>;
      } catch {
        console.error(pc.red(formatConfigParseError(configPath, 'file is not valid JSON')));
        process.exit(1);
      }

      verboseLog('Running validation rules...');
      const result = validateConfig(raw);
      verboseLog(`Validation complete: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);

      for (const warning of result.warnings) {
        console.error(pc.yellow(`  ⚠ ${warning}`));
      }

      for (const error of result.errors) {
        console.error(pc.red(`  ✗ ${error}`));
      }

      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log(pc.green('  ✓ Config is valid'));
      } else if (result.errors.length === 0) {
        console.log(pc.green('  ✓ Config is valid (with warnings)'));
      }

      process.exit(result.errors.length > 0 ? 1 : 0);
    });

  configCommand
    .command('generate')
    .description('Generate settings configuration')
    .option('-o, --output <path>', 'Output file path', '.claude/settings.json')
    .option('--preset <name>', 'Preset to use', 'security')
    .option('--merge', 'Merge with existing settings', false)
    .option('--dry-run', 'Print without writing', false)
    .option('-f, --format <format>', 'Output format: claude, vscode, or both', 'claude')
    .addHelpText('after', `
Examples:
  $ claude-hooks config generate                    Generate with defaults
  $ claude-hooks config generate --preset security  Security preset
  $ claude-hooks config generate --preset full      Full preset
  $ claude-hooks config generate -f vscode          VS Code format
  $ claude-hooks config generate --dry-run          Preview without writing
  $ claude-hooks config generate --merge            Merge with existing settings
`)
    .action((options: { output: string; preset: string; merge: boolean; dryRun: boolean; format: string }) => {
      const reporter = createReporter('terminal');

      if (!isValidPreset(options.preset)) {
        console.error(formatUnknownValue('preset', options.preset, [...VALID_PRESETS]));
        process.exit(1);
      }

      if (!isValidFormat(options.format)) {
        console.error(formatUnknownValue('format', options.format, [...VALID_FORMATS]));
        process.exit(1);
      }

      const projectDir = process.cwd();
      const generatorFormat = options.format as GeneratorFormat;

      verboseLog(`Generating config with preset: ${options.preset}, format: ${generatorFormat}`);

      // Claude format
      if (generatorFormat === 'claude' || generatorFormat === 'both') {
        let settings = generateSettings(options.preset, projectDir);

        if (options.merge) {
          const outputPath = path.resolve(options.output);
          if (fs.existsSync(outputPath)) {
            try {
              const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as ClaudeSettings;
              settings = mergeWithExisting(existing, settings);
            } catch {
              // Ignore parse errors
            }
          }
        }

        if (options.dryRun) {
          console.log(reporter.formatSettings(settings));
          console.log('\n' + reporter.formatJson(settings));
        } else {
          const outputPath = path.resolve(options.output);
          writeSettings(settings, outputPath);
          console.log(reporter.formatSettings(settings));
          console.log(`\nSettings written to ${outputPath}`);
        }
      }

      // VS Code format
      if (generatorFormat === 'vscode' || generatorFormat === 'both') {
        const files = generateGithubHooksFiles(options.preset as PresetName, projectDir);

        if (options.dryRun) {
          for (const [name, entries] of files) {
            console.log(`\n.github/hooks/${name}.json:`);
            console.log(JSON.stringify(entries, null, 2));
          }
        } else {
          const hooksDir = path.resolve('.github', 'hooks');
          writeAllGithubHookFiles(files, hooksDir);
          console.log(`\nVS Code hook files written to ${hooksDir}/`);
          for (const name of files.keys()) {
            console.log(`  ${name}.json`);
          }
        }
      }
    });
}
