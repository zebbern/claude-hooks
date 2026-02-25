import type { FeatureModule, HookInputBase } from '../../types.js';
import { errorPatternDetectorMeta } from './meta.js';
import { createHandler } from './handler.js';

export { detectErrorPattern } from './handler.js';
export { errorPatternDetectorMeta } from './meta.js';

export const errorPatternDetectorFeature: FeatureModule<HookInputBase> = {
  meta: errorPatternDetectorMeta,
  createHandler,
};
