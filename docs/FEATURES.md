# Feature Catalog

> Complete reference for all 26 features in Claude Hooks Toolkit.

Each feature is a self-contained module with metadata (`meta.ts`), business logic (`handler.ts`), and wiring (`index.ts`). Features are registered in the Feature Registry and execute in priority order within their hook pipeline.

**Legend:**
- **Always on** — No config toggle; the feature runs whenever its hook type fires.
- **Config path** — Dot-path into `claude-hooks.config.json` where the `enabled` flag lives.

---

## Security Features (Priority 0–99)

Security features run during `PreToolUse` (or `PermissionRequest`) and block dangerous operations before they execute.

---

### Rate Limiter

| Property | Value |
|----------|-------|
| **Name** | `rate-limiter` |
| **Category** | security |
| **Priority** | 3 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `rateLimiter` |
| **Default** | Disabled |

Limits the number of tool calls and file edits per session. Tracks usage via JSONL files stored in `{logDir}/rate-limiter/`. When a limit is exceeded, the hook blocks further operations. Set a counter to `0` to disable that specific limit.

**Configuration:**

```json
{
  "rateLimiter": {
    "maxToolCallsPerSession": 0,
    "maxFileEditsPerSession": 0,
    "enabled": false
  }
}
```

**Notes:**
- Counts are file-based and tied to the session ID. Restarting a session resets counters.
- A value of `0` means unlimited — that counter is not enforced.

---

### Branch Guard

| Property | Value |
|----------|-------|
| **Name** | `branch-guard` |
| **Category** | security |
| **Priority** | 8 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.branch` |
| **Default** | Disabled |

Blocks file modifications (`Write`, `Edit`, `MultiEdit`) when the current Git branch matches a protected pattern. Detects the current branch via `git rev-parse --abbrev-ref HEAD`. Supports wildcard patterns (e.g., `release/*`).

**Default protected branches:** `main`, `master`, `production`, `release/*`

**Configuration:**

```json
{
  "guards": {
    "branch": {
      "protectedBranches": ["main", "master", "production", "release/*"],
      "enabled": false
    }
  }
}
```

**Notes:**
- Only checks `Write`, `Edit`, and `MultiEdit` tools — read operations are not blocked.
- Requires Git to be installed and the project to be a Git repository.

---

### Command Guard

| Property | Value |
|----------|-------|
| **Name** | `command-guard` |
| **Category** | security |
| **Priority** | 10 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.command` |
| **Default** | Enabled |

Blocks dangerous shell commands executed through the `Bash` tool.

**Default blocked patterns:**
- `rm -rf /`, `rm -rf ~`, `rm -rf .` — recursive force delete
- `chmod 777` — overly permissive permissions
- `mkfs`, `dd if=` — disk formatting/writing
- `shutdown`, `reboot` — system control
- Fork bombs (e.g., `:(){ :|:& };:`)

**Configuration:**

```json
{
  "guards": {
    "command": {
      "enabled": true,
      "blockedPatterns": ["custom-pattern"],
      "allowedPatterns": ["safe-pattern"]
    }
  }
}
```

**Notes:**
- Only inspects the `Bash` tool — commands run through other tools are not checked.
- Pattern matching is regex-based; obfuscated or encoded commands may bypass detection.
- Allowed patterns are checked first — a match skips all blocked pattern checks.

---

### Permission Handler

| Property | Value |
|----------|-------|
| **Name** | `permission-handler` |
| **Category** | security |
| **Priority** | 10 |
| **Hook Types** | `PermissionRequest` |
| **Config Path** | — (always on) |
| **Default** | Always on |

Auto-allows, auto-denies, or prompts user confirmation for tool permissions using a deny-before-allow strategy:

1. Check `autoDeny` patterns first — if matched, deny immediately
2. Check `autoAsk` patterns — if matched, prompt the user
3. Check `autoAllow` patterns — if matched, allow
4. If nothing matches, defer to Claude Code's default behavior

**Configuration:**

```json
{
  "permissions": {
    "autoAllow": ["Read", "Glob", "Grep"],
    "autoDeny": [],
    "autoAsk": []
  }
}
```

---

### File Guard

| Property | Value |
|----------|-------|
| **Name** | `file-guard` |
| **Category** | security |
| **Priority** | 20 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.file` |
| **Default** | Enabled |

Blocks writes to protected files. Checks `Write`, `Edit`, and `MultiEdit` tools.

**Default protected patterns:** `.env`, `*.pem`, `*.key`, `id_rsa*`, `*.secret*`

**Exceptions:** `.env.sample` and `.env.example` are allowed.

**Configuration:**

```json
{
  "guards": {
    "file": {
      "enabled": true,
      "protectedPatterns": [".env", "*.pem", "*.key", "id_rsa*", "*.secret*"]
    }
  }
}
```

**Notes:**
- Only checks `Write`, `Edit`, and `MultiEdit` tools — `Read` operations are not blocked.
- Pattern matching uses the file's basename only, not the full path.

---

### Secret Leak Guard

| Property | Value |
|----------|-------|
| **Name** | `secret-leak-guard` |
| **Category** | security |
| **Priority** | 25 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.secretLeak` |
| **Default** | Enabled |

Scans content in `Write`, `Edit`, and `MultiEdit` operations for leaked secrets and API keys before they are written to disk.

**Built-in patterns detect:**
- AWS access keys (`AKIA...`)
- GitHub tokens (`ghp_`, `ghs_`)
- OpenAI API keys (`sk-`)
- Private key blocks (`-----BEGIN ... PRIVATE KEY-----`)
- Connection strings (`postgresql://`, `mongodb://`, `mysql://`)
- Generic `api_key` / `api_secret` patterns

**Configuration:**

```json
{
  "guards": {
    "secretLeak": {
      "customPatterns": [],
      "allowedPatterns": [],
      "enabled": true
    }
  }
}
```

**Notes:**
- Use `customPatterns` to add additional regex patterns.
- Use `allowedPatterns` to whitelist known-safe strings (e.g., test fixtures).
- Regex-based detection — obfuscated or encoded secrets may bypass scanning.

---

### Path Guard

| Property | Value |
|----------|-------|
| **Name** | `path-guard` |
| **Category** | security |
| **Priority** | 30 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.path` |
| **Default** | Enabled |

Prevents path traversal attacks by blocking file operations that resolve outside the project root directory.

**How it works:**
1. Resolves the target path relative to the project root
2. Normalizes to lowercase with forward slashes
3. Checks that the resolved path starts with the project root (or an allowed root)

**Configuration:**

```json
{
  "guards": {
    "path": {
      "enabled": true,
      "allowedRoots": ["/shared/assets", "/tmp/build"]
    }
  }
}
```

**Notes:**
- Use `allowedRoots` to permit access to directories outside the project root.
- Path normalization prevents bypasses via case variation or mixed separators on Windows.

---

### Scope Guard

| Property | Value |
|----------|-------|
| **Name** | `scope-guard` |
| **Category** | security |
| **Priority** | 35 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.scope` |
| **Default** | Disabled |

Restricts file operations (`Write`, `Edit`, `MultiEdit`) to paths matching allowed glob patterns. When `allowedPaths` is empty, all paths are permitted (open scope).

**Configuration:**

```json
{
  "guards": {
    "scope": {
      "allowedPaths": ["src/**", "tests/**"],
      "enabled": false
    }
  }
}
```

**Notes:**
- An empty `allowedPaths` array means unrestricted — no paths are blocked.
- Supports `**` glob patterns via the built-in `globToRegex` implementation.

---

### Diff Size Guard

| Property | Value |
|----------|-------|
| **Name** | `diff-size-guard` |
| **Category** | security |
| **Priority** | 40 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `guards.diffSize` |
| **Default** | Disabled |

Blocks `Write`, `Edit`, and `MultiEdit` operations when the content exceeds a configurable line limit. Prevents runaway file generation and oversized edits.

**How it works:**
- For `Write`: counts lines in `content`
- For `Edit`: counts lines in `new_string`
- For `MultiEdit`: sums lines across all `edits[].new_string`

**Configuration:**

```json
{
  "guards": {
    "diffSize": {
      "maxLines": 500,
      "enabled": false
    }
  }
}
```

---

## Quality Features (Priority 100–199)

Quality features run after tool execution and validate code quality.

---

### Lint Validator

| Property | Value |
|----------|-------|
| **Name** | `lint-validator` |
| **Category** | quality |
| **Priority** | 100 |
| **Hook Types** | `PostToolUse` |
| **Config Path** | `validators.lint` |
| **Default** | Disabled |

Runs ESLint on modified files after `Write`, `Edit`, or `MultiEdit` operations. Supports `.ts`, `.tsx`, `.js`, `.jsx`, and `.py` extensions. Gracefully skips if ESLint is not installed (returns pass with exit code 0).

**Configuration:**

```json
{
  "validators": {
    "lint": {
      "command": "npx eslint --no-warn-ignored",
      "enabled": false
    }
  }
}
```

---

### Typecheck Validator

| Property | Value |
|----------|-------|
| **Name** | `typecheck-validator` |
| **Category** | quality |
| **Priority** | 110 |
| **Hook Types** | `PostToolUse` |
| **Config Path** | `validators.typecheck` |
| **Default** | Disabled |

Runs `tsc --noEmit` to verify TypeScript compilation after file edits. Skips automatically if no `tsconfig.json` is found or if TypeScript is not installed.

**Configuration:**

```json
{
  "validators": {
    "typecheck": {
      "command": "npx tsc --noEmit",
      "enabled": false
    }
  }
}
```

---

### Test Runner

| Property | Value |
|----------|-------|
| **Name** | `test-runner` |
| **Category** | quality |
| **Priority** | 120 |
| **Hook Types** | `PostToolUse` |
| **Config Path** | `validators.test` |
| **Default** | Disabled |

Auto-detects the project's test framework (vitest, jest, or pytest) and runs tests after `Write`, `Edit`, or `MultiEdit` operations. Falls back to a configured command when auto-detection fails.

**Configuration:**

```json
{
  "validators": {
    "test": {
      "command": "",
      "timeout": 60000,
      "enabled": false
    }
  }
}
```

**Notes:**
- Auto-detection checks for `vitest`, `jest`, and `pytest` in order.
- Set `command` to override auto-detection (e.g., `"npx vitest run"`).
- `timeout` is in milliseconds.
- Runs the full test suite — does not filter to affected tests.

---

### Error Pattern Detector

| Property | Value |
|----------|-------|
| **Name** | `error-pattern-detector` |
| **Category** | quality |
| **Priority** | 120 |
| **Hook Types** | `PostToolUseFailure` |
| **Config Path** | `errorPatternDetector` |
| **Default** | Disabled |

Tracks repeated tool failures via JSONL per session. When the same error occurs 3 or more times, injects context suggesting a different approach. Never blocks — only advises.

**Configuration:**

```json
{
  "errorPatternDetector": {
    "maxRepeats": 3,
    "enabled": false
  }
}
```

---

## Tracking Features (Priority 200+)

Tracking features log events, back up files, and record analytics.

---

### Transcript Backup

| Property | Value |
|----------|-------|
| **Name** | `transcript-backup` |
| **Category** | tracking |
| **Priority** | 200 |
| **Hook Types** | `PreCompact` |
| **Config Path** | — (always on) |
| **Default** | Always on |

Copies the transcript to a timestamped backup before compaction. Backup location is set via `transcriptBackupDir`.

---

### Context Injector

| Property | Value |
|----------|-------|
| **Name** | `context-injector` |
| **Category** | tracking |
| **Priority** | 205 |
| **Hook Types** | `SessionStart`, `UserPromptSubmit` |
| **Config Path** | `contextInjector` |
| **Default** | Disabled |

Reads project context files and injects their contents as additional context for Claude. Supports multiple context files.

**Configuration:**

```json
{
  "contextInjector": {
    "contextFiles": [".claude/context.md"],
    "enabled": false
  }
}
```

---

### Git Context

| Property | Value |
|----------|-------|
| **Name** | `git-context` |
| **Category** | tracking |
| **Priority** | 210 |
| **Hook Types** | `SessionStart`, `Setup` |
| **Config Path** | — (always on) |
| **Default** | Always on |

Collects git branch, working-tree status, and recent commits and injects them as additional context when a session starts.

---

### Session Tracker

| Property | Value |
|----------|-------|
| **Name** | `session-tracker` |
| **Category** | tracking |
| **Priority** | 220 |
| **Hook Types** | `SessionStart`, `SessionEnd`, `Stop` |
| **Config Path** | — (always on) |
| **Default** | Always on |

Tracks session start/end events to `{logDir}/sessions.jsonl`.

---

### Prompt History

| Property | Value |
|----------|-------|
| **Name** | `prompt-history` |
| **Category** | tracking |
| **Priority** | 230 |
| **Hook Types** | `UserPromptSubmit` |
| **Config Path** | `promptHistory` |
| **Default** | Enabled |

Logs user prompts to per-session JSONL files at `{logDir}/prompts/{session_id}.jsonl`.

---

### File Backup

| Property | Value |
|----------|-------|
| **Name** | `file-backup` |
| **Category** | tracking |
| **Priority** | 5 |
| **Hook Types** | `PreToolUse` |
| **Config Path** | `fileBackup` |
| **Default** | Disabled |

Creates a backup of files before they are overwritten by `Write`, `Edit`, or `MultiEdit` tools. Backups are saved to `{backupDir}/{session_id}/{timestamp}_{filename}`. Best-effort — errors never crash the hook.

**Configuration:**

```json
{
  "fileBackup": {
    "backupDir": "logs/claude-hooks/file-backups",
    "enabled": false
  }
}
```

---

### Change Summary

| Property | Value |
|----------|-------|
| **Name** | `change-summary` |
| **Category** | tracking |
| **Priority** | 250 |
| **Hook Types** | `PostToolUse`, `Stop` |
| **Config Path** | `changeSummary` |
| **Default** | Disabled |

Records file changes from `Write`, `Edit`, and `MultiEdit` operations as JSONL entries during a session. On `Stop`, generates a summary JSON with all files changed, tools used, and timestamps.

**Configuration:**

```json
{
  "changeSummary": {
    "outputPath": "logs/claude-hooks/change-summaries",
    "enabled": false
  }
}
```

---

### Todo Tracker

| Property | Value |
|----------|-------|
| **Name** | `todo-tracker` |
| **Category** | tracking |
| **Priority** | 260 |
| **Hook Types** | `PostToolUse`, `Stop` |
| **Config Path** | `todoTracker` |
| **Default** | Disabled |

Scans content from `Write`, `Edit`, and `MultiEdit` operations for TODO, FIXME, HACK, and XXX markers. Appends findings as JSONL entries and generates a summary report on `Stop`.

**Configuration:**

```json
{
  "todoTracker": {
    "outputPath": "logs/claude-hooks/todo-reports",
    "patterns": ["TODO", "FIXME", "HACK", "XXX"],
    "enabled": false
  }
}
```

---

### Cost Tracker

| Property | Value |
|----------|-------|
| **Name** | `cost-tracker` |
| **Category** | tracking |
| **Priority** | 800 |
| **Hook Types** | `PostToolUse`, `Stop` |
| **Config Path** | `costTracker` |
| **Default** | Disabled |

Tracks tool usage during a session and generates summary reports.

- **On `PostToolUse`:** appends a JSONL record (`timestamp`, `session_id`, `tool_name`) to `{outputPath}/{session_id}.jsonl`
- **On `Stop`:** reads all records, computes tool frequency and estimated duration, writes `{session_id}-summary.json`

**Configuration:**

```json
{
  "costTracker": {
    "outputPath": "logs/claude-hooks/cost-reports",
    "enabled": false
  }
}
```

---

### Logger

| Property | Value |
|----------|-------|
| **Name** | `logger` |
| **Category** | tracking |
| **Priority** | 900 |
| **Hook Types** | All 13 hook types |
| **Config Path** | — (always on) |
| **Default** | Always on |

Appends JSONL log entries for all hook events to `{logDir}/{hookType}/{date}.jsonl`.

---

## Integration Features (Priority 800+)

Integration features send data to external systems or perform project-level actions.

---

### Project Visualizer

| Property | Value |
|----------|-------|
| **Name** | `project-visualizer` |
| **Category** | integration |
| **Priority** | 215 |
| **Hook Types** | `SessionStart` |
| **Config Path** | `projectVisualizer` |
| **Default** | Disabled |

Scans the project directory on `SessionStart` and generates Mermaid diagrams: a directory tree (`graph TD`) and a file type distribution (pie chart). Writes output to `{outputPath}/project-structure.md` and injects it as additional context.

**Configuration:**

```json
{
  "projectVisualizer": {
    "outputPath": "logs/claude-hooks/project-viz",
    "maxDepth": 2,
    "enabled": false
  }
}
```

---

### Auto Commit

| Property | Value |
|----------|-------|
| **Name** | `commit-auto` |
| **Category** | integration |
| **Priority** | 850 |
| **Hook Types** | `Stop` |
| **Config Path** | `autoCommit` |
| **Default** | Disabled |

Automatically stages and commits changes when a session ends. Generates conventional commit messages from the diff stat. Supports message templates with `{files}` and `{session_id}` placeholders.

**Configuration:**

```json
{
  "autoCommit": {
    "messageTemplate": "",
    "enabled": false
  }
}
```

**Notes:**
- When `messageTemplate` is empty, a default conventional commit message is generated from the changed file list.
- Requires Git to be installed and the project to be a Git repository.

---

### Notification Webhook

| Property | Value |
|----------|-------|
| **Name** | `notification-webhook` |
| **Category** | integration |
| **Priority** | 950 |
| **Hook Types** | `Stop`, `Notification` |
| **Config Path** | `webhooks` |
| **Default** | Disabled |

Sends webhook notifications for configured hook events via HTTP POST. Fire-and-forget — errors are silently caught. The request body contains `hookType`, `timestamp`, `session_id`, and (optionally) the full input data.

**Configuration:**

```json
{
  "webhooks": {
    "url": "https://example.com/hooks",
    "events": ["Stop", "Notification"],
    "includeFullInput": false,
    "enabled": false
  }
}
```

**Notes:**
- Set `url` to your endpoint and `events` to the hook types you want notifications for.
- Set `includeFullInput: true` to include the full hook input payload in the request body.
