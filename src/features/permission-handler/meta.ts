import type { FeatureMeta } from '../../types.js';

export const permissionHandlerMeta: FeatureMeta = {
  name: 'permission-handler',
  hookTypes: ['PermissionRequest'],
  description: 'Auto-allows, auto-denies, or prompts user confirmation for tool permissions (deny > ask > allow)',
  category: 'security',
  configPath: '',
  priority: 10,
};
