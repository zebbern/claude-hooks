import type { FeatureMeta } from '../../types.js';

export const lintValidatorMeta: FeatureMeta = {
  name: 'lint-validator',
  hookTypes: ['PostToolUse'],
  description: 'Runs ESLint on modified files after write/edit operations',
  category: 'quality',
  configPath: 'validators.lint',
  priority: 100,
};
