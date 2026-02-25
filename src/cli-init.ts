import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { PresetName, ClaudeSettings, GeneratorFormat } from './types.js';
import { generateSettings, mergeWithExisting, writeSettings, generateToolkitConfig, writeToolkitConfig, generateGithubHooksFiles, writeAllGithubHookFiles } from './generator/index.js';
import { createReporter } from './reporter/index.js';
import { createReadlineInterface, runInitWizard } from './cli-prompts.js';
import type { InitWizardAnswers } from './cli-prompts.js';
import { formatUnknownValue } from './cli-errors.js';

const VALID_PRESETS = new Set<PresetName>(['minimal', 'security', 'quality', 'full']);
const VALID_FORMATS = new Set<GeneratorFormat>(['claude', 'vscode', 'both']);

function isValidPreset(value: string): value is PresetName {
  return VALID_PRESETS.has(value as PresetName);
}

function isValidFormat(value: string): value is GeneratorFormat {
  return VALID_FORMATS.has(value as GeneratorFormat);
}

/** Registers the `init` subcommand on the given Commander program. */
export function registerInitCommand(program: Command, verboseLog: (msg: string) => void): void {
  program
    .command('init')
    .argument('[project-dir]', 'Project directory', '.')
    .option('-p, --preset <name>', 'Preset to use (minimal, security, quality, full)', 'security')
    .option('--force', 'Overwrite existing settings', false)
    .option('-f, --format <format>', 'Output format: claude (.claude/settings.json), vscode (.github/hooks/), or both', 'claude')
    .option('-i, --interactive', 'Run interactive setup wizard', false)
    .option('--dry-run', 'Preview what would be created without writing files', false)
    .addHelpText('after', `
Examples:
  $ claude-hooks init                    Initialize with recommended preset
  $ claude-hooks init --preset security  Use security-focused preset
  $ claude-hooks init --preset full      Enable all features
  $ claude-hooks init -f vscode          Generate VS Code format
  $ claude-hooks init -f both            Generate both formats
  $ claude-hooks init --force            Overwrite existing settings
  $ claude-hooks init -i                 Run interactive setup wizard
  $ claude-hooks init --dry-run          Preview without writing files
`)
    .action(async (projectDir: string, options: { preset: string; force: boolean; format: string; interactive: boolean; dryRun: boolean }) => {
      const reporter = createReporter('terminal');

      let preset = options.preset;
      let format = options.format;
      let configFileName = 'claude-hooks.config.json';
      let extraOverrides: { enableSecretLeak?: boolean; enableFileBackup?: boolean } = {};

      if (options.interactive) {
        const rl = createReadlineInterface();
        try {
          const answers: InitWizardAnswers = await runInitWizard(rl);

          // Map 'recommended' to 'security' preset
          preset = answers.preset === 'recommended' ? 'security' : answers.preset;
          format = answers.format;
          configFileName = answers.configPath;
          extraOverrides = {
            enableSecretLeak: answers.enableSecretLeak,
            enableFileBackup: answers.enableFileBackup,
          };
        } finally {
          rl.close();
        }
      }

      if (!isValidPreset(preset)) {
        console.error(formatUnknownValue('preset', preset, [...VALID_PRESETS]));
        process.exit(1);
      }

      if (!isValidFormat(format)) {
        console.error(formatUnknownValue('format', format, [...VALID_FORMATS]));
        process.exit(1);
      }

      const resolvedDir = path.resolve(projectDir);
      const generatorFormat = format as GeneratorFormat;

      verboseLog(`Initializing project in ${resolvedDir}`);
      verboseLog(`Preset: ${preset}, Format: ${generatorFormat}`);

      // --- dry-run mode: preview what would be created ---
      if (options.dryRun) {
        console.log(pc.bold('[dry-run] Preview of init operation:'));
        console.log('');

        if (generatorFormat === 'claude' || generatorFormat === 'both') {
          const settingsPath = path.join(resolvedDir, '.claude', 'settings.json');
          console.log(`[dry-run] Would create: ${settingsPath}`);
          const generated = generateSettings(preset, resolvedDir);
          console.log(`[dry-run] Settings content (${preset} preset):`);
          console.log(JSON.stringify(generated, null, 2));
          console.log('');
        }

        if (generatorFormat === 'vscode' || generatorFormat === 'both') {
          const hooksDir = path.join(resolvedDir, '.github', 'hooks');
          const files = generateGithubHooksFiles(preset as PresetName, resolvedDir);
          for (const [name] of files) {
            console.log(`[dry-run] Would create: ${path.join(hooksDir, `${name}.json`)}`);
          }
          console.log('');
        }

        const toolkitConfigPath = path.join(resolvedDir, configFileName);
        console.log(`[dry-run] Would create: ${toolkitConfigPath}`);
        console.log(`[dry-run] Would update: ${path.join(resolvedDir, '.gitignore')}`);
        console.log('');
        console.log(pc.dim('[dry-run] No files were written.'));
        return;
      }

      // Generate Claude settings (.claude/settings.json)
      if (generatorFormat === 'claude' || generatorFormat === 'both') {
        const settingsPath = path.join(resolvedDir, '.claude', 'settings.json');

        if (fs.existsSync(settingsPath) && !options.force) {
          console.error('Settings file already exists. Use --force to overwrite.');
          process.exit(1);
        }

        const generated = generateSettings(preset, resolvedDir);
        let finalSettings: ClaudeSettings = generated;

        if (fs.existsSync(settingsPath) && options.force) {
          try {
            const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as ClaudeSettings;
            finalSettings = mergeWithExisting(existing, generated);
          } catch {
            // Ignore parse errors, just use generated
          }
        }

        writeSettings(finalSettings, settingsPath);
        verboseLog(`Wrote Claude settings to ${settingsPath}`);
      }

      // Generate VS Code hook files (.github/hooks/*.json)
      if (generatorFormat === 'vscode' || generatorFormat === 'both') {
        const hooksDir = path.join(resolvedDir, '.github', 'hooks');
        const files = generateGithubHooksFiles(preset as PresetName, resolvedDir);
        writeAllGithubHookFiles(files, hooksDir);
        verboseLog(`Wrote VS Code hook files to ${hooksDir}`);
      }

      const toolkitConfig = generateToolkitConfig(preset as PresetName);

      // Apply interactive overrides
      if (extraOverrides.enableSecretLeak !== undefined) {
        toolkitConfig.guards.secretLeak.enabled = extraOverrides.enableSecretLeak;
      }
      if (extraOverrides.enableFileBackup !== undefined) {
        toolkitConfig.fileBackup.enabled = extraOverrides.enableFileBackup;
      }

      const toolkitConfigPath = path.join(resolvedDir, configFileName);
      writeToolkitConfig(toolkitConfig, toolkitConfigPath);
      verboseLog(`Wrote toolkit config to ${toolkitConfigPath}`);

      // Update .gitignore
      const gitignorePath = path.join(resolvedDir, '.gitignore');
      const gitignoreEntries = [
        '# Claude hooks logs',
        'logs/claude-hooks/',
      ];

      try {
        let existing = '';
        if (fs.existsSync(gitignorePath)) {
          existing = fs.readFileSync(gitignorePath, 'utf-8');
        }
        const missingEntries = gitignoreEntries.filter((entry) => !existing.includes(entry));
        if (missingEntries.length > 0) {
          const addition = '\n' + missingEntries.join('\n') + '\n';
          fs.appendFileSync(gitignorePath, addition, 'utf-8');
        }
      } catch {
        // .gitignore update is best-effort
      }

      console.log(reporter.formatInitSuccess(resolvedDir, preset));

      if (options.interactive) {
        console.log('');
        console.log(pc.bold('Summary:'));
        console.log(`  Preset:              ${preset}`);
        console.log(`  Format:              ${format}`);
        console.log(`  Secret-leak guard:   ${extraOverrides.enableSecretLeak ? 'enabled' : 'disabled'}`);
        console.log(`  File backup:         ${extraOverrides.enableFileBackup ? 'enabled' : 'disabled'}`);
        console.log(`  Config file:         ${configFileName}`);
      }
    });
}
