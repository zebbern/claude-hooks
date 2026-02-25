import type { FeatureModule, HookInputBase } from '../../types.js';
import { todoTrackerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { trackTodos } from './handler.js';
export { todoTrackerMeta } from './meta.js';

export const todoTrackerFeature: FeatureModule<HookInputBase> = {
  meta: todoTrackerMeta,
  createHandler,
};
