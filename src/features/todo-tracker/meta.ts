import type { FeatureMeta } from '../../types.js';

export const todoTrackerMeta: FeatureMeta = {
  name: 'todo-tracker',
  hookTypes: ['PostToolUse', 'Stop'],
  description: 'Tracks TODO/FIXME/HACK/XXX markers in written code and generates reports',
  category: 'tracking',
  configPath: 'todoTracker',
  priority: 260,
};
