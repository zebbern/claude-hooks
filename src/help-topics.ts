import pc from 'picocolors';

export interface HelpTopic {
  name: string;
  summary: string;
  content: string;
}

const hooksTopic: HelpTopic = {
  name: 'hooks',
  summary: 'Explains hook types with short descriptions',
  content: [
    pc.bold(pc.underline('Hook Types')),
    '',
    `  ${pc.bold('PreToolUse')}           Runs before a tool is executed. Use for guards that block dangerous operations.`,
    `  ${pc.bold('PostToolUse')}          Runs after a tool succeeds. Use for validators, logging, and tracking.`,
    `  ${pc.bold('PostToolUseFailure')}   Runs after a tool fails. Use for error pattern detection.`,
    `  ${pc.bold('UserPromptSubmit')}     Runs when the user submits a prompt. Use for prompt history.`,
    `  ${pc.bold('Notification')}         Runs on agent notifications. Use for webhook forwarding.`,
    `  ${pc.bold('Stop')}                Runs when the agent stops. Use for summaries and cleanup.`,
    `  ${pc.bold('SubagentStart')}       Runs when a subagent is spawned.`,
    `  ${pc.bold('SubagentStop')}        Runs when a subagent finishes.`,
    `  ${pc.bold('PreCompact')}          Runs before context compaction. Use for context injection.`,
    `  ${pc.bold('Setup')}               Runs during initialization or maintenance.`,
    `  ${pc.bold('SessionStart')}        Runs at the start of a session. Use for session tracking.`,
    `  ${pc.bold('SessionEnd')}          Runs at the end of a session. Use for cost tracking and summaries.`,
    `  ${pc.bold('PermissionRequest')}   Runs when a tool requests permission. Use for auto-allow/deny policies.`,
    '',
    pc.dim('  Each hook receives JSON input on stdin and communicates via exit codes:'),
    pc.dim('  0 = proceed, 1 = error, 2 = block.'),
    '',
  ].join('\n'),
};

const presetsTopic: HelpTopic = {
  name: 'presets',
  summary: 'Explains preset differences',
  content: [
    pc.bold(pc.underline('Presets')),
    '',
    `  ${pc.bold('minimal')}    Core guards only: command, file, path.`,
    `              Disables secret-leak-guard (on by default). No validators,`,
    `              no tracking. Best for trying out the toolkit.`,
    '',
    `  ${pc.bold('security')}   All security guards: command, file, path, secret-leak (defaults)`,
    `              plus branch-guard. No validators or tracking.`,
    `              Recommended for most projects.`,
    '',
    `  ${pc.bold('quality')}    Security superset plus diff-size-guard and quality validators:`,
    `              lint, typecheck, test-runner, error-pattern-detector.`,
    `              Best for teams that want automated code quality checks.`,
    '',
    `  ${pc.bold('full')}       Everything enabled: all guards (including scope-guard),`,
    `              all validators, plus tracking and integration features:`,
    `              cost-tracker, file-backup, todo-tracker, webhooks,`,
    `              change-summary, rate-limiter, context-injector, auto-commit,`,
    `              project-visualizer.`,
    '',
    pc.dim('  Use: claude-hooks init --preset <name>'),
    '',
  ].join('\n'),
};

const configTopic: HelpTopic = {
  name: 'config',
  summary: 'Explains config file format',
  content: [
    pc.bold(pc.underline('Configuration')),
    '',
    `  The toolkit reads ${pc.bold('claude-hooks.config.json')} from your project root.`,
    '  If no config file is found, sensible defaults are used.',
    '',
    `  ${pc.bold('Structure:')}`,
    '    {',
    '      "logDir": "logs/claude-hooks",',
    '      "guards": {',
    '        "command": { "enabled": true, "blockedPatterns": [...] },',
    '        "file":    { "enabled": true, "protectedPatterns": [...] },',
    '        "path":    { "enabled": true, "allowedRoots": [...] },',
    '        "branch":  { "enabled": true, "protectedBranches": [...] },',
    '        "secretLeak": { "enabled": true, ... }',
    '      },',
    '      "validators": {',
    '        "lint":      { "enabled": true, "command": "npm run lint" },',
    '        "typecheck": { "enabled": true, "command": "npx tsc --noEmit" }',
    '      },',
    '      ...',
    '    }',
    '',
    `  ${pc.bold('Key rules:')}`,
    '    - Arrays in user config replace defaults (not appended).',
    '    - Objects are deep-merged with defaults.',
    '    - Use "enabled" flags to toggle individual features.',
    '',
    `  ${pc.bold('Inheritance:')}`,
    '    Use "extends" to inherit from a preset or another config file:',
    '    { "extends": "strict", "logDir": "custom-logs" }',
    '    { "extends": "./base-config.json" }',
    '    Merge order: defaults ← extended config ← your config.',
    '',
    pc.dim('  Use: claude-hooks config show        — View current config'),
    pc.dim('  Use: claude-hooks config validate     — Check config for errors'),
    pc.dim('  Use: claude-hooks config generate     — Generate a config file'),
    '',
  ].join('\n'),
};

const securityTopic: HelpTopic = {
  name: 'security',
  summary: 'Explains security features',
  content: [
    pc.bold(pc.underline('Security Features')),
    '',
    `  ${pc.bold('command-guard')}      Blocks dangerous shell commands (rm -rf, mkfs, dd, etc.).`,
    '                     Configurable blocked/allowed patterns.',
    '',
    `  ${pc.bold('file-guard')}         Protects sensitive files (.env, *.pem, *.key, id_rsa).`,
    '                     Blocks write/edit operations to protected patterns.',
    '',
    `  ${pc.bold('path-guard')}         Prevents path traversal attacks (../ sequences).`,
    '                     Ensures tool operations stay within allowed roots.',
    '',
    `  ${pc.bold('branch-guard')}       Prevents direct commits to protected branches`,
    '                     (main, master, production, release/*).',
    '',
    `  ${pc.bold('secret-leak-guard')}  Scans file content for leaked secrets (API keys,`,
    '                     tokens, passwords) before writes are committed.',
    '',
    `  ${pc.bold('scope-guard')}        Restricts file operations to allowed directory paths.`,
    '',
    `  ${pc.bold('rate-limiter')}       Limits tool calls and file edits per session`,
    '                     to prevent runaway operations.',
    '',
    pc.dim('  Guards run in the PreToolUse hook and use exit code 2 to block.'),
    pc.dim('  Command-guard is defense-in-depth, not a sandbox.'),
    '',
  ].join('\n'),
};

const vscodeTopic: HelpTopic = {
  name: 'vscode',
  summary: 'Explains VS Code compatibility',
  content: [
    pc.bold(pc.underline('VS Code Compatibility')),
    '',
    '  The toolkit supports two output formats:',
    '',
    `  ${pc.bold('Claude format')}  (.claude/settings.json)`,
    '    - Used by Claude Code CLI',
    '    - Hook settings with matcher-based filtering',
    '    - Matchers target specific tools (Bash, Write, Edit, etc.)',
    '',
    `  ${pc.bold('VS Code format')}  (.github/hooks/*.json)`,
    '    - Used by VS Code Copilot agent hooks',
    '    - One JSON file per hook event type',
    '    - No matcher-based filtering (all hooks run for all tools)',
    '',
    `  ${pc.bold('Generating both:')}`,
    '    $ claude-hooks init -f both',
    '    $ claude-hooks config generate -f vscode',
    '',
    `  ${pc.bold('Known limitations:')}`,
    '    - VS Code hooks use different field names in some cases',
    '    - Output format differs (hookSpecificOutput vs flat JSON)',
    '    - Not all features are fully compatible with VS Code format',
    '',
    pc.dim('  Use -f/--format flag with init or config generate to choose format.'),
    '',
  ].join('\n'),
};

/** All available help topics, keyed by name. */
export const HELP_TOPICS: ReadonlyMap<string, HelpTopic> = new Map([
  [hooksTopic.name, hooksTopic],
  [presetsTopic.name, presetsTopic],
  [configTopic.name, configTopic],
  [securityTopic.name, securityTopic],
  [vscodeTopic.name, vscodeTopic],
]);

/**
 * Formats the list of available help topics for display.
 */
export function formatTopicList(): string {
  const lines: string[] = [
    pc.bold(pc.underline('Available Help Topics')),
    '',
  ];

  for (const topic of HELP_TOPICS.values()) {
    lines.push(`  ${pc.bold(topic.name.padEnd(12))} ${topic.summary}`);
  }

  lines.push('');
  lines.push(pc.dim('  Use: claude-hooks help <topic>'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Returns the content for a given topic, or null if not found.
 */
export function getTopicContent(topicName: string): string | null {
  const topic = HELP_TOPICS.get(topicName);
  return topic?.content ?? null;
}
