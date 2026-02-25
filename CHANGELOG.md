# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-24

### Added

#### Feature Modules (26)

- **Security Guards** (5): command-guard, file-guard, path-guard, secret-leak-guard, scope-guard
- **Quality Validators** (6): lint-validator, typecheck-validator, diff-size-guard, branch-guard, error-pattern-detector, test-runner
- **Session & Tracking** (8): logger, session-tracker, prompt-history, transcript-backup, cost-tracker, todo-tracker, change-summary, file-backup
- **Integration** (7): git-context, context-injector, notification-webhook, permission-handler, commit-auto, project-visualizer, rate-limiter

#### Hook Events (13)

- PreToolUse, PostToolUse, PostToolUseFailure
- Notification, PermissionRequest
- SessionStart, SessionEnd
- PreCompact, Stop, Setup
- SubagentStart, SubagentStop
- UserPromptSubmit

#### CLI

- 9 commands: `init`, `list`, `add`, `remove`, `eject`, `status`, `test`, `config`, `help`
- Interactive setup wizard (`init -i`)
- 4 presets: minimal, standard, strict, maximal
- Dry-run mode (`init --dry-run`)
- VS Code hooks format (`init -f vscode`)
- Machine-readable status output (`status --json`)
- Hook simulation with detailed reasoning (`test <hook> --explain`)
- Topic-based help system (`help hooks`, `help presets`, `help config`, `help security`, `help vscode`)

#### Platform & Compatibility

- Cross-platform support: Windows, macOS, Linux
- VS Code Copilot hooks support (input normalization + output formatting)
- Dual-host support: Claude Code CLI and VS Code Copilot

#### Configuration

- Deep merge of user config with defaults
- Data-driven schema validation with `FIELD_RULES`
- ReDoS detection in config validation
- Hot-reload support

#### Architecture

- Feature registry with priority-based pipeline execution
- Lazy feature loading for fast hook startup
- Feature module pattern: `meta.ts` + `handler.ts` + `index.ts`
- Priority ranges: Security (0–99), Quality (100–199), Tracking (200+), Integration (800+)

#### Security

- SSRF protection in webhook URLs
- Log redaction for sensitive fields
- `execFileSync` enforcement (prevents shell injection)

#### Testing & CI

- 985+ tests across 65+ test files
- GitHub Actions CI workflow (lint, test on 3 OSes × 2 Node versions, build)

#### Documentation

- [README.md](README.md) — quick start and feature overview
- [docs/FEATURES.md](docs/FEATURES.md) — detailed feature catalog (all 26 features)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture guide for contributors
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution guidelines
