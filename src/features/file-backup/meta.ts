import type { FeatureMeta } from '../../types.js';

export const fileBackupMeta: FeatureMeta = {
  name: 'file-backup',
  hookTypes: ['PreToolUse'],
  description: 'Creates a backup of files before they are overwritten by Write/Edit/MultiEdit tools',
  category: 'tracking',
  configPath: 'fileBackup',
  priority: 5,
};
