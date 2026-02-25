// Public API barrel exports
export type {
  HookEventType,
  HookInputBase,
  PreToolUseInput,
  PostToolUseInput,
  PostToolUseFailureInput,
  UserPromptSubmitInput,
  NotificationInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  PreCompactInput,
  SetupInput,
  SessionStartInput,
  SessionEndInput,
  PermissionRequestInput,
  HookInputMap,
  HookContextOutput,
  PermissionDecisionOutput,
  StopDecisionOutput,
  GuardAction,
  GuardResult,
  ValidatorResult,
  HookExitCode,
  HookHandlerResult,
  HookHandler,
  GuardConfig,
  ValidatorConfig,
  PermissionConfig,
  ToolkitConfig,
  HookCommandEntry,
  HookMatcherEntry,
  HooksSettings,
  ClaudeSettings,
  ReportFormat,
  PresetName,
  InitOptions,
  TestOptions,
  LogEntry,
  FeatureCategory,
  FeatureMeta,
  FeatureModule,
  LazyFeatureDescriptor,
  VSCodeHookSpecificOutput,
  VSCodeHookOutput,
  GeneratorFormat,
} from './types.js';

export { ALL_HOOK_EVENT_TYPES } from './types.js';

export { loadConfig, DEFAULT_CONFIG, CONFIG_PRESETS, isPresetName } from './config.js';

export { validateConfig } from './config-validator.js';
export type { ConfigValidationResult } from './config-validator.js';

export { createHookRunner, readStdinJson, readStdinRaw, StdinParseError, normalizeHookInput, isVSCodeFormat, sanitizeSessionId, formatOutput, EXIT_PROCEED, EXIT_ERROR, EXIT_BLOCK, exitWithBlock, isExecSyncError } from './runtime/index.js';
export type { ExecSyncError } from './runtime/index.js';

export { FeatureRegistry, getFeatureRegistry, isFeatureEnabled, loadEnabledHandlers, loadEnabledHandlersAsync } from './registry/index.js';

export { checkCommand } from './guards/command-guard.js';
export { checkFileAccess } from './guards/file-guard.js';
export { checkPathTraversal } from './guards/path-guard.js';

export { runLintValidator } from './validators/lint-validator.js';
export { runTypecheckValidator } from './validators/typecheck-validator.js';

export { logHookEvent } from './handlers/logger.js';
export { backupTranscript } from './handlers/transcript-backup.js';
export { getGitContext, getGitContextAsync } from './handlers/git-context.js';
export { trackSessionStart, trackSessionEnd } from './handlers/session-tracker.js';
export { logPrompt } from './handlers/prompt-history.js';

export { checkDiffSize } from './features/diff-size-guard/index.js';
export { backupFile } from './features/file-backup/index.js';
export { trackToolUsage } from './features/cost-tracker/index.js';
export { sendWebhook } from './features/notification-webhook/index.js';
export { recordChange, generateChangeSummary } from './features/change-summary/index.js';
export { checkBranch } from './features/branch-guard/index.js';
export { checkSecretLeak } from './features/secret-leak-guard/index.js';
export { checkScope } from './features/scope-guard/index.js';
export { checkRateLimit } from './features/rate-limiter/index.js';
export { trackTodos } from './features/todo-tracker/index.js';
export { runTestValidator, detectTestRunner } from './features/test-runner/index.js';
export { detectErrorPattern } from './features/error-pattern-detector/index.js';
export { injectContext } from './features/context-injector/index.js';
export { autoCommitChanges } from './features/commit-auto/index.js';
export { generateProjectVisualization } from './features/project-visualizer/index.js';

export { enableFeatureInConfig, disableFeatureInConfig } from './config-modifier.js';

export { resolveHookPath, resolveAllHookPaths, hookEventToFilename } from './generator/hook-resolver.js';
export { generateSettings, mergeWithExisting, writeSettings, generateToolkitConfig, writeToolkitConfig, generateGithubHooksFiles, writeGithubHookFile, writeAllGithubHookFiles } from './generator/settings-generator.js';

export { runHook } from './hooks/run-hook.js';

export { createReporter } from './reporter/index.js';

export { askChoice, askYesNo, askString, runInitWizard, createReadlineInterface } from './cli-prompts.js';
export type { ReadlineInterface, InitWizardAnswers } from './cli-prompts.js';

export { HELP_TOPICS, formatTopicList, getTopicContent } from './help-topics.js';
export type { HelpTopic } from './help-topics.js';
