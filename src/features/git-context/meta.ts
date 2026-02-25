import type { FeatureMeta } from '../../types.js';

export const gitContextMeta: FeatureMeta = {
  name: 'git-context',
  hookTypes: ['SessionStart', 'Setup'],
  description: 'Collects git branch, working-tree status, and recent commits as additional context',
  category: 'tracking',
  configPath: '',
  priority: 210,
};
