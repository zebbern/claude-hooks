import type { FeatureModule, HookInputBase } from '../../types.js';
import { costTrackerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { trackToolUsage } from './handler.js';
export { costTrackerMeta } from './meta.js';

export const costTrackerFeature: FeatureModule<HookInputBase> = {
  meta: costTrackerMeta,
  createHandler,
};
