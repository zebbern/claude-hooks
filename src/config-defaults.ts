import type { ToolkitConfig } from './types.js';

/**
 * Default configuration for the Claude Hooks Toolkit.
 *
 * All settings have sensible defaults. When a user provides a `claude-hooks.config.json`,
 * it is deep-merged on top of this object. Arrays in the user config **replace** the
 * defaults rather than being appended.
 */
export const DEFAULT_CONFIG: ToolkitConfig = {
  logDir: 'logs/claude-hooks',
  transcriptBackupDir: 'logs/claude-hooks/transcript-backups',
  guards: {
    command: {
      blockedPatterns: [
        'rm\\s+.*-[a-z]*r[a-z]*f',
        'rm\\s+-rf\\s+/',
        'rm\\s+-rf\\s+~',
        'rm\\s+-rf\\s+\\.',
        'chmod\\s+777',
        'mkfs',
        'dd\\s+if=',
        '>\\s*/dev/sda',
        'shutdown',
        'reboot',
        ':\\(\\)\\{\\s*:\\|:\\s*&\\s*\\};:',
        'eval\\s+',
        '\\|\\s*(ba)?sh',
        '\\|\\s*source',
        'base64.*\\|',
      ],
      allowedPatterns: [],
      enabled: true,
    },
    file: {
      protectedPatterns: ['.env', '*.pem', '*.key', 'id_rsa*', '*.secret*'],
      enabled: true,
    },
    path: {
      allowedRoots: [],
      enabled: true,
    },
    diffSize: {
      maxLines: 500,
      enabled: false,
    },
    branch: {
      protectedBranches: ['main', 'master', 'production', 'release/*'],
      enabled: false,
    },
    secretLeak: {
      customPatterns: [],
      allowedPatterns: [],
      enabled: true,
    },
    scope: {
      allowedPaths: [],
      enabled: false,
    },
  },
  validators: {
    lint: { command: 'npx eslint --no-warn-ignored', enabled: false },
    typecheck: { command: 'npx tsc --noEmit', enabled: false },
    test: { command: '', timeout: 60000, enabled: false },
  },
  permissions: {
    autoAllow: ['Read', 'Glob', 'Grep'],
    autoDeny: [],
    autoAsk: [],
  },
  promptHistory: {
    enabled: true,
  },
  fileBackup: {
    backupDir: 'logs/claude-hooks/file-backups',
    enabled: false,
  },
  costTracker: {
    outputPath: 'logs/claude-hooks/cost-reports',
    enabled: false,
  },
  webhooks: {
    url: '',
    events: ['Stop', 'Notification'],
    enabled: false,
    includeFullInput: false,
  },
  changeSummary: {
    outputPath: 'logs/claude-hooks/change-summaries',
    enabled: false,
  },
  rateLimiter: {
    maxToolCallsPerSession: 0,
    maxFileEditsPerSession: 0,
    enabled: false,
  },
  todoTracker: {
    outputPath: 'logs/claude-hooks/todo-reports',
    patterns: ['TODO', 'FIXME', 'HACK', 'XXX'],
    enabled: false,
  },
  errorPatternDetector: {
    maxRepeats: 3,
    enabled: false,
  },
  contextInjector: {
    contextFiles: ['.claude/context.md'],
    enabled: false,
  },
  autoCommit: {
    messageTemplate: '',
    enabled: false,
  },
  projectVisualizer: {
    outputPath: 'logs/claude-hooks/project-viz',
    maxDepth: 2,
    enabled: false,
  },
  defaultTimeout: 30,
};
