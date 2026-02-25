import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadConfig, DEFAULT_CONFIG } from '../src/config.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-config-extends-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeConfig(dir: string, config: Record<string, unknown>): void {
  const configPath = path.join(dir, 'claude-hooks.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8');
}

describe('loadConfig with extends (preset)', () => {
  it('should inherit from "minimal" preset (essential guards only)', () => {
    writeConfig(tempDir, { extends: 'minimal' });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
    expect(config.guards.command.enabled).toBe(true);
    expect(config.guards.file.enabled).toBe(true);
    expect(config.guards.path.enabled).toBe(true);
    expect(config.guards.secretLeak.enabled).toBe(false);
    expect(config.guards.diffSize.enabled).toBe(false);
    expect(config.guards.branch.enabled).toBe(false);
  });

  it('should inherit from "security" preset and enable all security guards', () => {
    writeConfig(tempDir, { extends: 'security' });

    const config = loadConfig(tempDir);
    expect(config.guards.command.enabled).toBe(true);
    expect(config.guards.file.enabled).toBe(true);
    expect(config.guards.path.enabled).toBe(true);
    expect(config.guards.secretLeak.enabled).toBe(true);
    expect(config.guards.diffSize.enabled).toBe(false);
    expect(config.guards.branch.enabled).toBe(true);
  });

  it('should inherit from "quality" preset and enable validators', () => {
    writeConfig(tempDir, { extends: 'quality' });

    const config = loadConfig(tempDir);
    expect(config.guards.diffSize.enabled).toBe(true);
    expect(config.validators.lint.enabled).toBe(true);
    expect(config.validators.typecheck.enabled).toBe(true);
    expect(config.validators.test.enabled).toBe(true);
  });

  it('should inherit from "full" preset and enable everything', () => {
    writeConfig(tempDir, { extends: 'full' });

    const config = loadConfig(tempDir);
    expect(config.guards.diffSize.enabled).toBe(true);
    expect(config.guards.branch.enabled).toBe(true);
    expect(config.validators.lint.enabled).toBe(true);
    expect(config.validators.typecheck.enabled).toBe(true);
    expect(config.fileBackup.enabled).toBe(true);
    expect(config.costTracker.enabled).toBe(true);
    expect(config.changeSummary.enabled).toBe(true);
    expect(config.todoTracker.enabled).toBe(true);
    expect(config.errorPatternDetector.enabled).toBe(true);
    expect(config.contextInjector.enabled).toBe(true);
    expect(config.projectVisualizer.enabled).toBe(true);
  });

  it('should allow user overrides to take precedence over preset', () => {
    writeConfig(tempDir, {
      extends: 'full',
      fileBackup: { enabled: false },
      logDir: 'my-custom-logs',
    });

    const config = loadConfig(tempDir);
    // User override wins
    expect(config.fileBackup.enabled).toBe(false);
    expect(config.logDir).toBe('my-custom-logs');
    // Preset values still present for non-overridden fields
    expect(config.guards.diffSize.enabled).toBe(true);
    expect(config.validators.lint.enabled).toBe(true);
  });

  it('should remove "extends" from the final config object', () => {
    writeConfig(tempDir, { extends: 'security' });

    const config = loadConfig(tempDir);
    expect((config as unknown as Record<string, unknown>).extends).toBeUndefined();
  });

  it('should warn and ignore an invalid preset name', () => {
    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      writeConfig(tempDir, { extends: 'nonexistent-preset' });
      const config = loadConfig(tempDir);
      // Should fall back to defaults (no extended base)
      expect(config.logDir).toBe(DEFAULT_CONFIG.logDir);
      // Should have a warning about the missing file
      const output = stderrChunks.join('');
      expect(output).toContain('not found');
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('should not produce unknown-key warning for "extends"', () => {
    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      writeConfig(tempDir, { extends: 'minimal' });
      loadConfig(tempDir);
      const output = stderrChunks.join('');
      expect(output).not.toContain('Unknown top-level key "extends"');
    } finally {
      process.stderr.write = originalWrite;
    }
  });
});

describe('loadConfig with extends (file path)', () => {
  it('should inherit from a referenced config file', () => {
    const baseConfigPath = path.join(tempDir, 'base.json');
    fs.writeFileSync(baseConfigPath, JSON.stringify({
      logDir: 'base-logs',
      guards: {
        diffSize: { enabled: true, maxLines: 200 },
      },
    }), 'utf-8');

    writeConfig(tempDir, {
      extends: './base.json',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('base-logs');
    expect(config.guards.diffSize.enabled).toBe(true);
    expect(config.guards.diffSize.maxLines).toBe(200);
    // Defaults still present
    expect(config.guards.command.enabled).toBe(true);
  });

  it('should let user config override file-based extends', () => {
    const baseConfigPath = path.join(tempDir, 'base.json');
    fs.writeFileSync(baseConfigPath, JSON.stringify({
      logDir: 'base-logs',
      guards: { diffSize: { enabled: true } },
    }), 'utf-8');

    writeConfig(tempDir, {
      extends: './base.json',
      logDir: 'user-logs',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('user-logs');
    expect(config.guards.diffSize.enabled).toBe(true);
  });

  it('should handle chained extends (file → file)', () => {
    const grandparentPath = path.join(tempDir, 'grandparent.json');
    fs.writeFileSync(grandparentPath, JSON.stringify({
      logDir: 'grandparent-logs',
      guards: { diffSize: { maxLines: 100 } },
    }), 'utf-8');

    const parentPath = path.join(tempDir, 'parent.json');
    fs.writeFileSync(parentPath, JSON.stringify({
      extends: './grandparent.json',
      guards: { branch: { enabled: true } },
    }), 'utf-8');

    writeConfig(tempDir, {
      extends: './parent.json',
      logDir: 'child-logs',
    });

    const config = loadConfig(tempDir);
    // User override
    expect(config.logDir).toBe('child-logs');
    // From parent
    expect(config.guards.branch.enabled).toBe(true);
    // From grandparent
    expect(config.guards.diffSize.maxLines).toBe(100);
  });

  it('should handle chained extends (file → preset)', () => {
    const parentPath = path.join(tempDir, 'parent.json');
    fs.writeFileSync(parentPath, JSON.stringify({
      extends: 'security',
      logDir: 'parent-logs',
    }), 'utf-8');

    writeConfig(tempDir, {
      extends: './parent.json',
      logDir: 'child-logs',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('child-logs');
    // From security preset via parent
    expect(config.guards.diffSize.enabled).toBe(false);
    expect(config.guards.branch.enabled).toBe(true);
  });

  it('should handle circular extends gracefully', () => {
    const aPath = path.join(tempDir, 'a.json');
    const bPath = path.join(tempDir, 'b.json');

    fs.writeFileSync(aPath, JSON.stringify({
      extends: './b.json',
      logDir: 'a-logs',
    }), 'utf-8');
    fs.writeFileSync(bPath, JSON.stringify({
      extends: './a.json',
      logDir: 'b-logs',
    }), 'utf-8');

    writeConfig(tempDir, { extends: './a.json' });

    // Should not throw or infinite loop
    const config = loadConfig(tempDir);
    expect(config).toBeDefined();
    // a.json's logDir is applied (circular back-reference to a is skipped, not a itself)
    expect(config.logDir).toBe('a-logs');
  });

  it('should handle self-referencing extends gracefully', () => {
    writeConfig(tempDir, {
      extends: './claude-hooks.config.json',
      logDir: 'self-ref-logs',
    });

    const config = loadConfig(tempDir);
    // The self-reference is in the seen set from the start, so it's skipped
    expect(config.logDir).toBe('self-ref-logs');
  });

  it('should handle missing extends file gracefully', () => {
    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      writeConfig(tempDir, {
        extends: './does-not-exist.json',
        logDir: 'user-logs',
      });

      const config = loadConfig(tempDir);
      // Should still load user config
      expect(config.logDir).toBe('user-logs');
      // Should warn about missing file
      const output = stderrChunks.join('');
      expect(output).toContain('not found');
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('should handle invalid JSON in extends file gracefully', () => {
    const basePath = path.join(tempDir, 'base.json');
    fs.writeFileSync(basePath, 'not valid json!!!', 'utf-8');

    writeConfig(tempDir, {
      extends: './base.json',
      logDir: 'user-logs',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('user-logs');
  });

  it('should handle non-object extends file gracefully', () => {
    const basePath = path.join(tempDir, 'base.json');
    fs.writeFileSync(basePath, '"just a string"', 'utf-8');

    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      writeConfig(tempDir, {
        extends: './base.json',
        logDir: 'user-logs',
      });

      const config = loadConfig(tempDir);
      expect(config.logDir).toBe('user-logs');
      const output = stderrChunks.join('');
      expect(output).toContain('not a JSON object');
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('should resolve relative paths from the config file directory', () => {
    // Create a subdirectory with a base config
    const subDir = path.join(tempDir, 'configs');
    fs.mkdirSync(subDir, { recursive: true });
    const basePath = path.join(subDir, 'base.json');
    fs.writeFileSync(basePath, JSON.stringify({
      logDir: 'base-logs',
    }), 'utf-8');

    // Main config references the base via relative path
    writeConfig(tempDir, {
      extends: './configs/base.json',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('base-logs');
  });
});

describe('loadConfig with extends (edge cases)', () => {
  it('should handle extends with non-string value gracefully', () => {
    writeConfig(tempDir, {
      extends: 42,
      logDir: 'user-logs',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('user-logs');
  });

  it('should handle extends with null value gracefully', () => {
    writeConfig(tempDir, {
      extends: null,
      logDir: 'user-logs',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('user-logs');
  });

  it('should handle extends with empty string gracefully', () => {
    writeConfig(tempDir, {
      extends: '',
      logDir: 'user-logs',
    });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('user-logs');
  });

  it('should preserve default array values when preset does not override them', () => {
    writeConfig(tempDir, { extends: 'security' });

    const config = loadConfig(tempDir);
    // blockedPatterns should still be the defaults since security preset
    // only sets enabled flags, not pattern arrays
    expect(config.guards.command.blockedPatterns.length).toBeGreaterThan(0);
    expect(config.guards.command.blockedPatterns).toEqual(DEFAULT_CONFIG.guards.command.blockedPatterns);
  });

  it('should work with no extends field (backward compatibility)', () => {
    writeConfig(tempDir, { logDir: 'custom-logs' });

    const config = loadConfig(tempDir);
    expect(config.logDir).toBe('custom-logs');
    expect(config.guards.command.enabled).toBe(true);
  });
});
