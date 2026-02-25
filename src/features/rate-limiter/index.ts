import type { FeatureModule, HookInputBase } from '../../types.js';
import { rateLimiterMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkRateLimit } from './handler.js';
export { rateLimiterMeta } from './meta.js';

export const rateLimiterFeature: FeatureModule<HookInputBase> = {
  meta: rateLimiterMeta,
  createHandler,
};
