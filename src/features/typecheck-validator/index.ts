import type { FeatureModule, HookInputBase } from '../../types.js';
import { typecheckValidatorMeta } from './meta.js';
import { createHandler } from './handler.js';

export { runTypecheckValidator } from './handler.js';
export { typecheckValidatorMeta } from './meta.js';

export const typecheckValidatorFeature: FeatureModule<HookInputBase> = {
  meta: typecheckValidatorMeta,
  createHandler,
};
