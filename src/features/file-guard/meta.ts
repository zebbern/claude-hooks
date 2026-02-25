import type { FeatureMeta } from '../../types.js';

export const fileGuardMeta: FeatureMeta = {
  name: 'file-guard',
  hookTypes: ['PreToolUse'],
  description: 'Blocks writes to protected files (.env, *.pem, *.key, etc.)',
  category: 'security',
  configPath: 'guards.file',
  priority: 20,
};
