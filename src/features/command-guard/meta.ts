import type { FeatureMeta } from '../../types.js';

export const commandGuardMeta: FeatureMeta = {
  name: 'command-guard',
  hookTypes: ['PreToolUse'],
  description: 'Blocks dangerous shell commands (rm -rf, chmod 777, .env access, etc.)',
  category: 'security',
  configPath: 'guards.command',
  priority: 10,
};
