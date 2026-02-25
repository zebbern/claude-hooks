import type { FeatureModule, HookInputBase } from '../../types.js';
import { testRunnerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { runTestValidator, detectTestRunner } from './handler.js';
export { testRunnerMeta } from './meta.js';

export const testRunnerFeature: FeatureModule<HookInputBase> = {
  meta: testRunnerMeta,
  createHandler,
};
