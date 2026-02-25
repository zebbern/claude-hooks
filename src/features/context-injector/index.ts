import type { FeatureModule, HookInputBase } from '../../types.js';
import { contextInjectorMeta } from './meta.js';
import { createHandler } from './handler.js';

export { injectContext } from './handler.js';
export { contextInjectorMeta } from './meta.js';

export const contextInjectorFeature: FeatureModule<HookInputBase> = {
  meta: contextInjectorMeta,
  createHandler,
};
