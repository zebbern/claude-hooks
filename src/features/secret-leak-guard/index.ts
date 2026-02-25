import type { FeatureModule, HookInputBase } from '../../types.js';
import { secretLeakGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkSecretLeak } from './handler.js';
export { secretLeakGuardMeta } from './meta.js';

export const secretLeakGuardFeature: FeatureModule<HookInputBase> = {
  meta: secretLeakGuardMeta,
  createHandler,
};
