import type { FeatureMeta } from '../../types.js';

export const changeSummaryMeta: FeatureMeta = {
  name: 'change-summary',
  hookTypes: ['PostToolUse', 'Stop'],
  description: 'Records file changes and generates a session change summary on stop',
  category: 'tracking',
  configPath: 'changeSummary',
  priority: 250,
};
