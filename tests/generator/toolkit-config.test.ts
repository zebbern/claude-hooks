import { describe, it, expect } from 'vitest';
import { generateToolkitConfig } from '../../src/generator/settings-generator.js';
import type { PresetName } from '../../src/types.js';

describe('generateToolkitConfig', () => {
  describe('minimal preset', () => {
    it('enables only essential guards (command, file, path)', () => {
      const config = generateToolkitConfig('minimal');
      expect(config.guards.command.enabled).toBe(true);
      expect(config.guards.file.enabled).toBe(true);
      expect(config.guards.path.enabled).toBe(true);
    });

    it('disables non-essential guards', () => {
      const config = generateToolkitConfig('minimal');
      expect(config.guards.branch.enabled).toBe(false);
      expect(config.guards.secretLeak.enabled).toBe(false);
      expect(config.guards.diffSize.enabled).toBe(false);
      expect(config.guards.scope.enabled).toBe(false);
    });

    it('disables all validators', () => {
      const config = generateToolkitConfig('minimal');
      expect(config.validators.lint.enabled).toBe(false);
      expect(config.validators.typecheck.enabled).toBe(false);
    });
  });

  describe('security preset', () => {
    it('enables all security guards', () => {
      const config = generateToolkitConfig('security');
      expect(config.guards.command.enabled).toBe(true);
      expect(config.guards.file.enabled).toBe(true);
      expect(config.guards.path.enabled).toBe(true);
      expect(config.guards.branch.enabled).toBe(true);
      expect(config.guards.secretLeak.enabled).toBe(true);
    });

    it('disables validators', () => {
      const config = generateToolkitConfig('security');
      expect(config.validators.lint.enabled).toBe(false);
      expect(config.validators.typecheck.enabled).toBe(false);
    });
  });

  describe('quality preset', () => {
    it('enables all security guards plus diff-size', () => {
      const config = generateToolkitConfig('quality');
      expect(config.guards.command.enabled).toBe(true);
      expect(config.guards.file.enabled).toBe(true);
      expect(config.guards.path.enabled).toBe(true);
      expect(config.guards.branch.enabled).toBe(true);
      expect(config.guards.secretLeak.enabled).toBe(true);
      expect(config.guards.diffSize.enabled).toBe(true);
    });

    it('enables quality validators (lint, typecheck, test)', () => {
      const config = generateToolkitConfig('quality');
      expect(config.validators.lint.enabled).toBe(true);
      expect(config.validators.typecheck.enabled).toBe(true);
      expect(config.validators.test.enabled).toBe(true);
      expect(config.errorPatternDetector.enabled).toBe(true);
    });

    it('disables tracking and integration features', () => {
      const config = generateToolkitConfig('quality');
      expect(config.costTracker.enabled).toBe(false);
      expect(config.webhooks.enabled).toBe(false);
      expect(config.changeSummary.enabled).toBe(false);
      expect(config.todoTracker.enabled).toBe(false);
      expect(config.fileBackup.enabled).toBe(false);
    });
  });

  describe('full preset', () => {
    it('enables everything', () => {
      const config = generateToolkitConfig('full');
      expect(config.guards.command.enabled).toBe(true);
      expect(config.guards.file.enabled).toBe(true);
      expect(config.guards.path.enabled).toBe(true);
      expect(config.validators.lint.enabled).toBe(true);
      expect(config.validators.typecheck.enabled).toBe(true);
    });
  });

  describe('preset differentiation', () => {
    it('each preset returns a distinct config', () => {
      const minimal = generateToolkitConfig('minimal');
      const security = generateToolkitConfig('security');
      const quality = generateToolkitConfig('quality');
      const full = generateToolkitConfig('full');

      // minimal vs security: branch/secretLeak differ
      expect(minimal.guards.branch.enabled).not.toBe(security.guards.branch.enabled);
      expect(minimal.guards.secretLeak.enabled).not.toBe(security.guards.secretLeak.enabled);
      // security vs quality: lint/typecheck/test differ
      expect(quality.validators.lint.enabled).not.toBe(security.validators.lint.enabled);
      expect(quality.validators.typecheck.enabled).not.toBe(security.validators.typecheck.enabled);
      // quality vs full: tracking/integration features differ
      expect(full.costTracker.enabled).not.toBe(quality.costTracker.enabled);
      expect(full.webhooks.enabled).not.toBe(quality.webhooks.enabled);
    });

    it('minimal is strictly less than security', () => {
      const minimal = generateToolkitConfig('minimal');
      const security = generateToolkitConfig('security');
      // Both have essential guards enabled
      expect(minimal.guards.command.enabled).toBe(true);
      expect(security.guards.command.enabled).toBe(true);
      // Security adds branch and secretLeak
      expect(minimal.guards.branch.enabled).toBe(false);
      expect(security.guards.branch.enabled).toBe(true);
      expect(minimal.guards.secretLeak.enabled).toBe(false);
      expect(security.guards.secretLeak.enabled).toBe(true);
      // Both have validators disabled
      expect(minimal.validators.lint.enabled).toBe(security.validators.lint.enabled);
    });

    it('quality is a superset of security', () => {
      const security = generateToolkitConfig('security');
      const quality = generateToolkitConfig('quality');
      // Quality has all security guards
      expect(quality.guards.command.enabled).toBe(true);
      expect(quality.guards.branch.enabled).toBe(true);
      expect(quality.guards.secretLeak.enabled).toBe(true);
      // Quality adds validators
      expect(security.validators.lint.enabled).toBe(false);
      expect(quality.validators.lint.enabled).toBe(true);
      expect(quality.validators.typecheck.enabled).toBe(true);
      expect(quality.validators.test.enabled).toBe(true);
    });

    it('full enables all tracking and integration features', () => {
      const quality = generateToolkitConfig('quality');
      const full = generateToolkitConfig('full');
      // Full adds tracking
      expect(quality.costTracker.enabled).toBe(false);
      expect(full.costTracker.enabled).toBe(true);
      expect(quality.fileBackup.enabled).toBe(false);
      expect(full.fileBackup.enabled).toBe(true);
      expect(quality.webhooks.enabled).toBe(false);
      expect(full.webhooks.enabled).toBe(true);
      expect(quality.changeSummary.enabled).toBe(false);
      expect(full.changeSummary.enabled).toBe(true);
      expect(quality.todoTracker.enabled).toBe(false);
      expect(full.todoTracker.enabled).toBe(true);
    });
  });

  describe('preserves defaults', () => {
    it('preserves default blocked patterns', () => {
      const config = generateToolkitConfig('security');
      expect(config.guards.command.blockedPatterns.length).toBeGreaterThan(0);
      expect(config.guards.command.blockedPatterns).toContain('mkfs');
    });

    it('preserves default file protected patterns', () => {
      const config = generateToolkitConfig('security');
      expect(config.guards.file.protectedPatterns).toContain('.env');
      expect(config.guards.file.protectedPatterns).toContain('*.pem');
    });

    it('preserves default permissions', () => {
      const config = generateToolkitConfig('full');
      expect(config.permissions.autoAllow).toContain('Read');
      expect(config.permissions.autoAllow).toContain('Glob');
      expect(config.permissions.autoAllow).toContain('Grep');
    });

    it('preserves logDir', () => {
      const config = generateToolkitConfig('minimal');
      expect(config.logDir).toBeDefined();
      expect(config.logDir.length).toBeGreaterThan(0);
    });

    it('preserves promptHistory setting', () => {
      const config = generateToolkitConfig('full');
      expect(config.promptHistory).toBeDefined();
      expect(config.promptHistory.enabled).toBe(true);
    });
  });

  describe('returns independent copies', () => {
    it('modifying one preset config does not affect another', () => {
      const config1 = generateToolkitConfig('security');
      const config2 = generateToolkitConfig('security');
      config1.guards.command.blockedPatterns.push('custom-pattern');
      expect(config2.guards.command.blockedPatterns).not.toContain('custom-pattern');
    });

    it('all presets produce valid ToolkitConfig', () => {
      const presets: PresetName[] = ['minimal', 'security', 'quality', 'full'];
      for (const preset of presets) {
        const config = generateToolkitConfig(preset);
        expect(config.logDir).toBeDefined();
        expect(config.guards).toBeDefined();
        expect(config.validators).toBeDefined();
        expect(config.permissions).toBeDefined();
        expect(config.promptHistory).toBeDefined();
      }
    });
  });
});
