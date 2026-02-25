import type { FeatureMeta } from '../../types.js';

export const branchGuardMeta: FeatureMeta = {
  name: 'branch-guard',
  hookTypes: ['PreToolUse'],
  description: 'Blocks file modifications on protected Git branches',
  category: 'security',
  configPath: 'guards.branch',
  priority: 8,
};
