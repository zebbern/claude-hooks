# Architecture Guide

> Internal architecture reference for contributors and developers extending the toolkit.

## Directory Structure

```
src/
├── cli.ts                  # CLI entry point (Commander program definition)
├── cli-init.ts             # `init` command (generate hooks + config)
├── cli-config.ts           # `config show`, `config generate`, `config validate` commands
├── cli-features.ts         # `add`, `remove`, `eject`, `list` commands
├── cli-status.ts           # `status` command (hook installation status)
├── cli-test.ts             # `test` command (simulate hook execution)
├── cli-errors.ts           # CLI error formatting with suggestions
├── cli-prompts.ts          # Interactive init wizard (readline prompts)
├── config.ts               # Configuration loading with deep merge
├── config-defaults.ts      # DEFAULT_CONFIG constant with all default values
├── config-modifier.ts      # Enable/disable features in config files
├── config-validator.ts     # Config schema validation (data-driven FIELD_RULES)
├── help-topics.ts          # Help topic content (hooks, presets, config, security, vscode)
├── index.ts                # Public API barrel exports
├── types.ts                # All TypeScript interfaces and types
│
├── features/               # 26 feature modules
│   ├── index.ts            # Eagerly loads all features for the registry
│   ├── lazy-features.ts    # Lazy descriptors for async loading
│   ├── command-guard/      # Example feature module
│   │   ├── meta.ts         #   Feature metadata
│   │   ├── handler.ts      #   Business logic
│   │   └── index.ts        #   Wiring (combines meta + handler)
│   └── .../                # 25 more feature modules (same pattern)
│
├── registry/               # Feature registry system
│   ├── feature-registry.ts # FeatureRegistry class + isFeatureEnabled()
│   ├── feature-loader.ts   # loadEnabledHandlers() + loadEnabledHandlersAsync()
│   └── index.ts            # Re-exports
│
├── runtime/                # Hook execution engine
│   ├── hook-runner.ts      # createHookRunner() — reads stdin, runs pipeline, exits
│   ├── stdin-reader.ts     # Reads and parses JSON from stdin
│   ├── input-normalizer.ts # VS Code camelCase → snake_case normalization
│   ├── output-formatter.ts # VS Code hookSpecificOutput JSON envelope
│   ├── exit-codes.ts       # EXIT_PROCEED (0), EXIT_ERROR (1), EXIT_BLOCK (2)
│   ├── exec-utils.ts       # Safe execFileSync wrapper
│   └── index.ts            # Re-exports
│
├── hooks/                  # 13 hook entry points (one per hook event type)
│   ├── pre-tool-use.ts     # Loads PreToolUse handlers → runs pipeline
│   ├── post-tool-use.ts    # Loads PostToolUse handlers → runs pipeline
│   ├── session-start.ts    # Loads SessionStart handlers → runs pipeline
│   └── .../                # 10 more (same pattern)
│
├── generator/              # Settings and config generation
│   ├── settings-generator.ts  # Generate .claude/settings.json from presets
│   ├── hook-resolver.ts       # Resolve hook script paths
│   └── index.ts               # Re-exports
│
├── reporter/               # Output formatting
│   ├── terminal.ts         # Human-readable terminal output
│   ├── json.ts             # Machine-readable JSON output
│   └── index.ts            # createReporter() factory
│
├── utils/                  # Shared utilities
│   ├── guard-result.ts     # GuardResult builder helpers
│   ├── tool-inputs.ts      # WRITE_TOOLS constant, file path extraction
│   ├── jsonl.ts            # JSONL read/write helpers
│   ├── glob.ts             # globToRegex implementation
│   ├── regex-safety.ts     # Safe regex compilation
│   ├── redact.ts           # Secret redaction for logging
│   ├── text.ts             # Text utility functions
│   └── index.ts            # Re-exports
│
├── guards/                 # Thin re-exports (backward compatibility)
├── validators/             # Thin re-exports (backward compatibility)
└── handlers/               # Thin re-exports (backward compatibility)

tests/                      # Vitest test files (mirrors src/ structure)
├── fixtures/               # Hook input JSON fixtures
└── .../                    # Test files per module
```

## Feature Module Pattern

Every feature follows the same three-file pattern:

### meta.ts — Feature Metadata

Defines the feature's identity, which hooks it fires on, category, priority, and config path.

```typescript
import type { FeatureMeta } from '../../types.js';

export const commandGuardMeta: FeatureMeta = {
  name: 'command-guard',           // Unique identifier
  hookTypes: ['PreToolUse'],       // Which hook events this feature handles
  description: 'Blocks dangerous shell commands',
  category: 'security',           // security | quality | tracking | integration
  configPath: 'guards.command',   // Dot-path to the config section ('' = always on)
  priority: 10,                   // Lower = runs earlier in the pipeline
};
```

### handler.ts — Business Logic

Contains the actual feature logic and exports a `createHandler` factory function.

```typescript
import type { HookHandler, PreToolUseInput, HookEventType } from '../../types.js';

export function createHandler(hookType: HookEventType): HookHandler<PreToolUseInput> {
  return async (input, config) => {
    // Feature logic here
    // Return undefined to proceed, or { exitCode: 2, stderr: '...' } to block
  };
}
```

The handler function receives:
- `input` — The parsed JSON from stdin (typed per hook event)
- `config` — The resolved `ToolkitConfig` object

Return values:
- `undefined` — Proceed to the next handler
- `{ exitCode: 0, stdout: '...' }` — Proceed with additional context
- `{ exitCode: 2, stderr: '...' }` — Block the operation
- `{ exitCode: 1, stderr: '...' }` — Report an error

### index.ts — Wiring

Combines metadata and handler into a `FeatureModule` and exports any public API functions.

```typescript
import type { FeatureModule, PreToolUseInput } from '../../types.js';
import { commandGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export const commandGuardFeature: FeatureModule<PreToolUseInput> = {
  meta: commandGuardMeta,
  createHandler,
};

// Public API re-export
export { checkCommand } from './handler.js';
```

## Registry System

The Feature Registry manages all 26 features and provides lookup by hook type, name, and enabled status.

### Registration

All built-in features are registered eagerly in `src/features/index.ts`. This file imports each feature's `FeatureModule` and exports them as an array:

```typescript
export const builtInFeatures: FeatureModule<HookInputBase>[] = [
  commandGuardFeature,
  fileGuardFeature,
  // ... all 26 features
];
```

The `FeatureRegistry` class wraps this array and provides query methods:

```typescript
const registry = getFeatureRegistry();
registry.getAll();                          // All 26 features
registry.getByHookType('PreToolUse');        // Features for that hook type
registry.getEnabled('PreToolUse', config);   // Enabled features for that hook type
registry.get('command-guard');               // Lookup by name
```

### Lazy Loading

For performance, `src/features/lazy-features.ts` provides `LazyFeatureDescriptor` objects that store lightweight metadata eagerly but defer the full module import until needed. The `loadEnabledHandlersAsync()` function uses this to import only the features that match the requested hook type.

### Priority Pipeline

Features execute in ascending priority order within a hook type:

| Priority Range | Category | Purpose |
|----------------|----------|---------|
| 0–99 | Security | Block dangerous operations before they execute |
| 100–199 | Quality | Validate code quality after edits |
| 200–799 | Tracking | Log events, back up files, record analytics |
| 800+ | Integration | Send data to external systems |

Example `PreToolUse` pipeline:

```
rate-limiter (3) → file-backup (5) → branch-guard (8) → command-guard (10)
→ file-guard (20) → secret-leak-guard (25) → path-guard (30)
→ scope-guard (35) → diff-size-guard (40)
```

If any handler returns a non-zero exit code, pipeline execution stops immediately.

### Enabled Check

The `isFeatureEnabled()` function resolves a dot-separated config path (e.g., `guards.command`) into the config object and checks for `enabled: true`. Features with an empty `configPath` are always enabled.

## Hook Lifecycle

```
┌─────────────────────────┐
│   Claude Code / VS Code │
│   fires a hook event    │
└───────────┬─────────────┘
            │ JSON payload via stdin
            ▼
┌─────────────────────────┐
│   Hook Entry Point      │
│   (src/hooks/*.ts)      │
│                         │
│   1. loadConfig()       │
│   2. loadEnabledAsync() │
│   3. createHookRunner() │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Hook Runner           │
│   (runtime/hook-runner) │
│                         │
│   1. Read stdin (raw)   │
│   2. Detect VS Code     │
│   3. Normalize input    │
│   4. Run handlers []    │
│   5. Format output      │
│   6. Exit with code     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Handler Pipeline      │
│   (sorted by priority)  │
│                         │
│   handler₁ → handler₂  │
│   → handler₃ → ...     │
│                         │
│   Stop on non-zero exit │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Output                │
│                         │
│   Exit code:            │
│   0 = proceed           │
│   1 = error             │
│   2 = block             │
│                         │
│   stdout: context/msg   │
│   stderr: error detail  │
└─────────────────────────┘
```

### VS Code Compatibility

When the hook runner detects VS Code-format input (camelCase field names like `toolName` instead of `tool_name`):

1. **Input normalizer** converts camelCase fields to snake_case so handlers work uniformly
2. **Output formatter** wraps stdout into a `hookSpecificOutput` JSON envelope that VS Code expects

This means all handler code uses snake_case internally regardless of the calling host.

## Configuration System

### Loading Flow

```
┌──────────────────────────┐
│  DEFAULT_CONFIG          │  Built-in defaults (config-defaults.ts)
│  (all settings defined)  │
└───────────┬──────────────┘
            │ deep merge
            ▼
┌──────────────────────────┐
│  claude-hooks.config.json│  User overrides (project root)
│  (optional, partial)     │
└───────────┬──────────────┘
            │ deep merge
            ▼
┌──────────────────────────┐
│  Resolved ToolkitConfig  │  Complete config used by handlers
└──────────────────────────┘
```

- `loadConfig()` reads `claude-hooks.config.json` from the current working directory
- Deep merge: objects are recursively merged; **arrays replace** (not append)
- If no config file exists, `DEFAULT_CONFIG` is used as-is
- Config is loaded fresh on every hook invocation (no caching)

### Validation

`config-validator.ts` uses a data-driven `FIELD_RULES` array to validate config values:
- Type checking (string, number, boolean, array)
- Range constraints (e.g., `maxLines >= 1`)
- Regex patterns (e.g., valid URL format)
- Array element type checking

### Config Modifier

`config-modifier.ts` provides `enableFeatureInConfig()` and `disableFeatureInConfig()` functions that read, modify, and write `claude-hooks.config.json` to toggle feature enabled flags. Used by the `add` and `remove` CLI commands.

## Settings Generator

The settings generator creates `.claude/settings.json` files from presets. Each preset defines which hook types get tool-specific matchers.

### Presets

| Preset | What It Configures |
|--------|--------------------|
| `minimal` | All 13 hook types with empty matchers (catch-all) |
| `security` | Adds `Bash`, `Write`, `Edit`, `MultiEdit` matchers to `PreToolUse` |
| `quality` | Security + `PostToolUse` and `PostToolUseFailure` matchers |
| `full` | Quality + enables all tracking and integration features in config |

The generator produces OS-specific command variants (unix, windows, osx) for each hook entry point.

## How to Add a New Feature

1. **Create the feature directory:**
   ```
   src/features/my-feature/
   ├── meta.ts
   ├── handler.ts
   └── index.ts
   ```

2. **Define metadata** in `meta.ts`:
   ```typescript
   import type { FeatureMeta } from '../../types.js';

   export const myFeatureMeta: FeatureMeta = {
     name: 'my-feature',
     hookTypes: ['PostToolUse'],
     description: 'Does something useful',
     category: 'tracking',
     configPath: 'myFeature',
     priority: 240,
   };
   ```

3. **Implement the handler** in `handler.ts`:
   ```typescript
   import type { HookHandler, PostToolUseInput, HookEventType } from '../../types.js';

   export function createHandler(hookType: HookEventType): HookHandler<PostToolUseInput> {
     return async (input, config) => {
       // Your logic here
       return undefined; // proceed
     };
   }
   ```

4. **Wire the module** in `index.ts`:
   ```typescript
   import type { FeatureModule, PostToolUseInput } from '../../types.js';
   import { myFeatureMeta } from './meta.js';
   import { createHandler } from './handler.js';

   export const myFeature: FeatureModule<PostToolUseInput> = {
     meta: myFeatureMeta,
     createHandler,
   };
   ```

5. **Register** in `src/features/index.ts`:
   ```typescript
   import { myFeature } from './my-feature/index.js';
   // Add to the builtInFeatures array
   ```

6. **Add a lazy descriptor** in `src/features/lazy-features.ts`:
   ```typescript
   {
     meta: myFeatureMeta,
     load: async () => (await import('./my-feature/index.js')).myFeature,
   }
   ```

7. **Add config type** (if configurable) in `src/types.ts` under `ToolkitConfig`

8. **Add config defaults** in `src/config-defaults.ts`

9. **Export public API** (if any) in `src/index.ts`

10. **Write tests** in `tests/features/my-feature.test.ts`

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **ESM only** | Modern Node.js standard; enables top-level `await` in hook entry points |
| **No runtime deps beyond commander + picocolors** | Minimal install footprint; hooks run on every tool invocation and must be fast |
| **Lazy feature loading** | Only import the features needed for the current hook type, not all 26 |
| **Priority-based pipeline** | Deterministic order; security blocks before quality validates |
| **Deep merge with array replace** | Predictable config behavior; users explicitly declare full array contents |
| **Always-on features** | Core features (logger, session-tracker, git-context, transcript-backup) have no config toggle — they provide essential infrastructure |
| **Handlers never crash** | All handlers use try/catch with best-effort execution; a logging failure must not block a tool operation |
| **execFileSync over execSync** | Prevents shell injection attacks in validators and Git commands |
| **Dual-host support** | Normalizes VS Code's camelCase input to snake_case so all handlers use a single interface |
