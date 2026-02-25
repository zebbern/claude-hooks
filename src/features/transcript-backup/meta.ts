import type { FeatureMeta } from '../../types.js';

export const transcriptBackupMeta: FeatureMeta = {
  name: 'transcript-backup',
  hookTypes: ['PreCompact'],
  description: 'Backs up transcript files before compaction',
  category: 'tracking',
  configPath: '',
  priority: 200,
};
