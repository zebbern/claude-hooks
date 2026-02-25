import type { LazyFeatureDescriptor } from '../types.js';

// Import metas eagerly — they are lightweight data objects with no side effects.
// This avoids importing the full handler modules (which contain the actual logic)
// until a specific hook type is requested.
import { rateLimiterMeta } from './rate-limiter/meta.js';
import { commandGuardMeta } from './command-guard/meta.js';
import { branchGuardMeta } from './branch-guard/meta.js';
import { fileGuardMeta } from './file-guard/meta.js';
import { secretLeakGuardMeta } from './secret-leak-guard/meta.js';
import { pathGuardMeta } from './path-guard/meta.js';
import { scopeGuardMeta } from './scope-guard/meta.js';
import { diffSizeGuardMeta } from './diff-size-guard/meta.js';
import { lintValidatorMeta } from './lint-validator/meta.js';
import { typecheckValidatorMeta } from './typecheck-validator/meta.js';
import { loggerMeta } from './logger/meta.js';
import { transcriptBackupMeta } from './transcript-backup/meta.js';
import { gitContextMeta } from './git-context/meta.js';
import { sessionTrackerMeta } from './session-tracker/meta.js';
import { promptHistoryMeta } from './prompt-history/meta.js';
import { permissionHandlerMeta } from './permission-handler/meta.js';
import { changeSummaryMeta } from './change-summary/meta.js';
import { todoTrackerMeta } from './todo-tracker/meta.js';
import { fileBackupMeta } from './file-backup/meta.js';
import { costTrackerMeta } from './cost-tracker/meta.js';
import { notificationWebhookMeta } from './notification-webhook/meta.js';
import { testRunnerMeta } from './test-runner/meta.js';
import { errorPatternDetectorMeta } from './error-pattern-detector/meta.js';
import { contextInjectorMeta } from './context-injector/meta.js';
import { commitAutoMeta } from './commit-auto/meta.js';
import { projectVisualizerMeta } from './project-visualizer/meta.js';

/**
 * Lazy feature descriptors for all 26 built-in features.
 *
 * Each descriptor stores the lightweight metadata eagerly and provides a
 * `load()` function that dynamically imports the full feature module only
 * when needed. This allows hook entry points to import only the features
 * that match the current hook type, avoiding ~100ms of wasted module
 * loading for unused features.
 *
 * Ordered by priority (ascending) to match the eager `builtInFeatures` array.
 */
export const lazyBuiltInFeatures: LazyFeatureDescriptor[] = [
  {
    meta: rateLimiterMeta,
    load: () => import('./rate-limiter/index.js').then((m) => m.rateLimiterFeature),
  },
  {
    meta: fileBackupMeta,
    load: () => import('./file-backup/index.js').then((m) => m.fileBackupFeature),
  },
  {
    meta: branchGuardMeta,
    load: () => import('./branch-guard/index.js').then((m) => m.branchGuardFeature),
  },
  {
    meta: commandGuardMeta,
    load: () => import('./command-guard/index.js').then((m) => m.commandGuardFeature),
  },
  {
    meta: fileGuardMeta,
    load: () => import('./file-guard/index.js').then((m) => m.fileGuardFeature),
  },
  {
    meta: secretLeakGuardMeta,
    load: () => import('./secret-leak-guard/index.js').then((m) => m.secretLeakGuardFeature),
  },
  {
    meta: pathGuardMeta,
    load: () => import('./path-guard/index.js').then((m) => m.pathGuardFeature),
  },
  {
    meta: scopeGuardMeta,
    load: () => import('./scope-guard/index.js').then((m) => m.scopeGuardFeature),
  },
  {
    meta: diffSizeGuardMeta,
    load: () => import('./diff-size-guard/index.js').then((m) => m.diffSizeGuardFeature),
  },
  {
    meta: lintValidatorMeta,
    load: () => import('./lint-validator/index.js').then((m) => m.lintValidatorFeature),
  },
  {
    meta: typecheckValidatorMeta,
    load: () => import('./typecheck-validator/index.js').then((m) => m.typecheckValidatorFeature),
  },
  {
    meta: testRunnerMeta,
    load: () => import('./test-runner/index.js').then((m) => m.testRunnerFeature),
  },
  {
    meta: errorPatternDetectorMeta,
    load: () => import('./error-pattern-detector/index.js').then((m) => m.errorPatternDetectorFeature),
  },
  {
    meta: loggerMeta,
    load: () => import('./logger/index.js').then((m) => m.loggerFeature),
  },
  {
    meta: transcriptBackupMeta,
    load: () => import('./transcript-backup/index.js').then((m) => m.transcriptBackupFeature),
  },
  {
    meta: contextInjectorMeta,
    load: () => import('./context-injector/index.js').then((m) => m.contextInjectorFeature),
  },
  {
    meta: gitContextMeta,
    load: () => import('./git-context/index.js').then((m) => m.gitContextFeature),
  },
  {
    meta: projectVisualizerMeta,
    load: () => import('./project-visualizer/index.js').then((m) => m.projectVisualizerFeature),
  },
  {
    meta: sessionTrackerMeta,
    load: () => import('./session-tracker/index.js').then((m) => m.sessionTrackerFeature),
  },
  {
    meta: promptHistoryMeta,
    load: () => import('./prompt-history/index.js').then((m) => m.promptHistoryFeature),
  },
  {
    meta: permissionHandlerMeta,
    load: () => import('./permission-handler/index.js').then((m) => m.permissionHandlerFeature),
  },
  {
    meta: changeSummaryMeta,
    load: () => import('./change-summary/index.js').then((m) => m.changeSummaryFeature),
  },
  {
    meta: todoTrackerMeta,
    load: () => import('./todo-tracker/index.js').then((m) => m.todoTrackerFeature),
  },
  {
    meta: costTrackerMeta,
    load: () => import('./cost-tracker/index.js').then((m) => m.costTrackerFeature),
  },
  {
    meta: commitAutoMeta,
    load: () => import('./commit-auto/index.js').then((m) => m.commitAutoFeature),
  },
  {
    meta: notificationWebhookMeta,
    load: () => import('./notification-webhook/index.js').then((m) => m.notificationWebhookFeature),
  },
];
