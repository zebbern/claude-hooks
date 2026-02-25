# Project Instructions

> Keep under 150 lines. Focus on actionable instructions.

## PROJECT

- **Name**: claude-hooks-toolkit
- **Stack**: TypeScript 5.7+, Node.js 18+, Vitest 3, Commander 13, Picocolors
- **Architecture**: Single-package CLI tool (ESM module)
- **Description**: Comprehensive Claude Code hooks toolkit — 26 features across 4 categories with security guards, validators, cross-platform CLI, and feature registry. Locally hosted, installed via npm, used by individual developers to protect and enhance their Claude Code / VS Code Copilot agent sessions.

## COMMANDS

```bash
npm run build        # TypeScript compilation (tsc → dist/) + esbuild hook bundling
npm run build:types  # TypeScript declarations only (tsc --emitDeclarationOnly)
npm run build:hooks  # Bundle hooks only (esbuild → dist/hooks/)
npm test             # Run all tests (vitest run)
npm run test:watch   # Watch mode tests
npm run test:coverage # Coverage report (vitest run --coverage)
npm run lint         # Type check (tsc --noEmit)

# CLI commands
claude-hooks init                    # Generate hooks + settings
claude-hooks init -i                 # Interactive setup wizard
claude-hooks init -f vscode          # VS Code .github/hooks/ format
claude-hooks init --dry-run           # Preview without writing files
claude-hooks status                  # Show hook installation status
claude-hooks status --json           # Machine-readable status output
claude-hooks config validate         # Validate config file
claude-hooks test <hook> --explain   # Show detailed hook reasoning
claude-hooks help <topic>            # Topic guidance (hooks, presets, config, security, vscode)
```

## STRUCTURE

```
src/
  cli.ts                 # CLI entry point (commander-based, modular command registration)
  cli-init.ts            # `init` command implementation
  cli-config.ts          # `config show/generate/validate` commands
  cli-features.ts        # `add/remove/eject/list` commands
  cli-status.ts          # `status` command (hook installation status)
  cli-test.ts            # `test` command (simulate hook execution)
  cli-errors.ts          # CLI error formatting with suggestions
  cli-prompts.ts         # Interactive init wizard prompts
  config.ts              # Configuration loading with deep merge + extends support
  config-defaults.ts     # DEFAULT_CONFIG constant with all default values
  config-modifier.ts     # Enable/disable features in config files
  config-presets.ts      # Preset definitions (minimal, security, quality, full) + extends support
  config-validator.ts    # Config schema validation (data-driven FIELD_RULES)
  help-topics.ts         # Help topic content (hooks, presets, config, security, vscode)
  index.ts               # Public API barrel exports
  types.ts               # All TypeScript interfaces and types
  features/              # 26 feature modules (meta + handler + index each)
    index.ts             # Eager feature registration for the registry
    lazy-features.ts     # Lazy descriptors for async loading (performance)
    command-guard/       # Blocks dangerous shell commands
    file-guard/          # Protects sensitive files
    path-guard/          # Prevents path traversal
    secret-leak-guard/   # Scans for leaked secrets
    ...                  # 22 more feature modules
  registry/              # Feature registry system (dynamic loading, priority pipeline)
  runtime/               # Hook runner, stdin reader, exit codes, exec utils
    input-normalizer.ts  # VS Code input normalization (camelCase → snake_case)
    output-formatter.ts  # VS Code hookSpecificOutput JSON envelope formatting
  hooks/                 # 13 hook entry points (one per hook event type)
    run-hook.ts          # Shared hook dispatcher (eliminates boilerplate across 13 hooks)
  generator/             # Settings and config generation (presets, .claude/settings.json)
  reporter/              # Terminal and JSON output formatting
  utils/                 # Shared utilities
    guard-result.ts      # GuardResult builder helpers
    tool-inputs.ts       # WRITE_TOOLS constant, file path extraction
    jsonl.ts             # JSONL read/write helpers
    glob.ts              # globToRegex implementation for scope guard
    regex-safety.ts      # Safe regex compilation (prevents ReDoS)
    redact.ts            # Secret redaction for logging
    text.ts              # Text utility functions
  guards/                # Thin re-exports (backward compat)
  validators/            # Thin re-exports (backward compat)
  handlers/              # Thin re-exports (backward compat)
tests/                   # Vitest test files (mirrors src/ structure)
  fixtures/              # Hook input JSON fixtures
docs/                    # Documentation
  FEATURES.md            # Detailed feature catalog (all 26 features)
  ARCHITECTURE.md        # Architecture guide for contributors
scripts/
  bundle-hooks.mjs       # esbuild bundler for hook entry points
config-schema.json       # JSON Schema for config file autocompletion
CONTRIBUTING.md          # Contributor guidelines
CHANGELOG.md             # Release changelog
LICENSE                  # MIT license
dist/                    # Build output (gitignored)
```

## DEPLOYMENT_MODEL

- **Locally hosted**: Users install via `npm install claude-hooks-toolkit`
- **Local execution**: All hooks run as local Node.js processes
- **No server component**: No backend, no API, no database — pure CLI + hook scripts
- **Cross-platform**: Windows, macOS, Linux via Node.js
- **Dual-host support**: Works with both Claude Code CLI and VS Code Copilot hooks

## COMMUNICATION_PROTOCOL

- [P0-MUST] ALL user communication happens through Discord MCP (`discord_ask`, `discord_notify`, `discord_embed`).
- [P0-MUST] Sessions NEVER end without user confirmation via `discord_ask`.
- [P0-MUST] Only the Orchestrator agent has Discord access. Subagents report to the orchestrator.

## CONSTRAINTS

- [P0-MUST] Never commit secrets, API keys, or credentials.
- [P0-MUST] Quality over speed — rushed or incomplete outputs are unacceptable.
- [P0-MUST] All features follow the meta.ts + handler.ts + index.ts module pattern.
- [P0-MUST] Hook handlers must never crash — use try/catch with best-effort execution.
- [P0-MUST] Exit codes: 0 = proceed, 1 = error, 2 = block.
- [P1-SHOULD] Use descriptive names: functions describe actions, variables describe data.
- [P1-SHOULD] Prefer `const` over `let`. Never use `var`.
- [P1-SHOULD] Write pure functions where possible. Minimize side effects.
- [P0-MUST] Use `execFileSync` not `execSync` for all shell commands (prevent injection).
- [P1-SHOULD] Run `npm test` and `npm run lint` after changes to verify correctness.
- [P1-SHOULD] Maintain backward compatibility with the existing programmatic API.

## ARCHITECTURE_DECISIONS

- **Feature pattern**: Every feature = meta.ts (metadata) + handler.ts (logic) + index.ts (wiring)
- **Registry system**: Dynamic feature loading, priority-based pipeline execution
- **Priority ranges**: Security 0-99, Quality 100-199, Tracking 200+, Integration 800+
- **Config strategy**: Deep merge of user config with defaults; arrays replace, not append
- **No runtime deps beyond**: commander (CLI) + picocolors (terminal colors)
- **ESM only**: "type": "module" with Node16 resolution
- **VS Code compatibility**: Input normalizer (camelCase → snake_case) + output formatter (hookSpecificOutput JSON envelope)
- **OS-specific commands**: Settings generator produces windows/linux/osx command variants
- **Config validation**: Data-driven FIELD_RULES for type/range/regex validation
- **Shared utilities**: `src/utils/` for WRITE_TOOLS, guard-result builders, JSONL helpers, glob matching, regex safety, redaction
- **Lazy loading**: `loadEnabledHandlersAsync` imports only needed feature modules for faster hook startup
- **Config extends**: `extends` field supports preset names or file paths with circular reference detection
- **esbuild bundling**: Hook entry points bundled to single files (~118KB each) for zero-import startup
- **JSON Schema**: `config-schema.json` for editor autocompletion in config files

## GIT_CONVENTIONS

- [P1-SHOULD] Branch names: `feature/description`, `fix/description`, `chore/description`
- [P1-SHOULD] Commit messages: conventional commits format, imperative mood, max 72 chars
- [P2-MAY] Squash merge to main. Delete branches after merge.

## KNOWN_ISSUES

- Configuration arrays replace defaults entirely when overridden — documented behavior
- File guard matches basename only, not full path — documented limitation
