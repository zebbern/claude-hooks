import type { FeatureMeta } from '../../types.js';

export const commitAutoMeta: FeatureMeta = {
  name: 'commit-auto',
  hookTypes: ['Stop'],
  description: 'Automatically stages and commits changes with conventional commit messages on session stop',
  category: 'integration',
  configPath: 'autoCommit',
  priority: 850,
};
