import type { FeatureMeta } from '../../types.js';

export const sessionTrackerMeta: FeatureMeta = {
  name: 'session-tracker',
  hookTypes: ['SessionStart', 'SessionEnd', 'Stop'],
  description: 'Tracks session start/end events to sessions.jsonl',
  category: 'tracking',
  configPath: '',
  priority: 220,
};
