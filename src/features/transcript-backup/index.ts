import type { FeatureModule, HookInputBase } from '../../types.js';
import { transcriptBackupMeta } from './meta.js';
import { createHandler } from './handler.js';

export { backupTranscript } from './handler.js';
export { transcriptBackupMeta } from './meta.js';

export const transcriptBackupFeature: FeatureModule<HookInputBase> = {
  meta: transcriptBackupMeta,
  createHandler,
};
