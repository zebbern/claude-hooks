import type { FeatureMeta } from '../../types.js';

export const costTrackerMeta: FeatureMeta = {
  name: 'cost-tracker',
  hookTypes: ['PostToolUse', 'Stop'],
  description: 'Tracks tool usage per session and generates summary reports on session stop',
  category: 'tracking',
  configPath: 'costTracker',
  priority: 800,
};
