import type { FeatureModule, HookInputBase } from '../../types.js';
import { fileGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkFileAccess } from './handler.js';
export { fileGuardMeta } from './meta.js';

export const fileGuardFeature: FeatureModule<HookInputBase> = {
  meta: fileGuardMeta,
  createHandler,
};
