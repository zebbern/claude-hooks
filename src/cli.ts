#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import pc from 'picocolors';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
import { registerInitCommand } from './cli-init.js';
import { registerConfigCommand } from './cli-config.js';
import { registerFeatureCommands } from './cli-features.js';
import { registerStatusCommand } from './cli-status.js';
import { registerTestCommand } from './cli-test.js';
import { formatUnknownValue } from './cli-errors.js';
import { HELP_TOPICS, formatTopicList, getTopicContent } from './help-topics.js';

const program = new Command();

program
  .name('claude-hooks')
  .description('Comprehensive Claude Code hooks toolkit')
  .version(pkg.version)
  .option('-v, --verbose', 'Enable verbose output for debugging')
  .addHelpText('after', `
Examples:
  $ claude-hooks init                    Initialize a new project
  $ claude-hooks list --features         List all available features
  $ claude-hooks test PreToolUse '{}'    Test a hook with sample input
  $ claude-hooks config show             Show current configuration
  $ claude-hooks add secret-leak-guard   Enable a feature
  $ claude-hooks remove logger           Disable a feature
`);

/**
 * Returns whether the global `--verbose` flag is set on the root program.
 */
function isVerboseEnabled(): boolean {
  const opts = program.opts<{ verbose?: boolean }>();
  return opts.verbose === true;
}

/**
 * Writes a verbose-only message to stderr so it does not interfere with
 * JSON/stdout output. No-op when verbose mode is off.
 */
function verboseLog(message: string): void {
  if (isVerboseEnabled()) {
    process.stderr.write(`${pc.dim('[verbose]')} ${message}\n`);
  }
}

// --- Register all commands from modular files ---
registerInitCommand(program, verboseLog);
registerConfigCommand(program, verboseLog);
registerFeatureCommands(program, verboseLog);
registerStatusCommand(program, verboseLog);
registerTestCommand(program, verboseLog);

// --- help <topic> ---
program
  .command('help')
  .argument('[topic]', 'Help topic to display')
  .description('Show detailed help on a specific topic')
  .addHelpText('after', `
Examples:
  $ claude-hooks help                    List available help topics
  $ claude-hooks help hooks              Learn about hook types
  $ claude-hooks help presets            Compare preset differences
  $ claude-hooks help config             Understand config file format
  $ claude-hooks help security           Learn about security features
  $ claude-hooks help vscode             VS Code compatibility details
`)
  .action((topic?: string) => {
    if (!topic) {
      console.log('');
      console.log(formatTopicList());
      return;
    }

    const content = getTopicContent(topic);
    if (!content) {
      const validTopics = [...HELP_TOPICS.keys()];
      console.error(formatUnknownValue('topic', topic, validTopics));
      process.exit(1);
    }

    console.log('');
    console.log(content);
  });

program.parse();
