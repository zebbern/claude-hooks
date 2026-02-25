import type { FeatureMeta } from '../../types.js';

export const typecheckValidatorMeta: FeatureMeta = {
  name: 'typecheck-validator',
  hookTypes: ['PostToolUse'],
  description: 'Runs TypeScript compiler (tsc --noEmit) to verify type safety',
  category: 'quality',
  configPath: 'validators.typecheck',
  priority: 110,
};
