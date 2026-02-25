import type { FeatureModule, HookInputBase } from '../types.js';

import { rateLimiterFeature } from './rate-limiter/index.js';
import { commandGuardFeature } from './command-guard/index.js';
import { branchGuardFeature } from './branch-guard/index.js';
import { fileGuardFeature } from './file-guard/index.js';
import { secretLeakGuardFeature } from './secret-leak-guard/index.js';
import { pathGuardFeature } from './path-guard/index.js';
import { scopeGuardFeature } from './scope-guard/index.js';
import { diffSizeGuardFeature } from './diff-size-guard/index.js';
import { lintValidatorFeature } from './lint-validator/index.js';
import { typecheckValidatorFeature } from './typecheck-validator/index.js';
import { loggerFeature } from './logger/index.js';
import { transcriptBackupFeature } from './transcript-backup/index.js';
import { gitContextFeature } from './git-context/index.js';
import { sessionTrackerFeature } from './session-tracker/index.js';
import { promptHistoryFeature } from './prompt-history/index.js';
import { permissionHandlerFeature } from './permission-handler/index.js';
import { changeSummaryFeature } from './change-summary/index.js';
import { todoTrackerFeature } from './todo-tracker/index.js';
import { fileBackupFeature } from './file-backup/index.js';
import { costTrackerFeature } from './cost-tracker/index.js';
import { notificationWebhookFeature } from './notification-webhook/index.js';
import { testRunnerFeature } from './test-runner/index.js';
import { errorPatternDetectorFeature } from './error-pattern-detector/index.js';
import { contextInjectorFeature } from './context-injector/index.js';
import { commitAutoFeature } from './commit-auto/index.js';
import { projectVisualizerFeature } from './project-visualizer/index.js';

// Re-export individual feature modules and their public functions
export { rateLimiterFeature, checkRateLimit } from './rate-limiter/index.js';
export { commandGuardFeature, checkCommand } from './command-guard/index.js';
export { branchGuardFeature, checkBranch } from './branch-guard/index.js';
export { fileGuardFeature, checkFileAccess } from './file-guard/index.js';
export { secretLeakGuardFeature, checkSecretLeak } from './secret-leak-guard/index.js';
export { pathGuardFeature, checkPathTraversal } from './path-guard/index.js';
export { scopeGuardFeature, checkScope } from './scope-guard/index.js';
export { diffSizeGuardFeature, checkDiffSize } from './diff-size-guard/index.js';
export { lintValidatorFeature, runLintValidator } from './lint-validator/index.js';
export { typecheckValidatorFeature, runTypecheckValidator } from './typecheck-validator/index.js';
export { loggerFeature, logHookEvent } from './logger/index.js';
export { transcriptBackupFeature, backupTranscript } from './transcript-backup/index.js';
export { gitContextFeature, getGitContext, getGitContextAsync } from './git-context/index.js';
export { sessionTrackerFeature, trackSessionStart, trackSessionEnd } from './session-tracker/index.js';
export { promptHistoryFeature, logPrompt } from './prompt-history/index.js';
export { permissionHandlerFeature } from './permission-handler/index.js';
export { changeSummaryFeature, recordChange, generateChangeSummary } from './change-summary/index.js';
export { todoTrackerFeature, trackTodos } from './todo-tracker/index.js';
export { fileBackupFeature, backupFile } from './file-backup/index.js';
export { costTrackerFeature, trackToolUsage } from './cost-tracker/index.js';
export { notificationWebhookFeature, sendWebhook } from './notification-webhook/index.js';
export { testRunnerFeature, runTestValidator, detectTestRunner } from './test-runner/index.js';
export { errorPatternDetectorFeature, detectErrorPattern } from './error-pattern-detector/index.js';
export { contextInjectorFeature, injectContext } from './context-injector/index.js';
export { commitAutoFeature, autoCommitChanges } from './commit-auto/index.js';
export { projectVisualizerFeature, generateProjectVisualization } from './project-visualizer/index.js';

// Lazy feature loading
export { lazyBuiltInFeatures } from './lazy-features.js';

/** All built-in feature modules, ordered by priority. */
export const builtInFeatures: FeatureModule<HookInputBase>[] = [
  rateLimiterFeature,
  fileBackupFeature,
  branchGuardFeature,
  commandGuardFeature,
  fileGuardFeature,
  secretLeakGuardFeature,
  pathGuardFeature,
  scopeGuardFeature,
  diffSizeGuardFeature,
  lintValidatorFeature,
  typecheckValidatorFeature,
  testRunnerFeature,
  errorPatternDetectorFeature,
  loggerFeature,
  transcriptBackupFeature,
  contextInjectorFeature,
  gitContextFeature,
  projectVisualizerFeature,
  sessionTrackerFeature,
  promptHistoryFeature,
  permissionHandlerFeature,
  changeSummaryFeature,
  todoTrackerFeature,
  costTrackerFeature,
  commitAutoFeature,
  notificationWebhookFeature,
];
