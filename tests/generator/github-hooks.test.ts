import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { hookEventToFilename } from '../../src/generator/hook-resolver.js';
import {
  generateGithubHooksFiles,
  writeGithubHookFile,
  writeAllGithubHookFiles,
} from '../../src/generator/settings-generator.js';
import { ALL_HOOK_EVENT_TYPES } from '../../src/types.js';
import type { HookCommandEntry, PresetName } from '../../src/types.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-github-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('hookEventToFilename', () => {
  const expectedMappings: Record<string, string> = {
    PreToolUse: 'pre-tool-use',
    PostToolUse: 'post-tool-use',
    PostToolUseFailure: 'post-tool-use-failure',
    UserPromptSubmit: 'user-prompt-submit',
    Notification: 'notification',
    Stop: 'stop',
    SubagentStart: 'subagent-start',
    SubagentStop: 'subagent-stop',
    PreCompact: 'pre-compact',
    Setup: 'setup',
    SessionStart: 'session-start',
    SessionEnd: 'session-end',
    PermissionRequest: 'permission-request',
  };

  it('maps all 13 hook event types', () => {
    expect(ALL_HOOK_EVENT_TYPES).toHaveLength(13);
    for (const hookType of ALL_HOOK_EVENT_TYPES) {
      const filename = hookEventToFilename(hookType);
      expect(filename).toBeDefined();
      expect(typeof filename).toBe('string');
      expect(filename.length).toBeGreaterThan(0);
    }
  });

  for (const [hookType, expected] of Object.entries(expectedMappings)) {
    it(`maps ${hookType} to "${expected}"`, () => {
      const result = hookEventToFilename(hookType as typeof ALL_HOOK_EVENT_TYPES[number]);
      expect(result).toBe(expected);
    });
  }

  it('returns kebab-case strings (lowercase with hyphens)', () => {
    for (const hookType of ALL_HOOK_EVENT_TYPES) {
      const filename = hookEventToFilename(hookType);
      expect(filename).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});

describe('generateGithubHooksFiles', () => {
  const presets: PresetName[] = ['minimal', 'security', 'quality', 'full'];

  for (const preset of presets) {
    it(`generates files for all 13 hook types with ${preset} preset`, () => {
      const files = generateGithubHooksFiles(preset, tempDir);
      expect(files.size).toBe(13);

      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        const filename = hookEventToFilename(hookType);
        expect(files.has(filename)).toBe(true);
      }
    });
  }

  it('returns Map with string keys and HookCommandEntry[] values', () => {
    const files = generateGithubHooksFiles('minimal', tempDir);

    for (const [key, entries] of files) {
      expect(typeof key).toBe('string');
      expect(Array.isArray(entries)).toBe(true);
      for (const entry of entries) {
        expect(entry.type).toBe('command');
        expect(typeof entry.command).toBe('string');
      }
    }
  });

  it('each entry has type, command, and windows fields', () => {
    const files = generateGithubHooksFiles('security', tempDir);

    for (const [, entries] of files) {
      for (const entry of entries) {
        expect(entry.type).toBe('command');
        expect(entry.command).toMatch(/^node .+\.js$/);
        expect(entry.windows).toBeDefined();
        expect(entry.windows).toMatch(/^node .+\.js$/);
      }
    }
  });

  it('deduplicates hook commands from multiple matcher entries', () => {
    // Security preset has multiple PreToolUse matchers (Bash, Write, Edit, MultiEdit)
    // but they all reference the same hook script, so deduplication should result in 1 entry
    const files = generateGithubHooksFiles('security', tempDir);
    const preToolUse = files.get('pre-tool-use');
    expect(preToolUse).toBeDefined();
    expect(preToolUse!.length).toBe(1);
  });

  it('command uses forward slashes, windows uses backslashes', () => {
    const files = generateGithubHooksFiles('minimal', tempDir);
    const entry = files.get('pre-tool-use')![0]!;

    const commandPath = entry.command.replace(/^node /, '');
    expect(commandPath).not.toContain('\\');

    expect(entry.windows).toContain('\\');
  });

  it('minimal preset produces one entry per hook type', () => {
    const files = generateGithubHooksFiles('minimal', tempDir);

    for (const [, entries] of files) {
      expect(entries.length).toBe(1);
    }
  });
});

describe('writeGithubHookFile', () => {
  it('creates directory and writes JSON file', () => {
    const entries: HookCommandEntry[] = [
      { type: 'command', command: 'node dist/hooks/pre-tool-use.js', windows: 'node dist\\hooks\\pre-tool-use.js' },
    ];
    const filePath = path.join(tempDir, '.github', 'hooks', 'pre-tool-use.json');

    writeGithubHookFile(entries, filePath);

    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('command');
  });

  it('writes formatted JSON with trailing newline', () => {
    const entries: HookCommandEntry[] = [
      { type: 'command', command: 'node dist/hooks/stop.js' },
    ];
    const filePath = path.join(tempDir, 'stop.json');

    writeGithubHookFile(entries, filePath);

    const raw = fs.readFileSync(filePath, 'utf-8');
    expect(raw).toContain('\n');
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('overwrites existing file', () => {
    const filePath = path.join(tempDir, 'test.json');
    fs.writeFileSync(filePath, '{"old": true}', 'utf-8');

    writeGithubHookFile([{ type: 'command', command: 'new' }], filePath);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content[0].command).toBe('new');
  });
});

describe('writeAllGithubHookFiles', () => {
  it('writes all files from the map', () => {
    const files = generateGithubHooksFiles('minimal', tempDir);
    const hooksDir = path.join(tempDir, '.github', 'hooks');

    writeAllGithubHookFiles(files, hooksDir);

    for (const name of files.keys()) {
      const filePath = path.join(hooksDir, `${name}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(Array.isArray(content)).toBe(true);
    }
  });

  it('writes 13 files for minimal preset', () => {
    const files = generateGithubHooksFiles('minimal', tempDir);
    const hooksDir = path.join(tempDir, '.github', 'hooks');

    writeAllGithubHookFiles(files, hooksDir);

    const writtenFiles = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.json'));
    expect(writtenFiles).toHaveLength(13);
  });

  it('written files contain valid JSON arrays', () => {
    const files = generateGithubHooksFiles('security', tempDir);
    const hooksDir = path.join(tempDir, '.github', 'hooks');

    writeAllGithubHookFiles(files, hooksDir);

    for (const name of files.keys()) {
      const filePath = path.join(hooksDir, `${name}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(Array.isArray(content)).toBe(true);
      for (const entry of content) {
        expect(entry.type).toBe('command');
        expect(typeof entry.command).toBe('string');
      }
    }
  });

  it('creates nested directory structure', () => {
    const files = new Map<string, HookCommandEntry[]>();
    files.set('test-hook', [{ type: 'command', command: 'echo test' }]);

    const hooksDir = path.join(tempDir, 'deep', 'nested', '.github', 'hooks');
    writeAllGithubHookFiles(files, hooksDir);

    expect(fs.existsSync(path.join(hooksDir, 'test-hook.json'))).toBe(true);
  });
});
