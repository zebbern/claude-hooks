import type { FeatureMeta } from '../../types.js';

export const testRunnerMeta: FeatureMeta = {
  name: 'test-runner',
  hookTypes: ['PostToolUse'],
  description: 'Auto-detects and runs project test suites after write/edit operations',
  category: 'quality',
  configPath: 'validators.test',
  priority: 120,
};
