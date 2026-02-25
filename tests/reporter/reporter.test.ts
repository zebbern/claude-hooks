import { describe, it, expect } from 'vitest';
import { createReporter } from '../../src/reporter/index.js';
import { formatJson } from '../../src/reporter/json.js';
import { ALL_HOOK_EVENT_TYPES } from '../../src/types.js';
import { builtInFeatures } from '../../src/features/index.js';
import type { ClaudeSettings } from '../../src/types.js';

const registryGuards = builtInFeatures
  .filter((f) => f.meta.name.includes('-guard'))
  .map((f) => f.meta.name);

const registryValidators = builtInFeatures
  .filter((f) => f.meta.name.includes('-validator'))
  .map((f) => f.meta.name);

describe('reporter', () => {
  describe('createReporter', () => {
    it('creates terminal reporter', () => {
      const reporter = createReporter('terminal');
      expect(reporter).toBeDefined();
      expect(typeof reporter.formatHookList).toBe('function');
      expect(typeof reporter.formatPresetList).toBe('function');
      expect(typeof reporter.formatGuardList).toBe('function');
      expect(typeof reporter.formatValidatorList).toBe('function');
      expect(typeof reporter.formatSettings).toBe('function');
      expect(typeof reporter.formatTestResult).toBe('function');
      expect(typeof reporter.formatInitSuccess).toBe('function');
      expect(typeof reporter.formatJson).toBe('function');
    });

    it('creates json reporter', () => {
      const reporter = createReporter('json');
      expect(reporter).toBeDefined();
      expect(typeof reporter.formatHookList).toBe('function');
    });
  });

  describe('formatJson', () => {
    it('produces valid JSON', () => {
      const data = { key: 'value', nested: { num: 42 } };
      const result = formatJson(data);
      expect(JSON.parse(result)).toEqual(data);
    });

    it('formats with 2-space indentation', () => {
      const data = { a: 1 };
      const result = formatJson(data);
      expect(result).toBe('{\n  "a": 1\n}');
    });

    it('handles arrays', () => {
      const data = [1, 2, 3];
      const result = formatJson(data);
      expect(JSON.parse(result)).toEqual([1, 2, 3]);
    });

    it('handles null', () => {
      const result = formatJson(null);
      expect(result).toBe('null');
    });
  });

  describe('terminal reporter', () => {
    const reporter = createReporter('terminal');

    it('formatHookList includes all hook types', () => {
      const result = reporter.formatHookList(ALL_HOOK_EVENT_TYPES);
      for (const hookType of ALL_HOOK_EVENT_TYPES) {
        expect(result).toContain(hookType);
      }
    });

    it('formatPresetList includes all presets', () => {
      const result = reporter.formatPresetList();
      expect(result).toContain('minimal');
      expect(result).toContain('security');
      expect(result).toContain('quality');
      expect(result).toContain('full');
    });

    it('formatGuardList includes all guards from registry', () => {
      const result = reporter.formatGuardList();
      for (const guardName of registryGuards) {
        expect(result).toContain(guardName);
      }
    });

    it('formatValidatorList includes all validators from registry', () => {
      const result = reporter.formatValidatorList();
      for (const validatorName of registryValidators) {
        expect(result).toContain(validatorName);
      }
    });

    it('formatSettings displays hook info', () => {
      const settings: ClaudeSettings = {
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node hook.js' }] }],
        },
      };
      const result = reporter.formatSettings(settings);
      expect(result).toContain('PreToolUse');
      expect(result).toContain('Bash');
    });

    it('formatTestResult shows PASS for exit code 0', () => {
      const result = reporter.formatTestResult('PreToolUse', 0, 'output', '');
      expect(result).toContain('PASS');
      expect(result).toContain('PreToolUse');
    });

    it('formatTestResult shows BLOCKED for exit code 2', () => {
      const result = reporter.formatTestResult('PreToolUse', 2, '', 'Blocked');
      expect(result).toContain('BLOCKED');
    });

    it('formatInitSuccess shows success message', () => {
      const result = reporter.formatInitSuccess('/project', 'security');
      expect(result).toContain('success');
      expect(result).toContain('security');
    });
  });

  describe('json reporter', () => {
    const reporter = createReporter('json');

    it('formatHookList returns valid JSON', () => {
      const result = reporter.formatHookList(ALL_HOOK_EVENT_TYPES);
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(13);
    });

    it('formatPresetList returns valid JSON with presets', () => {
      const result = reporter.formatPresetList();
      const parsed = JSON.parse(result);
      expect(parsed).toContain('minimal');
      expect(parsed).toContain('full');
    });

    it('formatGuardList returns all guards from registry as JSON', () => {
      const result = reporter.formatGuardList();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(registryGuards);
    });

    it('formatValidatorList returns all validators from registry as JSON', () => {
      const result = reporter.formatValidatorList();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(registryValidators);
    });

    it('formatTestResult returns JSON with exitCode', () => {
      const result = reporter.formatTestResult('PreToolUse', 0, 'stdout', 'stderr');
      const parsed = JSON.parse(result);
      expect(parsed.exitCode).toBe(0);
      expect(parsed.stdout).toBe('stdout');
    });

    it('formatInitSuccess returns JSON with success flag', () => {
      const result = reporter.formatInitSuccess('/project', 'minimal');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.preset).toBe('minimal');
    });
  });
});
