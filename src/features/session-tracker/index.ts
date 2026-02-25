import type { FeatureModule, HookInputBase } from '../../types.js';
import { sessionTrackerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { trackSessionStart, trackSessionEnd } from './handler.js';
export { sessionTrackerMeta } from './meta.js';

export const sessionTrackerFeature: FeatureModule<HookInputBase> = {
  meta: sessionTrackerMeta,
  createHandler,
};
