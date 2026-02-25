import type { FeatureMeta } from '../../types.js';

export const projectVisualizerMeta: FeatureMeta = {
  name: 'project-visualizer',
  hookTypes: ['SessionStart'],
  description: 'Generates Mermaid diagrams of project structure and file type distribution',
  category: 'integration',
  configPath: 'projectVisualizer',
  priority: 215,
};
