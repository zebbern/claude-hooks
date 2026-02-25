import type { FeatureModule, HookInputBase } from '../../types.js';
import { scopeGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkScope } from './handler.js';
export { scopeGuardMeta } from './meta.js';

export const scopeGuardFeature: FeatureModule<HookInputBase> = {
  meta: scopeGuardMeta,
  createHandler,
};
