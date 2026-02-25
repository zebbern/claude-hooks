import { DEFAULT_CONFIG } from './config-defaults.js';
import { ALL_HOOK_EVENT_TYPES } from './types.js';
import { checkRegexSafety } from './utils/regex-safety.js';

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ConfigValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  /** Dot-notation paths of fields that failed validation (type mismatch, range, etc.). */
  invalidPaths: string[];
}

// ---------------------------------------------------------------------------
// Schema definition helpers
// ---------------------------------------------------------------------------

type FieldType = 'boolean' | 'number' | 'string' | 'string[]';

interface FieldRule {
  path: string;
  type: FieldType;
  /** For numbers: minimum allowed value (inclusive). */
  min?: number;
}

interface RegexFieldRule {
  path: string;
  label: string;
}

/**
 * Flat list of every typed field inside `ToolkitConfig` that users can set.
 * Paths use dot-notation matching the JSON structure.
 */
const FIELD_RULES: FieldRule[] = [
  // top-level strings
  { path: 'logDir', type: 'string' },
  { path: 'transcriptBackupDir', type: 'string' },

  // guards.command
  { path: 'guards.command.enabled', type: 'boolean' },
  { path: 'guards.command.blockedPatterns', type: 'string[]' },
  { path: 'guards.command.allowedPatterns', type: 'string[]' },

  // guards.file
  { path: 'guards.file.enabled', type: 'boolean' },
  { path: 'guards.file.protectedPatterns', type: 'string[]' },

  // guards.path
  { path: 'guards.path.enabled', type: 'boolean' },
  { path: 'guards.path.allowedRoots', type: 'string[]' },

  // guards.diffSize
  { path: 'guards.diffSize.enabled', type: 'boolean' },
  { path: 'guards.diffSize.maxLines', type: 'number', min: 1 },

  // guards.branch
  { path: 'guards.branch.enabled', type: 'boolean' },
  { path: 'guards.branch.protectedBranches', type: 'string[]' },

  // guards.secretLeak
  { path: 'guards.secretLeak.enabled', type: 'boolean' },
  { path: 'guards.secretLeak.customPatterns', type: 'string[]' },
  { path: 'guards.secretLeak.allowedPatterns', type: 'string[]' },

  // guards.scope
  { path: 'guards.scope.enabled', type: 'boolean' },
  { path: 'guards.scope.allowedPaths', type: 'string[]' },

  // validators
  { path: 'validators.lint.enabled', type: 'boolean' },
  { path: 'validators.lint.command', type: 'string' },
  { path: 'validators.typecheck.enabled', type: 'boolean' },
  { path: 'validators.typecheck.command', type: 'string' },
  { path: 'validators.test.enabled', type: 'boolean' },
  { path: 'validators.test.command', type: 'string' },
  { path: 'validators.test.timeout', type: 'number', min: 1 },

  // permissions
  { path: 'permissions.autoAllow', type: 'string[]' },
  { path: 'permissions.autoDeny', type: 'string[]' },
  { path: 'permissions.autoAsk', type: 'string[]' },

  // promptHistory
  { path: 'promptHistory.enabled', type: 'boolean' },

  // fileBackup
  { path: 'fileBackup.enabled', type: 'boolean' },
  { path: 'fileBackup.backupDir', type: 'string' },

  // costTracker
  { path: 'costTracker.enabled', type: 'boolean' },
  { path: 'costTracker.outputPath', type: 'string' },

  // webhooks
  { path: 'webhooks.enabled', type: 'boolean' },
  { path: 'webhooks.url', type: 'string' },
  { path: 'webhooks.events', type: 'string[]' },
  { path: 'webhooks.includeFullInput', type: 'boolean' },

  // changeSummary
  { path: 'changeSummary.enabled', type: 'boolean' },
  { path: 'changeSummary.outputPath', type: 'string' },

  // rateLimiter
  { path: 'rateLimiter.enabled', type: 'boolean' },
  { path: 'rateLimiter.maxToolCallsPerSession', type: 'number', min: 0 },
  { path: 'rateLimiter.maxFileEditsPerSession', type: 'number', min: 0 },

  // todoTracker
  { path: 'todoTracker.enabled', type: 'boolean' },
  { path: 'todoTracker.outputPath', type: 'string' },
  { path: 'todoTracker.patterns', type: 'string[]' },

  // errorPatternDetector
  { path: 'errorPatternDetector.enabled', type: 'boolean' },
  { path: 'errorPatternDetector.maxRepeats', type: 'number', min: 1 },

  // contextInjector
  { path: 'contextInjector.enabled', type: 'boolean' },
  { path: 'contextInjector.contextFiles', type: 'string[]' },

  // autoCommit
  { path: 'autoCommit.enabled', type: 'boolean' },
  { path: 'autoCommit.messageTemplate', type: 'string' },

  // projectVisualizer
  { path: 'projectVisualizer.enabled', type: 'boolean' },
  { path: 'projectVisualizer.outputPath', type: 'string' },
  { path: 'projectVisualizer.maxDepth', type: 'number', min: 1 },

  // timeout
  { path: 'defaultTimeout', type: 'number', min: 1 },
];

/**
 * String-array fields whose elements are regex patterns that must compile.
 */
const REGEX_FIELDS: RegexFieldRule[] = [
  { path: 'guards.command.blockedPatterns', label: 'guards.command.blockedPatterns' },
  { path: 'guards.command.allowedPatterns', label: 'guards.command.allowedPatterns' },
  { path: 'guards.secretLeak.customPatterns', label: 'guards.secretLeak.customPatterns' },
  { path: 'guards.secretLeak.allowedPatterns', label: 'guards.secretLeak.allowedPatterns' },
  { path: 'permissions.autoAllow', label: 'permissions.autoAllow' },
  { path: 'permissions.autoDeny', label: 'permissions.autoDeny' },
  { path: 'permissions.autoAsk', label: 'permissions.autoAsk' },
  { path: 'todoTracker.patterns', label: 'todoTracker.patterns' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function collectTopLevelKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a raw parsed config object against the expected ToolkitConfig schema.
 *
 * Returns structured results with errors (type mismatches, invalid values) and
 * warnings (unknown keys that might be typos). Does **not** throw — callers
 * decide how to handle the results.
 *
 * @param raw - The parsed JSON object from the config file.
 * @returns A {@link ConfigValidationResult} with `valid`, `errors`, and `warnings`.
 */
export function validateConfig(raw: Record<string, unknown>): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const invalidPaths: string[] = [];

  // --- Check unknown top-level keys ---
  const knownTopLevelKeys = new Set(collectTopLevelKeys(DEFAULT_CONFIG as unknown as Record<string, unknown>));
  knownTopLevelKeys.add('$schema');
  knownTopLevelKeys.add('hookTimeouts');
  knownTopLevelKeys.add('extends');
  for (const key of Object.keys(raw)) {
    if (!knownTopLevelKeys.has(key)) {
      warnings.push(`Unknown top-level key "${key}" — possible typo`);
    }
  }

  // --- Check typed fields ---
  for (const rule of FIELD_RULES) {
    const value = getNestedValue(raw, rule.path);
    if (value === undefined) continue; // Not provided — will fall back to default

    switch (rule.type) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`"${rule.path}" must be a boolean, got ${typeof value} (${JSON.stringify(value)})`);
          invalidPaths.push(rule.path);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push(`"${rule.path}" must be a number, got ${typeof value} (${JSON.stringify(value)})`);
          invalidPaths.push(rule.path);
        } else if (rule.min !== undefined && value < rule.min) {
          errors.push(`"${rule.path}" must be >= ${rule.min}, got ${value}`);
          invalidPaths.push(rule.path);
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          errors.push(`"${rule.path}" must be a string, got ${typeof value} (${JSON.stringify(value)})`);
          invalidPaths.push(rule.path);
        }
        break;

      case 'string[]':
        if (!Array.isArray(value)) {
          errors.push(`"${rule.path}" must be an array of strings, got ${typeof value}`);
          invalidPaths.push(rule.path);
        } else {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'string') {
              errors.push(`"${rule.path}[${i}]" must be a string, got ${typeof value[i]}`);
              invalidPaths.push(rule.path);
            }
          }
        }
        break;
    }
  }

  // --- Check hookTimeouts ---
  if (raw.hookTimeouts !== undefined) {
    if (typeof raw.hookTimeouts !== 'object' || raw.hookTimeouts === null || Array.isArray(raw.hookTimeouts)) {
      errors.push(`"hookTimeouts" must be an object mapping hook event types to numbers`);
      invalidPaths.push('hookTimeouts');
    } else {
      const validHookTypes = new Set<string>(ALL_HOOK_EVENT_TYPES);
      for (const [key, val] of Object.entries(raw.hookTimeouts as Record<string, unknown>)) {
        if (!validHookTypes.has(key)) {
          warnings.push(`Unknown hook type "${key}" in hookTimeouts`);
        }
        if (typeof val !== 'number' || val < 1) {
          errors.push(`"hookTimeouts.${key}" must be a number >= 1, got ${JSON.stringify(val)}`);
          invalidPaths.push(`hookTimeouts.${key}`);
        }
      }
    }
  }

  // --- Check regex compilability and ReDoS safety ---
  for (const regexField of REGEX_FIELDS) {
    const value = getNestedValue(raw, regexField.path);
    if (!Array.isArray(value)) continue;

    for (let i = 0; i < value.length; i++) {
      const pattern = value[i];
      if (typeof pattern !== 'string') continue; // Already flagged by type check
      try {
        new RegExp(pattern);
      } catch {
        errors.push(`Invalid regex in "${regexField.label}[${i}]": ${JSON.stringify(pattern)}`);
        invalidPaths.push(regexField.path);
        continue; // Skip ReDoS check for unparseable patterns
      }

      // ReDoS safety check — warn but don't error
      const safety = checkRegexSafety(pattern);
      if (!safety.safe) {
        warnings.push(
          `Potentially unsafe regex in "${regexField.label}[${i}]": ${JSON.stringify(pattern)} — ${safety.reason}`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    invalidPaths: [...new Set(invalidPaths)],
  };
}
