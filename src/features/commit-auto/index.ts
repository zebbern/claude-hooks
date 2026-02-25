import type { FeatureModule, HookInputBase } from '../../types.js';
import { commitAutoMeta } from './meta.js';
import { createHandler } from './handler.js';

export { autoCommitChanges } from './handler.js';
export { commitAutoMeta } from './meta.js';

export const commitAutoFeature: FeatureModule<HookInputBase> = {
  meta: commitAutoMeta,
  createHandler,
};
