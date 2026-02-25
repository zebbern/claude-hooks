import type { FeatureMeta, HookEventType } from '../../types.js';
import { ALL_HOOK_EVENT_TYPES } from '../../types.js';

export const loggerMeta: FeatureMeta = {
  name: 'logger',
  hookTypes: ALL_HOOK_EVENT_TYPES as unknown as HookEventType[],
  description: 'Appends JSONL log entries for all hook events',
  category: 'tracking',
  configPath: '',
  priority: 900,
};
