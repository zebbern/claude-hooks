import type { FeatureModule, HookInputBase } from '../../types.js';
import { lintValidatorMeta } from './meta.js';
import { createHandler } from './handler.js';

export { runLintValidator } from './handler.js';
export { lintValidatorMeta } from './meta.js';

export const lintValidatorFeature: FeatureModule<HookInputBase> = {
  meta: lintValidatorMeta,
  createHandler,
};
