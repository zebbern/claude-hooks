import type { FeatureModule, HookInputBase } from '../../types.js';
import { promptHistoryMeta } from './meta.js';
import { createHandler } from './handler.js';

export { logPrompt } from './handler.js';
export { promptHistoryMeta } from './meta.js';

export const promptHistoryFeature: FeatureModule<HookInputBase> = {
  meta: promptHistoryMeta,
  createHandler,
};
