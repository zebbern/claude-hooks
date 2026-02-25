import type { FeatureModule, HookInputBase } from '../../types.js';
import { branchGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkBranch } from './handler.js';
export { branchGuardMeta } from './meta.js';

export const branchGuardFeature: FeatureModule<HookInputBase> = {
  meta: branchGuardMeta,
  createHandler,
};
