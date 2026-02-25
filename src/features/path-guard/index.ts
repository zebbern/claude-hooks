import type { FeatureModule, HookInputBase } from '../../types.js';
import { pathGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkPathTraversal } from './handler.js';
export { pathGuardMeta } from './meta.js';

export const pathGuardFeature: FeatureModule<HookInputBase> = {
  meta: pathGuardMeta,
  createHandler,
};
