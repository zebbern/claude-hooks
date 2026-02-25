import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { HookEventType, ReportFormat } from './types.js';
import { ALL_HOOK_EVENT_TYPES } from './types.js';
import { loadConfig } from './config.js';
import { getFeatureRegistry } from './registry/feature-registry.js';
import { readStdinJson } from './runtime/stdin-reader.js';
import { createReporter } from './reporter/index.js';
import { formatUnknownValue, formatInvalidJsonError } from './cli-errors.js';

function isValidHookType(value: string): value is HookEventType {
  return ALL_HOOK_EVENT_TYPES.includes(value as HookEventType);
}

/** Registers the `test` subcommand on the given Commander program. */
export function registerTestCommand(program: Command, verboseLog: (msg: string) => void): void {
  program
    .command('test')
    .argument('<hook-type>', 'Hook type to test')
    .option('--input <json>', 'Input JSON string')
    .option('--input-file <path>', 'Path to input JSON file')
    .option('--format <format>', 'Output format (terminal, json)', 'terminal')
    .option('--explain', 'Show detailed reasoning for each hook decision', false)
    .addHelpText('after', `
Examples:
  $ claude-hooks test PreToolUse '{"tool_name":"Write"}'
  $ claude-hooks test SessionStart '{"session_id":"abc123"}'
  $ claude-hooks test PreToolUse --input-file fixture.json
  $ claude-hooks test PostToolUse --format json '{"tool_name":"Read"}'
  $ claude-hooks test PreToolUse --explain '{"tool_name":"Write"}'
`)
    .action(async (hookType: string, options: { input?: string; inputFile?: string; format?: string; explain?: boolean }) => {
      const format = options.format === 'json' ? 'json' : 'terminal';
      const reporter = createReporter(format as ReportFormat);

      if (!isValidHookType(hookType)) {
        console.error(formatUnknownValue('hook type', hookType, [...ALL_HOOK_EVENT_TYPES]));
        process.exit(1);
      }

      verboseLog(`Testing hook type: ${hookType}`);

      let inputData: Record<string, unknown> = {};

      if (options.input) {
        try {
          inputData = JSON.parse(options.input) as Record<string, unknown>;
        } catch {
          console.error(formatInvalidJsonError('in --input', '{"tool_name": "Write", "tool_input": {}}'));
          process.exit(1);
        }
      } else if (options.inputFile) {
        try {
          const content = fs.readFileSync(path.resolve(options.inputFile), 'utf-8');
          inputData = JSON.parse(content) as Record<string, unknown>;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to read input file: ${msg}`);
          process.exit(1);
        }
      } else {
        try {
          inputData = await readStdinJson<Record<string, unknown>>();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to read stdin: ${msg}`);
          process.exit(1);
        }
      }

      // Ensure session_id exists
      if (!inputData.session_id) {
        inputData.session_id = 'test-session-' + Date.now().toString(36);
      }

      // --- explain mode: show feature trace ---
      if (options.explain) {
        const config = loadConfig();
        const registry = getFeatureRegistry();
        const allForHook = registry.getByHookType(hookType as HookEventType);
        const enabledForHook = registry.getEnabled(hookType as HookEventType, config);

        console.log('');
        console.log(pc.bold(pc.underline(`Explain: ${hookType}`)));
        console.log('');
        console.log(pc.bold('Features evaluated:'));

        for (const feature of allForHook) {
          const isEnabled = enabledForHook.some((e) => e.meta.name === feature.meta.name);
          const icon = isEnabled ? pc.green('✓') : pc.red('✗');
          const status = isEnabled ? pc.green('enabled') : pc.red('disabled');
          console.log(`  ${icon} ${pc.bold(feature.meta.name)} ${pc.dim(`(priority: ${String(feature.meta.priority)})`)}`);
          console.log(`    ${pc.dim('Hook types:')} ${feature.meta.hookTypes.join(', ')}`);
          console.log(`    ${pc.dim('Status:')} ${status}`);
          console.log(`    ${pc.dim('Category:')} ${feature.meta.category}`);
        }

        if (allForHook.length === 0) {
          console.log(pc.dim('  (no features registered for this hook type)'));
        }

        console.log('');
        console.log(pc.bold('Pipeline summary:'));
        console.log(`  ${pc.dim('Total features for hook:')} ${String(allForHook.length)}`);
        console.log(`  ${pc.dim('Enabled features:')} ${String(enabledForHook.length)}`);
        console.log(`  ${pc.dim('Execution order:')} ${enabledForHook.map((f) => f.meta.name).join(' → ') || '(none)'}`);
        console.log('');

        console.log(pc.bold('Input:'));
        console.log(`  ${pc.dim(JSON.stringify(inputData))}`);
        console.log('');
      }

      const { execFileSync } = await import('node:child_process');
      const { resolveHookPath } = await import('./generator/hook-resolver.js');

      const hookPath = resolveHookPath(hookType as HookEventType);
      const inputJson = JSON.stringify(inputData);

      verboseLog(`Hook script path: ${hookPath}`);
      verboseLog(`Input JSON: ${inputJson}`);

      try {
        const result = execFileSync('node', [hookPath], {
          input: inputJson,
          encoding: 'utf-8',
          timeout: 15_000,
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
        });

        console.log(reporter.formatTestResult(hookType as HookEventType, 0, result.trim(), ''));

        if (options.explain) {
          console.log('');
          console.log(pc.bold('Result:'));
          console.log(`  ${pc.dim('Exit code:')} ${pc.green('0')} (proceed)`);
        }
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'status' in err) {
          const execErr = err as { status: number; stdout: string; stderr: string };
          console.log(reporter.formatTestResult(
            hookType as HookEventType,
            execErr.status ?? 1,
            (execErr.stdout ?? '').trim(),
            (execErr.stderr ?? '').trim(),
          ));

          if (options.explain) {
            const code = execErr.status ?? 1;
            const meaning = code === 2 ? 'block' : 'error';
            console.log('');
            console.log(pc.bold('Result:'));
            console.log(`  ${pc.dim('Exit code:')} ${pc.red(String(code))} (${meaning})`);
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Test failed: ${msg}`);
          process.exit(1);
        }
      }
    });
}
