import type { ReportFormat } from '../types.js';
import { builtInFeatures } from '../features/index.js';
import * as terminal from './terminal.js';
import * as json from './json.js';

export interface Reporter {
  formatJson: (data: unknown) => string;
  formatHookList: typeof terminal.formatHookList;
  formatPresetList: typeof terminal.formatPresetList;
  formatGuardList: typeof terminal.formatGuardList;
  formatValidatorList: typeof terminal.formatValidatorList;
  formatSettings: typeof terminal.formatSettings;
  formatTestResult: typeof terminal.formatTestResult;
  formatInitSuccess: typeof terminal.formatInitSuccess;
  formatFeatureList: typeof terminal.formatFeatureList;
}

/**
 * Factory that returns a reporter matching the requested output format.
 *
 * - `'terminal'` — Human-readable, colorized output for the console.
 * - `'json'` — Machine-readable JSON output.
 *
 * @param format - The output format (`'terminal'` or `'json'`).
 * @returns A {@link Reporter} instance with format-specific rendering methods.
 */
export function createReporter(format: ReportFormat): Reporter {
  if (format === 'json') {
    return {
      formatJson: json.formatJson,
      formatHookList: (hooks) => json.formatJson(hooks),
      formatPresetList: () => json.formatJson(['minimal', 'security', 'quality', 'full']),
      formatGuardList: () => json.formatJson(
        builtInFeatures.filter((f) => f.meta.name.includes('-guard')).map((f) => f.meta.name),
      ),
      formatValidatorList: () => json.formatJson(
        builtInFeatures.filter((f) => f.meta.name.includes('-validator')).map((f) => f.meta.name),
      ),
      formatSettings: (settings) => json.formatJson(settings),
      formatTestResult: (_hookType, exitCode, stdout, stderr) =>
        json.formatJson({ exitCode, stdout, stderr }),
      formatInitSuccess: (projectDir, preset) =>
        json.formatJson({ success: true, projectDir, preset }),
      formatFeatureList: (features, config, _verbose) =>
        json.formatJson(features.map((f) => ({
          name: f.name,
          category: f.category,
          description: f.description,
          configPath: f.configPath,
          hookTypes: f.hookTypes,
          priority: f.priority,
          enabled: !f.configPath || (() => {
            const parts = f.configPath.split('.');
            let cur: unknown = config;
            for (const p of parts) {
              if (typeof cur !== 'object' || cur === null) return true;
              cur = (cur as Record<string, unknown>)[p];
            }
            if (typeof cur === 'object' && cur !== null && 'enabled' in cur) {
              return (cur as { enabled: boolean }).enabled;
            }
            return true;
          })(),
        }))),
    };
  }

  return {
    formatJson: json.formatJson,
    formatHookList: terminal.formatHookList,
    formatPresetList: terminal.formatPresetList,
    formatGuardList: terminal.formatGuardList,
    formatValidatorList: terminal.formatValidatorList,
    formatSettings: terminal.formatSettings,
    formatTestResult: terminal.formatTestResult,
    formatInitSuccess: terminal.formatInitSuccess,
    formatFeatureList: terminal.formatFeatureList,
  };
}

export { terminal, json };
