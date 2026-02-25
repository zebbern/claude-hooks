import type { FeatureModule, HookInputBase } from '../../types.js';
import { commandGuardMeta } from './meta.js';
import { createHandler } from './handler.js';

export { checkCommand } from './handler.js';
export { commandGuardMeta } from './meta.js';

export const commandGuardFeature: FeatureModule<HookInputBase> = {
  meta: commandGuardMeta,
  createHandler,
};
