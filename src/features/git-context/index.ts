import type { FeatureModule, HookInputBase } from '../../types.js';
import { gitContextMeta } from './meta.js';
import { createHandler } from './handler.js';

export { getGitContext, getGitContextAsync } from './handler.js';
export { gitContextMeta } from './meta.js';

export const gitContextFeature: FeatureModule<HookInputBase> = {
  meta: gitContextMeta,
  createHandler,
};
