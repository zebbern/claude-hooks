import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = path.resolve(__dirname, '../../src/hooks');

const EXPECTED_HOOKS: ReadonlyArray<{ file: string; hookType: string }> = [
  { file: 'notification', hookType: 'Notification' },
  { file: 'permission-request', hookType: 'PermissionRequest' },
  { file: 'post-tool-use-failure', hookType: 'PostToolUseFailure' },
  { file: 'post-tool-use', hookType: 'PostToolUse' },
  { file: 'pre-compact', hookType: 'PreCompact' },
  { file: 'pre-tool-use', hookType: 'PreToolUse' },
  { file: 'session-end', hookType: 'SessionEnd' },
  { file: 'session-start', hookType: 'SessionStart' },
  { file: 'setup', hookType: 'Setup' },
  { file: 'stop', hookType: 'Stop' },
  { file: 'subagent-start', hookType: 'SubagentStart' },
  { file: 'subagent-stop', hookType: 'SubagentStop' },
  { file: 'user-prompt-submit', hookType: 'UserPromptSubmit' },
];

describe('hook entry points', () => {
  for (const { file, hookType } of EXPECTED_HOOKS) {
    describe(`${file}.ts`, () => {
      const filePath = path.join(HOOKS_DIR, `${file}.ts`);

      it('exists as a file', () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it('imports runHook from run-hook', () => {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain("import { runHook }");
        expect(content).toContain("from './run-hook.js'");
      });

      it(`calls runHook with '${hookType}'`, () => {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain(`await runHook('${hookType}')`);
      });
    });
  }

  it('run-hook.ts dispatcher exists', () => {
    const filePath = path.join(HOOKS_DIR, 'run-hook.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('all 13 hook entry points are accounted for', () => {
    const hookFiles = fs.readdirSync(HOOKS_DIR)
      .filter(f => f.endsWith('.ts') && f !== 'run-hook.ts');
    expect(hookFiles).toHaveLength(EXPECTED_HOOKS.length);
  });
});
