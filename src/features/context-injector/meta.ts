import type { FeatureMeta } from '../../types.js';

export const contextInjectorMeta: FeatureMeta = {
  name: 'context-injector',
  hookTypes: ['SessionStart', 'UserPromptSubmit'],
  description: 'Injects project context files as additional context on session start and prompts',
  category: 'tracking',
  configPath: 'contextInjector',
  priority: 205,
};
