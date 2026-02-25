import type { FeatureMeta } from '../../types.js';

export const scopeGuardMeta: FeatureMeta = {
  name: 'scope-guard',
  hookTypes: ['PreToolUse'],
  description: 'Restricts file modifications to allowed path patterns',
  category: 'security',
  configPath: 'guards.scope',
  priority: 35,
};
