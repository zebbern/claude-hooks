import type { FeatureMeta } from '../../types.js';

export const diffSizeGuardMeta: FeatureMeta = {
  name: 'diff-size-guard',
  hookTypes: ['PreToolUse'],
  description: 'Blocks file write/edit operations when the diff exceeds a configurable line limit',
  category: 'security',
  configPath: 'guards.diffSize',
  priority: 40,
};
