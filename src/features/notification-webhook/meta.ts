import type { FeatureMeta } from '../../types.js';

export const notificationWebhookMeta: FeatureMeta = {
  name: 'notification-webhook',
  hookTypes: ['Stop', 'Notification'],
  description: 'Sends webhook notifications for configured hook events via HTTP POST',
  category: 'integration',
  configPath: 'webhooks',
  priority: 950,
};
