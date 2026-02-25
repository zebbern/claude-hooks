import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config.js';
import { matchesPattern, resolvePermission } from '../../src/features/permission-handler/handler.js';
import type { ToolkitConfig } from '../../src/types.js';

function configWithPermissions(autoAllow: string[], autoDeny: string[], autoAsk: string[] = []): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    permissions: { autoAllow, autoDeny, autoAsk },
  };
}

describe('matchesPattern', () => {
  it('matches exact tool name', () => {
    expect(matchesPattern('Read', ['Read'])).toBe(true);
  });

  it('does not match different tool name', () => {
    expect(matchesPattern('Write', ['Read'])).toBe(false);
  });

  it('matches case-insensitively via regex', () => {
    expect(matchesPattern('read', ['Read'])).toBe(true);
  });

  it('matches regex pattern', () => {
    expect(matchesPattern('ReadFile', ['Read.*'])).toBe(true);
  });

  it('does not partially match — anchored with ^ and $', () => {
    expect(matchesPattern('ReadFile', ['Read'])).toBe(false);
  });

  it('matches against multiple patterns', () => {
    expect(matchesPattern('Grep', ['Read', 'Glob', 'Grep'])).toBe(true);
  });

  it('returns false for empty patterns list', () => {
    expect(matchesPattern('AnyTool', [])).toBe(false);
  });

  it('handles invalid regex gracefully', () => {
    expect(matchesPattern('test', ['[invalid'])).toBe(false);
  });

  it('exact match takes priority over regex failure', () => {
    expect(matchesPattern('[invalid', ['[invalid'])).toBe(true);
  });

  it('matches wildcard pattern for all tools', () => {
    expect(matchesPattern('AnyTool', ['.*'])).toBe(true);
  });
});

describe('permission-request deny-before-allow logic', () => {
  describe('default config behavior', () => {
    it('auto-allows Read tool', () => {
      expect(resolvePermission('Read', DEFAULT_CONFIG)).toBe('allow');
    });

    it('auto-allows Glob tool', () => {
      expect(resolvePermission('Glob', DEFAULT_CONFIG)).toBe('allow');
    });

    it('auto-allows Grep tool', () => {
      expect(resolvePermission('Grep', DEFAULT_CONFIG)).toBe('allow');
    });

    it('returns ask-user for Bash (not in any list)', () => {
      expect(resolvePermission('Bash', DEFAULT_CONFIG)).toBe('ask-user');
    });

    it('returns ask-user for Write (not in any list)', () => {
      expect(resolvePermission('Write', DEFAULT_CONFIG)).toBe('ask-user');
    });

    it('returns ask-user for unknown tool', () => {
      expect(resolvePermission('UnknownTool', DEFAULT_CONFIG)).toBe('ask-user');
    });
  });

  describe('deny-before-allow ordering', () => {
    it('deny takes precedence when tool is in both lists', () => {
      const config = configWithPermissions(['Read'], ['Read']);
      expect(resolvePermission('Read', config)).toBe('deny');
    });

    it('deny takes precedence with regex patterns in both lists', () => {
      const config = configWithPermissions(['Read.*'], ['Read.*']);
      expect(resolvePermission('ReadFile', config)).toBe('deny');
    });

    it('denies tool in autoDeny even if broader pattern allows it', () => {
      const config = configWithPermissions(['.*'], ['DangerousTool']);
      expect(resolvePermission('DangerousTool', config)).toBe('deny');
    });
  });

  describe('ask decision ordering', () => {
    it('returns ask when tool is in autoAsk', () => {
      const config = configWithPermissions([], [], ['Write']);
      expect(resolvePermission('Write', config)).toBe('ask');
    });

    it('deny takes precedence over ask', () => {
      const config = configWithPermissions([], ['Write'], ['Write']);
      expect(resolvePermission('Write', config)).toBe('deny');
    });

    it('ask takes precedence over allow', () => {
      const config = configWithPermissions(['Write'], [], ['Write']);
      expect(resolvePermission('Write', config)).toBe('ask');
    });

    it('supports regex in autoAsk', () => {
      const config = configWithPermissions([], [], ['.*Write.*']);
      expect(resolvePermission('FileWrite', config)).toBe('ask');
    });

    it('deny > ask > allow > ask-user ordering', () => {
      const config = configWithPermissions(['Safe.*'], ['Evil.*'], ['Risky.*']);
      expect(resolvePermission('EvilCmd', config)).toBe('deny');
      expect(resolvePermission('RiskyOp', config)).toBe('ask');
      expect(resolvePermission('SafeRead', config)).toBe('allow');
      expect(resolvePermission('Unknown', config)).toBe('ask-user');
    });
  });

  describe('custom config', () => {
    it('denies when tool is in autoDeny', () => {
      const config = configWithPermissions([], ['DangerousTool']);
      expect(resolvePermission('DangerousTool', config)).toBe('deny');
    });

    it('allows when tool is in autoAllow', () => {
      const config = configWithPermissions(['CustomTool'], []);
      expect(resolvePermission('CustomTool', config)).toBe('allow');
    });

    it('returns ask-user when both lists are empty', () => {
      const config = configWithPermissions([], []);
      expect(resolvePermission('AnyTool', config)).toBe('ask-user');
    });

    it('supports regex in autoDeny', () => {
      const config = configWithPermissions([], ['.*Dangerous.*']);
      expect(resolvePermission('VeryDangerousTool', config)).toBe('deny');
    });

    it('supports regex in autoAllow', () => {
      const config = configWithPermissions(['Read.*'], []);
      expect(resolvePermission('ReadFile', config)).toBe('allow');
    });
  });
});
