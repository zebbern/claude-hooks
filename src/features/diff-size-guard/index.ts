import type { FeatureModule, HookInputBase } from '../../types.js';
import { diffSizeGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkDiffSize } from './handler.js';
export { diffSizeGuardMeta } from './meta.js';

export const diffSizeGuardFeature: FeatureModule<HookInputBase> = {
  meta: diffSizeGuardMeta,
  createHandler,
};
