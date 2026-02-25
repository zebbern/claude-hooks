# Claude Hooks Toolkit

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ESM](https://img.shields.io/badge/Module-ESM-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

**Protect and enhance your Claude Code sessions with 26 configurable hook features — security guards, quality validators, session tracking, and integration tools.**

Works with both **Claude Code CLI** and **VS Code Copilot** hooks. One command to set up. Zero runtime dependencies beyond Commander and Picocolors.

---

## Quick Start

```bash
# 1. Install
npm install claude-hooks-toolkit

# 2. Initialize with security guards enabled
npx claude-hooks init --preset security

# 3. Done — Claude Code now runs hooks automatically
```

This creates `.claude/settings.json` (hook commands) and `claude-hooks.config.json` (toolkit settings) in your project.

**Verify it works:**

```bash
# Should BLOCK — dangerous command
npx claude-hooks test PreToolUse --input '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}'

# Should PROCEED — safe command
npx claude-hooks test PreToolUse --input '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'
```

---

## What It Does

The toolkit hooks into Claude Code's [hook system](https://docs.anthropic.com/en/docs/claude-code/hooks) and runs configurable scripts at key lifecycle events. Features are organized into four categories:

| Category | Count | Purpose | Examples |
|----------|-------|---------|----------|
| **Security** | 9 | Block dangerous operations before they execute | Command guard, file guard, secret leak scanner, branch protection |
| **Quality** | 4 | Validate code quality after edits | ESLint, TypeScript checker, test runner, error pattern detection |
| **Tracking** | 10 | Log events, back up files, record analytics | Session logger, prompt history, file backups, change summaries |
| **Integration** | 3 | Connect to external systems | Webhooks, auto-commit, project visualization |

---

## Feature Catalog

All 26 features sorted by execution priority. Lower priority numbers run first.

### Security (Priority 0–99)

| Feature | Pri | Hook Types | Description | Default |
|---------|-----|------------|-------------|---------|
| `rate-limiter` | 3 | PreToolUse | Limits tool calls per session to prevent runaway automation | Off |
| `file-backup` | 5 | PreToolUse | Creates backups of files before Write/Edit/MultiEdit overwrites | Off |
| `branch-guard` | 8 | PreToolUse | Blocks file modifications on protected Git branches | Off |
| `command-guard` | 10 | PreToolUse | Blocks dangerous shell commands (rm -rf, chmod 777, etc.) | **On** |
| `permission-handler` | 10 | PermissionRequest | Auto-allows/denies tool permissions (deny > ask > allow) | Always on |
| `file-guard` | 20 | PreToolUse | Blocks writes to sensitive files (.env, \*.pem, \*.key) | **On** |
| `secret-leak-guard` | 25 | PreToolUse | Scans content for leaked API keys and secrets before writing | **On** |
| `path-guard` | 30 | PreToolUse | Blocks file operations outside the project root | **On** |
| `scope-guard` | 35 | PreToolUse | Restricts file modifications to allowed path patterns | Off |
| `diff-size-guard` | 40 | PreToolUse | Blocks edits exceeding a configurable line limit | Off |

### Quality (Priority 100–199)

| Feature | Pri | Hook Types | Description | Default |
|---------|-----|------------|-------------|---------|
| `lint-validator` | 100 | PostToolUse | Runs ESLint on modified files after edits | Off |
| `typecheck-validator` | 110 | PostToolUse | Runs TypeScript compiler to verify type safety | Off |
| `test-runner` | 120 | PostToolUse | Auto-detects and runs test suites after edits | Off |
| `error-pattern-detector` | 120 | PostToolUseFailure | Detects repeated failures and suggests alternatives | Off |

### Tracking (Priority 200+)

| Feature | Pri | Hook Types | Description | Default |
|---------|-----|------------|-------------|---------|
| `transcript-backup` | 200 | PreCompact | Backs up transcripts before compaction | Always on |
| `context-injector` | 205 | SessionStart, UserPromptSubmit | Injects project context files as additional context | Off |
| `git-context` | 210 | SessionStart, Setup | Injects git branch, status, and recent commits | Always on |
| `session-tracker` | 220 | SessionStart, SessionEnd, Stop | Tracks session lifecycle events | Always on |
| `prompt-history` | 230 | UserPromptSubmit | Logs user prompts to per-session JSONL files | **On** |
| `change-summary` | 250 | PostToolUse, Stop | Records file changes and generates session summaries | Off |
| `todo-tracker` | 260 | PostToolUse, Stop | Tracks TODO/FIXME/HACK/XXX markers in written code | Off |
| `cost-tracker` | 800 | PostToolUse, Stop | Tracks tool usage and generates usage reports | Off |
| `logger` | 900 | All 13 types | Appends JSONL log entries for every hook event | Always on |

### Integration (Priority 800+)

| Feature | Pri | Hook Types | Description | Default |
|---------|-----|------------|-------------|---------|
| `project-visualizer` | 215 | SessionStart | Generates Mermaid diagrams of project structure | Off |
| `commit-auto` | 850 | Stop | Auto-commits changes with conventional commit messages | Off |
| `notification-webhook` | 950 | Stop, Notification | Sends webhook notifications via HTTP POST | Off |

> **Detailed documentation for each feature:** [docs/FEATURES.md](docs/FEATURES.md)

---

## CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init [dir]` | Generate hooks + config from a preset | `npx claude-hooks init --preset security` |
| `add <features...>` | Enable features in config | `npx claude-hooks add diff-size-guard file-backup` |
| `remove <features...>` | Disable features in config | `npx claude-hooks remove lint-validator` |
| `eject <feature>` | Copy feature source for customization | `npx claude-hooks eject command-guard` |
| `list` | List hooks, features, guards, presets | `npx claude-hooks list --features --verbose` |
| `test <hook>` | Test a hook with sample input | `npx claude-hooks test PreToolUse --input '{...}'` |
| `status` | Show hook installation status | `npx claude-hooks status --json` |
| `config show\|generate\|validate` | View or generate configuration | `npx claude-hooks config show --format json` |
| `help [topic]` | Detailed help on hooks, presets, config, security, vscode | `npx claude-hooks help presets` |

All commands that produce output accept `--format terminal` (default) or `--format json` for machine-readable output.

### Interactive Setup

```bash
npx claude-hooks init -i
```

The interactive wizard walks you through preset selection, feature toggling, and configuration options.

---

## Configuration

Create `claude-hooks.config.json` in your project root. You only need to specify overrides — everything deep-merges with built-in defaults.

### Editor Autocompletion

Add a `$schema` key to your config file for full autocompletion, hover docs, and validation in VS Code and other JSON-aware editors:

```json
{
  "$schema": "./node_modules/claude-hooks-toolkit/config-schema.json"
}
```

### Minimal Override Example

```json
{
  "guards": {
    "branch": { "enabled": true },
    "diffSize": { "maxLines": 300, "enabled": true }
  },
  "validators": {
    "lint": { "enabled": true },
    "test": { "enabled": true }
  }
}
```

### Common Setups

**Security-focused (block dangerous operations):**

```json
{
  "guards": {
    "command": { "enabled": true },
    "file": { "enabled": true },
    "path": { "enabled": true },
    "secretLeak": { "enabled": true },
    "branch": { "enabled": true }
  }
}
```

**Quality-focused (validate after every edit):**

```json
{
  "validators": {
    "lint": { "enabled": true },
    "typecheck": { "enabled": true },
    "test": { "command": "npx vitest run", "enabled": true }
  },
  "errorPatternDetector": { "enabled": true }
}
```

**Full tracking (log everything):**

```json
{
  "fileBackup": { "enabled": true },
  "costTracker": { "enabled": true },
  "changeSummary": { "enabled": true },
  "todoTracker": { "enabled": true },
  "contextInjector": {
    "contextFiles": [".claude/context.md", "AGENTS.md"],
    "enabled": true
  }
}
```

### Array Replacement

Arrays in your config **replace** defaults entirely — they are not appended. To add a custom blocked pattern while keeping defaults, copy the full default array and add your entry:

```json
{
  "guards": {
    "command": {
      "blockedPatterns": [
        "rm\\s+.*-[a-z]*r[a-z]*f",
        "chmod\\s+777",
        "mkfs",
        "dd\\s+if=",
        "shutdown",
        "reboot",
        "my-custom-pattern"
      ]
    }
  }
}
```

### Full Default Configuration

<details>
<summary>Click to expand full defaults</summary>

```json
{
  "logDir": "logs/claude-hooks",
  "transcriptBackupDir": "logs/claude-hooks/transcript-backups",
  "defaultTimeout": 30,
  "guards": {
    "command": {
      "enabled": true,
      "blockedPatterns": [
        "rm\\s+.*-[a-z]*r[a-z]*f",
        "rm\\s+-rf\\s+/",
        "rm\\s+-rf\\s+~",
        "rm\\s+-rf\\s+\\.",
        "chmod\\s+777",
        "mkfs",
        "dd\\s+if=",
        ">\\s*/dev/sda",
        "shutdown",
        "reboot",
        ":\\(\\)\\{\\s*:\\|:\\s*&\\s*\\};:"
      ],
      "allowedPatterns": []
    },
    "file": {
      "enabled": true,
      "protectedPatterns": [".env", "*.pem", "*.key", "id_rsa*", "*.secret*"]
    },
    "path": { "enabled": true, "allowedRoots": [] },
    "diffSize": { "maxLines": 500, "enabled": false },
    "branch": {
      "protectedBranches": ["main", "master", "production", "release/*"],
      "enabled": false
    },
    "secretLeak": { "customPatterns": [], "allowedPatterns": [], "enabled": true },
    "scope": { "allowedPaths": [], "enabled": false }
  },
  "validators": {
    "lint": { "command": "npx eslint --no-warn-ignored", "enabled": false },
    "typecheck": { "command": "npx tsc --noEmit", "enabled": false },
    "test": { "command": "", "timeout": 60000, "enabled": false }
  },
  "permissions": {
    "autoAllow": ["Read", "Glob", "Grep"],
    "autoDeny": [],
    "autoAsk": []
  },
  "promptHistory": { "enabled": true },
  "fileBackup": { "backupDir": "logs/claude-hooks/file-backups", "enabled": false },
  "costTracker": { "outputPath": "logs/claude-hooks/cost-reports", "enabled": false },
  "webhooks": {
    "url": "",
    "events": ["Stop", "Notification"],
    "includeFullInput": false,
    "enabled": false
  },
  "changeSummary": { "outputPath": "logs/claude-hooks/change-summaries", "enabled": false },
  "rateLimiter": { "maxToolCallsPerSession": 0, "maxFileEditsPerSession": 0, "enabled": false },
  "todoTracker": {
    "outputPath": "logs/claude-hooks/todo-reports",
    "patterns": ["TODO", "FIXME", "HACK", "XXX"],
    "enabled": false
  },
  "errorPatternDetector": { "maxRepeats": 3, "enabled": false },
  "contextInjector": { "contextFiles": [".claude/context.md"], "enabled": false },
  "autoCommit": { "messageTemplate": "", "enabled": false },
  "projectVisualizer": {
    "outputPath": "logs/claude-hooks/project-viz",
    "maxDepth": 2,
    "enabled": false
  }
}
```

</details>

---

## Presets

Presets configure which features are enabled when you run `claude-hooks init`.

| Preset | Guards | Quality | Tracking & Integration |
|--------|--------|---------|------------------------|
| `minimal` | All off | All off | All off |
| `security` | command, file, path, branch, secret-leak | — | — |
| `quality` | command, file, path | lint, test, error-pattern-detector | — |
| `full` | command, file, path, diff-size, branch, secret-leak, scope | lint, typecheck, test, error-pattern-detector | file-backup, cost-tracker, webhooks, change-summary, rate-limiter, todo-tracker, context-injector, auto-commit, project-visualizer |

After initialization, customize further with `claude-hooks add` and `claude-hooks remove`.

---

## Hook Types

Claude Code fires hooks at 13 lifecycle events. Each hook receives a JSON payload via stdin and reads the exit code to decide what to do.

| Exit Code | Meaning |
|-----------|---------|
| `0` | **Proceed** — continue normally |
| `1` | **Error** — hook encountered an error |
| `2` | **Block** — hook rejected the action |

| Hook Type | When It Fires | Active Features |
|-----------|---------------|-----------------|
| `PreToolUse` | Before tool execution | Guards, rate limiter, file backup |
| `PostToolUse` | After successful tool use | Validators, cost tracker, change summary, todo tracker |
| `PostToolUseFailure` | After tool failure | Error pattern detector |
| `UserPromptSubmit` | User submits a prompt | Prompt history, context injector |
| `Notification` | System notification | Webhook, logger |
| `Stop` | Agent stops | Cost summary, change summary, auto-commit, webhook |
| `SubagentStart` | Subagent spawned | Logger |
| `SubagentStop` | Subagent finished | Logger |
| `PreCompact` | Before context compaction | Transcript backup |
| `Setup` | Hook system initialization | Git context |
| `SessionStart` | Session begins | Session tracker, git context, context injector, project visualizer |
| `SessionEnd` | Session ends | Session tracker |
| `PermissionRequest` | Tool permission requested | Permission handler (auto-allow/deny) |

> **Official hooks documentation:** <https://docs.anthropic.com/en/docs/claude-code/hooks>

---

## VS Code Copilot Support

The toolkit works with both Claude Code CLI and VS Code Copilot hooks. VS Code sends camelCase input fields (`toolName` instead of `tool_name`), and expects output in a `hookSpecificOutput` JSON envelope.

The toolkit handles this automatically:
- **Input normalizer** detects VS Code format and converts camelCase → snake_case
- **Output formatter** wraps results in the VS Code JSON envelope

To generate hooks in VS Code format:

```bash
npx claude-hooks init --preset security -f vscode
```

Or generate for both formats:

```bash
npx claude-hooks init --preset security -f both
```

Learn more: `npx claude-hooks help vscode`

---

## Programmatic API

All features, guards, validators, and generators are exported for use in custom hooks or scripts.

```ts
import {
  // Configuration
  loadConfig, DEFAULT_CONFIG, validateConfig,

  // Guards
  checkCommand, checkFileAccess, checkPathTraversal,
  checkDiffSize, checkBranch, checkSecretLeak,
  checkScope, checkRateLimit,

  // Registry
  getFeatureRegistry, loadEnabledHandlers,
  enableFeatureInConfig, disableFeatureInConfig,

  // Runtime
  createHookRunner,

  // Generators
  generateSettings, writeSettings,
  generateToolkitConfig, writeToolkitConfig,
} from 'claude-hooks-toolkit';
```

### Quick Example — Custom Guard

```ts
import { createHookRunner, checkCommand, checkFileAccess } from 'claude-hooks-toolkit';
import type { PreToolUseInput } from 'claude-hooks-toolkit';

createHookRunner<PreToolUseInput>('PreToolUse', [
  (input, config) => {
    const result = checkCommand(input, config);
    if (result.action === 'block') {
      return { exitCode: 2, stderr: result.message };
    }
    return undefined; // proceed
  },
]);
```

### Quick Example — Feature Registry

```ts
import { getFeatureRegistry, loadEnabledHandlers, loadConfig } from 'claude-hooks-toolkit';

const config = loadConfig();
const registry = getFeatureRegistry();

// Get all security features
const security = registry.getAll().filter(f => f.meta.category === 'security');

// Load handlers for a specific hook type
const handlers = loadEnabledHandlers('PreToolUse', config);
```

---

## Security Model

Guards are a **defense-in-depth** layer, not a sandbox. The `PermissionRequest` hook uses deny-before-allow ordering. Be aware of limitations:

- **Obfuscated commands** — Base64/hex-encoded commands bypass regex detection
- **Non-Bash tools** — The command guard only inspects the `Bash` tool
- **Read operations** — File guard only blocks writes, not reads
- **Basename matching** — File guard matches filenames, not full paths

See the [Security Model section](docs/FEATURES.md) in the features documentation for details.

---

## Architecture

For contributors — the codebase follows a modular feature pattern:

```
src/features/<name>/
├── meta.ts      # Metadata: name, hookTypes, category, priority, configPath
├── handler.ts   # Business logic + createHandler() factory
└── index.ts     # Wiring: combines meta + handler into FeatureModule
```

The **Feature Registry** loads enabled features dynamically and executes them in a priority-sorted pipeline. Security guards (0–99) run before quality validators (100–199), which run before tracking handlers (200+).

**Data flow:**

```
stdin (JSON) → hook-runner → registry.getEnabled(hookType) → handlers[] → stdout/stderr + exit code
```

> **Full architecture guide:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Development

```bash
npm run build         # Compile TypeScript → dist/
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode
npm run lint          # Type check (tsc --noEmit)
```

**Requirements:** Node.js 18+, TypeScript 5.7+

**Dependencies:** `commander` (CLI), `picocolors` (terminal colors) — no other runtime dependencies.

---

## License

MIT
