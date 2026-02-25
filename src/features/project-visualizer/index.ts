import type { FeatureModule, HookInputBase } from '../../types.js';
import { projectVisualizerMeta } from './meta.js';
import { createHandler } from './handler.js';

export { generateProjectVisualization } from './handler.js';
export { projectVisualizerMeta } from './meta.js';

export const projectVisualizerFeature: FeatureModule<HookInputBase> = {
  meta: projectVisualizerMeta,
  createHandler,
};
