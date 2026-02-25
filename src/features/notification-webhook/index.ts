import type { FeatureModule, HookInputBase } from '../../types.js';
import { notificationWebhookMeta } from './meta.js';
import { createHandler } from './handler.js';

export { sendWebhook } from './handler.js';
export { notificationWebhookMeta } from './meta.js';

export const notificationWebhookFeature: FeatureModule<HookInputBase> = {
  meta: notificationWebhookMeta,
  createHandler,
};
