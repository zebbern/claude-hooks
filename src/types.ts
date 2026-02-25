// ---------------------------------------------------------------------------
// Hook event types
// ---------------------------------------------------------------------------

export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'UserPromptSubmit'
  | 'Notification'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'Setup'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PermissionRequest';

export const ALL_HOOK_EVENT_TYPES: readonly HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'Setup',
  'SessionStart',
  'SessionEnd',
  'PermissionRequest',
] as const;

// ---------------------------------------------------------------------------
// Hook input interfaces
// ---------------------------------------------------------------------------

export interface HookInputBase {
  session_id: string;
}

export interface PreToolUseInput extends HookInputBase {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface PostToolUseInput extends HookInputBase {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string;
}

export interface PostToolUseFailureInput extends HookInputBase {
  tool_name: string;
  tool_input: Record<string, unknown>;
  error: string;
}

export interface UserPromptSubmitInput extends HookInputBase {
  prompt: string;
}

export interface NotificationInput extends HookInputBase {
  message: string;
}

export interface StopInput extends HookInputBase {
  stop_hook_active: boolean;
  transcript_path: string;
}

export interface SubagentStartInput extends HookInputBase {
  agent_id: string;
  agent_type: string;
}

export interface SubagentStopInput extends HookInputBase {
  agent_id: string;
  agent_transcript_path: string;
  stop_hook_active: boolean;
  transcript_path: string;
}

export interface PreCompactInput extends HookInputBase {
  transcript_path: string;
  trigger: 'manual' | 'auto';
  custom_instructions?: string;
}

export interface SetupInput extends HookInputBase {
  cwd: string;
  trigger: 'init' | 'maintenance';
}

export interface SessionStartInput extends HookInputBase {
  source: 'startup' | 'resume' | 'clear';
}

export interface SessionEndInput extends HookInputBase {}

export interface PermissionRequestInput extends HookInputBase {
  tool_name: string;
  tool_input: Record<string, unknown>;
  hook_event_name: string;
}

// ---------------------------------------------------------------------------
// Hook input type map (HookEventType → concrete input type)
// ---------------------------------------------------------------------------

export interface HookInputMap {
  PreToolUse: PreToolUseInput;
  PostToolUse: PostToolUseInput;
  PostToolUseFailure: PostToolUseFailureInput;
  UserPromptSubmit: UserPromptSubmitInput;
  Notification: NotificationInput;
  Stop: StopInput;
  SubagentStart: SubagentStartInput;
  SubagentStop: SubagentStopInput;
  PreCompact: PreCompactInput;
  Setup: SetupInput;
  SessionStart: SessionStartInput;
  SessionEnd: SessionEndInput;
  PermissionRequest: PermissionRequestInput;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface HookContextOutput {
  additionalContext?: string;
}

export interface PermissionDecisionOutput {
  decision: 'allow' | 'deny' | 'ask';
  updatedInput?: Record<string, unknown>;
  message?: string;
  interrupt?: boolean;
}

export interface StopDecisionOutput {
  decision: 'allow' | 'block';
  reason?: string;
}

// ---------------------------------------------------------------------------
// VS Code output types
// ---------------------------------------------------------------------------

export interface VSCodeHookSpecificOutput {
  hookEventName: string;
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
  decision?: 'block';
  reason?: string;
}

export interface VSCodeHookOutput {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  decision?: 'block';
  reason?: string;
  hookSpecificOutput?: VSCodeHookSpecificOutput;
}

// ---------------------------------------------------------------------------
// Guard types
// ---------------------------------------------------------------------------

export type GuardAction = 'proceed' | 'block' | 'warn';

export interface GuardResult {
  action: GuardAction;
  message?: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Validator types
// ---------------------------------------------------------------------------

export interface ValidatorResult {
  passed: boolean;
  output: string;
  command: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

export type HookExitCode = 0 | 1 | 2;

export interface HookHandlerResult {
  exitCode: HookExitCode;
  stdout?: string;
  stderr?: string;
}

export type HookHandler<T extends HookInputBase> = (
  input: T,
  config: ToolkitConfig,
) => Promise<HookHandlerResult | undefined>;

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export interface GuardConfig {
  command: {
    blockedPatterns: string[];
    allowedPatterns: string[];
    enabled: boolean;
  };
  file: {
    protectedPatterns: string[];
    enabled: boolean;
  };
  path: {
    allowedRoots: string[];
    enabled: boolean;
  };
  diffSize: {
    maxLines: number;
    enabled: boolean;
  };
  branch: {
    protectedBranches: string[];
    enabled: boolean;
  };
  secretLeak: {
    customPatterns: string[];
    allowedPatterns: string[];
    enabled: boolean;
  };
  scope: {
    allowedPaths: string[];
    enabled: boolean;
  };
}

export interface ValidatorConfig {
  lint: {
    command: string;
    enabled: boolean;
  };
  typecheck: {
    command: string;
    enabled: boolean;
  };
  test: {
    command: string;
    timeout: number;
    enabled: boolean;
  };
}

export interface PermissionConfig {
  autoAllow: string[];
  autoDeny: string[];
  autoAsk: string[];
}

export interface ToolkitConfig {
  logDir: string;
  transcriptBackupDir: string;
  guards: GuardConfig;
  validators: ValidatorConfig;
  permissions: PermissionConfig;
  promptHistory: {
    enabled: boolean;
  };
  fileBackup: {
    backupDir: string;
    enabled: boolean;
  };
  costTracker: {
    outputPath: string;
    enabled: boolean;
  };
  webhooks: {
    url: string;
    events: HookEventType[];
    enabled: boolean;
    /** When true, the full hook input is included in webhook payloads. Default: false. */
    includeFullInput?: boolean;
  };
  changeSummary: {
    outputPath: string;
    enabled: boolean;
  };
  rateLimiter: {
    maxToolCallsPerSession: number;
    maxFileEditsPerSession: number;
    enabled: boolean;
  };
  todoTracker: {
    outputPath: string;
    patterns: string[];
    enabled: boolean;
  };
  errorPatternDetector: {
    maxRepeats: number;
    enabled: boolean;
  };
  contextInjector: {
    contextFiles: string[];
    enabled: boolean;
  };
  autoCommit: {
    messageTemplate: string;
    enabled: boolean;
  };
  projectVisualizer: {
    outputPath: string;
    maxDepth: number;
    enabled: boolean;
  };
  /** Default timeout in seconds for all hook commands. */
  defaultTimeout: number;
  /** Per-hook-type timeout overrides in seconds. */
  hookTimeouts?: Partial<Record<HookEventType, number>>;
}

// ---------------------------------------------------------------------------
// Settings types
// ---------------------------------------------------------------------------

export interface HookCommandEntry {
  type: 'command';
  command: string;
  windows?: string;
  linux?: string;
  osx?: string;
  timeout?: number;
}

export interface HookMatcherEntry {
  matcher: string;
  hooks: HookCommandEntry[];
}

export type HooksSettings = Partial<Record<HookEventType, HookMatcherEntry[]>>;

export interface ClaudeSettings {
  hooks?: HooksSettings;
  permissions?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// CLI types
// ---------------------------------------------------------------------------

export type ReportFormat = 'terminal' | 'json';

export type GeneratorFormat = 'claude' | 'vscode' | 'both';

export type PresetName = 'minimal' | 'security' | 'quality' | 'full';

export interface InitOptions {
  projectDir: string;
  preset: PresetName;
  force: boolean;
}

export interface TestOptions {
  hookType: HookEventType;
  inputJson?: string;
  inputFile?: string;
}

export interface LogEntry {
  timestamp: string;
  sessionId: string;
  hookType: HookEventType;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Feature system types
// ---------------------------------------------------------------------------

export type FeatureCategory = 'security' | 'quality' | 'tracking' | 'integration';

export interface FeatureMeta {
  /** Unique identifier: 'command-guard', 'cost-tracker', etc. */
  name: string;
  /** Which hook event this feature attaches to */
  hookTypes: HookEventType[];
  /** Human-readable description for CLI catalog */
  description: string;
  /** Grouping for display */
  category: FeatureCategory;
  /** Dot-path into ToolkitConfig where this feature's enabled flag lives */
  configPath: string;
  /** Order within the hook pipeline (lower = earlier). Guards: 0-99, Validators: 100-199, Handlers: 200+ */
  priority: number;
}

export interface FeatureModule<T extends HookInputBase = HookInputBase> {
  meta: FeatureMeta;
  createHandler: (hookType: HookEventType) => HookHandler<T>;
}

/**
 * Lazy feature descriptor — stores lightweight metadata eagerly and defers
 * the full feature module import until the feature is actually needed.
 */
export interface LazyFeatureDescriptor {
  meta: FeatureMeta;
  load: () => Promise<FeatureModule<HookInputBase>>;
}
