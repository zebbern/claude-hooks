import type { FeatureModule, HookInputBase } from '../../types.js';
import { loggerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { logHookEvent } from './handler.js';
export { loggerMeta } from './meta.js';

export const loggerFeature: FeatureModule<HookInputBase> = {
  meta: loggerMeta,
  createHandler,
};
