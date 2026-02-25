import pc from 'picocolors';
import type { HookEventType, ClaudeSettings, PresetName, FeatureMeta, ToolkitConfig, FeatureCategory } from '../types.js';
import { ALL_HOOK_EVENT_TYPES } from '../types.js';
import { builtInFeatures } from '../features/index.js';
import { isFeatureEnabled } from '../registry/feature-registry.js';

export function formatHookList(hooks: readonly HookEventType[]): string {
  return hooks
    .map((hook) => `  ${pc.green('●')} ${pc.bold(hook)}`)
    .join('\n');
}

export function formatPresetList(): string {
  const presets: { name: PresetName; description: string }[] = [
    { name: 'minimal', description: 'All hooks registered — guards, validators, and tracking disabled' },
    { name: 'security', description: 'Guards enabled (command, file, path, branch, secret-leak) — no validators' },
    { name: 'quality', description: 'Security guards + quality validators (lint, test-runner, error-pattern-detector)' },
    { name: 'full', description: 'All features enabled — security, quality, tracking, and integrations' },
  ];

  return presets
    .map((p) => `  ${pc.cyan(p.name.padEnd(12))} ${pc.dim(p.description)}`)
    .join('\n');
}

export function formatGuardList(): string {
  const guards = builtInFeatures
    .filter((f) => f.meta.name.includes('-guard'))
    .map((f) => ({ name: f.meta.name, description: f.meta.description }));

  return guards
    .map((g) => `  ${pc.yellow('🛡')} ${pc.bold(g.name.padEnd(22))} ${pc.dim(g.description)}`)
    .join('\n');
}

export function formatValidatorList(): string {
  const validators = builtInFeatures
    .filter((f) => f.meta.name.includes('-validator'))
    .map((f) => ({ name: f.meta.name, description: f.meta.description }));

  return validators
    .map((v) => `  ${pc.blue('✓')} ${pc.bold(v.name.padEnd(22))} ${pc.dim(v.description)}`)
    .join('\n');
}

export function formatSettings(settings: ClaudeSettings): string {
  const lines: string[] = [pc.bold('Generated settings:'), ''];

  if (settings.hooks) {
    lines.push(pc.underline('Hooks:'));
    for (const hookType of ALL_HOOK_EVENT_TYPES) {
      const entries = settings.hooks[hookType];
      if (entries && entries.length > 0) {
        const matchers = entries.map((e) => e.matcher || '(all)').join(', ');
        lines.push(`  ${pc.green(hookType.padEnd(22))} ${pc.dim(matchers)}`);
      }
    }
  }

  return lines.join('\n');
}

export function formatTestResult(hookType: HookEventType, exitCode: number, stdout: string, stderr: string): string {
  const status = exitCode === 0
    ? pc.green('PASS')
    : exitCode === 2
      ? pc.red('BLOCKED')
      : pc.yellow('ERROR');

  const lines: string[] = [
    `${pc.bold('Hook:')} ${hookType}`,
    `${pc.bold('Status:')} ${status} (exit code: ${exitCode})`,
  ];

  if (stdout) {
    lines.push(`${pc.bold('stdout:')} ${stdout}`);
  }
  if (stderr) {
    lines.push(`${pc.bold('stderr:')} ${pc.red(stderr)}`);
  }

  return lines.join('\n');
}

export function formatInitSuccess(projectDir: string, preset: PresetName): string {
  return [
    '',
    pc.green('✓ Claude hooks initialized successfully!'),
    '',
    `  ${pc.bold('Project:')} ${projectDir}`,
    `  ${pc.bold('Preset:')}  ${preset}`,
    '',
    pc.dim('Settings written to .claude/settings.json'),
    '',
  ].join('\n');
}



/**
 * Formats features grouped by category with enabled/disabled indicators.
 *
 * @param features - Array of feature metadata to display.
 * @param config - Resolved config used to determine enabled/disabled status.
 * @param verbose - If true, shows configPath, hookTypes, and priority.
 */
export function formatFeatureList(features: FeatureMeta[], config: ToolkitConfig, verbose: boolean): string {
  const categoryOrder: FeatureCategory[] = ['security', 'quality', 'tracking', 'integration'];
  const categoryLabels: Record<FeatureCategory, string> = {
    security: 'Security',
    quality: 'Quality',
    tracking: 'Tracking',
    integration: 'Integration',
  };

  const grouped = new Map<FeatureCategory, FeatureMeta[]>();
  for (const cat of categoryOrder) {
    grouped.set(cat, []);
  }

  for (const feature of features) {
    const list = grouped.get(feature.category);
    if (list) {
      list.push(feature);
    } else {
      grouped.set(feature.category, [feature]);
    }
  }

  const lines: string[] = [];

  for (const category of categoryOrder) {
    const items = grouped.get(category);
    if (!items || items.length === 0) continue;

    lines.push(pc.bold(categoryLabels[category] + ':'));

    for (const meta of items) {
      const enabled = isFeatureEnabled(meta, config);
      const icon = enabled ? pc.green('✅') : pc.red('❌');
      const alwaysOn = !meta.configPath;
      const suffix = alwaysOn ? pc.dim(' (always on)') : '';
      const name = pc.bold(meta.name.padEnd(22));
      const desc = pc.dim(meta.description);

      if (verbose) {
        lines.push(`  ${icon} ${name} ${desc}${suffix}`);
        lines.push(`      ${pc.dim('hooks:')} ${meta.hookTypes.join(', ')}`);
        lines.push(`      ${pc.dim('config:')} ${meta.configPath || '(none)'}`);
        lines.push(`      ${pc.dim('priority:')} ${String(meta.priority)}`);
      } else {
        lines.push(`  ${icon} ${name} ${desc}${suffix}`);
      }
    }

    lines.push('');
  }

  lines.push(pc.dim("Run 'claude-hooks add <name>' to enable a feature."));

  return lines.join('\n');
}
