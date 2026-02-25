import type { FeatureMeta } from '../../types.js';

export const rateLimiterMeta: FeatureMeta = {
  name: 'rate-limiter',
  hookTypes: ['PreToolUse'],
  description: 'Limits tool calls per session to prevent runaway automation',
  category: 'security',
  configPath: 'rateLimiter',
  priority: 3,
};
