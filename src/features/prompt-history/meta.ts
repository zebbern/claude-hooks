import type { FeatureMeta } from '../../types.js';

export const promptHistoryMeta: FeatureMeta = {
  name: 'prompt-history',
  hookTypes: ['UserPromptSubmit'],
  description: 'Logs user prompts to per-session JSONL files',
  category: 'tracking',
  configPath: 'promptHistory',
  priority: 230,
};
