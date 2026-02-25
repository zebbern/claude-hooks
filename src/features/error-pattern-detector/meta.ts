import type { FeatureMeta } from '../../types.js';

export const errorPatternDetectorMeta: FeatureMeta = {
  name: 'error-pattern-detector',
  hookTypes: ['PostToolUseFailure'],
  description: 'Detects repeated tool failure patterns and suggests alternative approaches',
  category: 'quality',
  configPath: 'errorPatternDetector',
  priority: 120,
};
