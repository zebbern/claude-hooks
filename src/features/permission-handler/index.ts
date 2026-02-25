import type { FeatureModule, HookInputBase } from '../../types.js';
import { permissionHandlerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { permissionHandlerMeta } from './meta.js';

export const permissionHandlerFeature: FeatureModule<HookInputBase> = {
  meta: permissionHandlerMeta,
  createHandler,
};
