import type { FeatureMeta } from '../../types.js';

export const secretLeakGuardMeta: FeatureMeta = {
  name: 'secret-leak-guard',
  hookTypes: ['PreToolUse'],
  description: 'Scans file content for leaked secrets and API keys before writing',
  category: 'security',
  configPath: 'guards.secretLeak',
  priority: 25,
};
