import type { FeatureModule, HookInputBase } from '../../types.js';
import { fileBackupMeta } from './meta.js';
import { createHandler } from './handler.js';

export { backupFile } from './handler.js';
export { fileBackupMeta } from './meta.js';

export const fileBackupFeature: FeatureModule<HookInputBase> = {
  meta: fileBackupMeta,
  createHandler,
};
