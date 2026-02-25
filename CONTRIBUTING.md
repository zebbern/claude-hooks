# Contributing to Claude Hooks Toolkit

Thank you for your interest in contributing. This guide covers everything you need to set up, develop, test, and submit changes.

## Prerequisites

- **Node.js** 18 or later
- **npm** (ships with Node.js)
- **Git**

## Setup

```bash
git clone <repo-url>
cd claude-hooks-toolkit
npm install
npm run build
npm test
```

All three commands should succeed before you start making changes.

## Project Structure

```
src/
  cli.ts              # CLI entry point (Commander-based)
  cli-*.ts            # CLI command modules (init, status, config, etc.)
  config.ts           # Configuration loading with deep merge
  config-defaults.ts  # Default configuration values
  config-validator.ts # Data-driven config schema validation
  config-modifier.ts  # Enable/disable features in config files
  types.ts            # All TypeScript interfaces and types
  index.ts            # Public API barrel exports
  features/           # 26 feature modules (see "Adding a Feature" below)
  hooks/              # 13 hook entry points (one per hook event)
  registry/           # Feature registry and dynamic loader
  runtime/            # Hook runner, stdin reader, exec utilities
  generator/          # Settings and config file generation
  reporter/           # Terminal and JSON output formatting
  utils/              # Shared utilities (guard-result, glob, JSONL, etc.)
tests/                # Vitest tests (mirrors src/ structure)
docs/                 # Architecture and feature documentation
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript (`tsc` → `dist/`) |
| `npm test` | Run all tests (pretest compiles first) |
| `npm run test:watch` | Watch mode for rapid iteration |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Type-check without emitting (`tsc --noEmit`) |

## Development Workflow

1. Create a branch from `main` using the naming convention:
   - `feature/short-description` for new features
   - `fix/short-description` for bug fixes
   - `chore/short-description` for maintenance tasks

2. Make your changes following the [coding conventions](#coding-conventions).

3. Run the full check before committing:
   ```bash
   npm run lint
   npm test
   ```

4. Commit using [conventional commits](https://www.conventionalcommits.org/):
   ```
   feat: add new-feature-name guard
   fix: correct false positive in command guard
   docs: update FEATURES.md with new feature
   refactor: extract shared validation logic
   test: add edge case tests for path guard
   chore: update dependencies
   ```

5. Open a pull request against `main`.

## Coding Conventions

- **ESM only** — the project uses `"type": "module"` with Node16 module resolution.
- Use `const` over `let`. Never use `var`.
- Prefer pure functions — same input, same output, no side effects.
- Use `camelCase` for variables and functions, `PascalCase` for types and interfaces.
- Use `UPPER_SNAKE_CASE` for constants.
- Use `execFileSync` instead of `execSync` to prevent shell injection.
- Hook handlers must never crash — wrap logic in try/catch with best-effort execution.
- Exit codes: `0` = proceed, `1` = error, `2` = block.

## Adding a Feature

Every feature follows a three-file module pattern. Here is a step-by-step guide.

### 1. Create the feature directory

```bash
mkdir src/features/my-feature
```

### 2. Create `meta.ts`

Define the feature's metadata:

```typescript
import type { FeatureMeta } from '../../types.js';

export const myFeatureMeta: FeatureMeta = {
  name: 'my-feature',
  hookTypes: ['PreToolUse'],          // Which hook events this feature handles
  description: 'Short description of what it does',
  category: 'security',               // security | quality | tracking | integration
  configPath: 'guards.myFeature',     // Dot-path into ToolkitConfig
  priority: 50,                        // Security: 0-99, Quality: 100-199, Tracking: 200+, Integration: 800+
};
```

### 3. Create `handler.ts`

Implement the feature logic as a pure function:

```typescript
import type { HookHandler, HookInputBase, HookEventType, ToolkitConfig } from '../../types.js';

export function createHandler(
  config: ToolkitConfig,
  hookType: HookEventType,
): HookHandler<HookInputBase> {
  return async (input: HookInputBase) => {
    // Feature logic here
    return { proceed: true };
  };
}
```

### 4. Create `index.ts`

Wire the meta and handler together:

```typescript
import type { FeatureModule, HookInputBase } from '../../types.js';
import { myFeatureMeta } from './meta.js';
import { createHandler } from './handler.js';

export { myFeatureMeta } from './meta.js';

export const myFeatureFeature: FeatureModule<HookInputBase> = {
  meta: myFeatureMeta,
  createHandler,
};
```

### 5. Register in `lazy-features.ts`

Add a lazy descriptor to [src/features/lazy-features.ts](src/features/lazy-features.ts) so the feature loads on demand:

```typescript
import { myFeatureMeta } from './my-feature/meta.js';

// Then add to the LAZY_FEATURES array:
{
  meta: myFeatureMeta,
  load: () => import('./my-feature/index.js'),
},
```

### 6. Add tests

Create `tests/features/my-feature.test.ts`. Test both success and failure paths:

```typescript
import { describe, it, expect } from 'vitest';

describe('my-feature', () => {
  it('proceeds for safe input', async () => {
    // ...
  });

  it('blocks for dangerous input', async () => {
    // ...
  });
});
```

### 7. Document

Add your feature to [docs/FEATURES.md](docs/FEATURES.md) in the appropriate category table.

## Testing

Tests live in `tests/` and mirror the `src/` directory structure. The project uses [Vitest](https://vitest.dev/).

```bash
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
```

Key testing patterns:

- Use `vi.mock()` for mocking modules.
- Use `vi.spyOn()` for spying on function calls.
- Each feature has its own test file under `tests/features/`.
- Test both the happy path and error/edge cases.
- Hook handlers must never throw — verify graceful degradation.

## Architecture Notes

- **Feature registry** dynamically loads features by hook type using lazy descriptors, keeping startup fast.
- **Priority ranges** control execution order: Security (0–99) runs before Quality (100–199), which runs before Tracking (200+) and Integration (800+).
- **Config deep merge**: user config merges over defaults. Arrays replace entirely rather than appending.
- **Dual-host support**: the toolkit works with both Claude Code CLI and VS Code Copilot hooks. The runtime includes an input normalizer (camelCase → snake_case) and output formatter (hookSpecificOutput JSON envelope) for VS Code compatibility.

For the full architecture guide, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
