import type { FeatureMeta } from '../../types.js';

export const pathGuardMeta: FeatureMeta = {
  name: 'path-guard',
  hookTypes: ['PreToolUse'],
  description: 'Blocks file operations that resolve outside the project root',
  category: 'security',
  configPath: 'guards.path',
  priority: 30,
};
