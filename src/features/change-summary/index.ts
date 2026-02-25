import type { FeatureModule, HookInputBase } from '../../types.js';
import { changeSummaryMeta } from './meta.js';
import { createHandler } from './handler.js';

export { recordChange, generateChangeSummary } from './handler.js';
export { changeSummaryMeta } from './meta.js';

export const changeSummaryFeature: FeatureModule<HookInputBase> = {
  meta: changeSummaryMeta,
  createHandler,
};
