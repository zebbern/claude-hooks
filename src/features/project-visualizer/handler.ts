import fs from 'node:fs';
import path from 'node:path';
import type {
  HookEventType,
  HookHandler,
  HookInputBase,
  ToolkitConfig,
} from '../../types.js';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__',
]);

const MAX_NODES = 50;

interface VisualizationResult {
  mermaid: string;
  fileTypes: Record<string, number>;
}

interface TreeNode {
  name: string;
  isDirectory: boolean;
  children: TreeNode[];
}

function walkDirectory(
  dir: string,
  currentDepth: number,
  maxDepth: number,
  nodeCount: { value: number },
): TreeNode[] {
  if (currentDepth > maxDepth || nodeCount.value >= MAX_NODES) {
    return [];
  }

  const nodes: TreeNode[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (nodeCount.value >= MAX_NODES) break;

      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.isDirectory()) continue;

      nodeCount.value++;

      const node: TreeNode = {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        children: [],
      };

      if (entry.isDirectory() && currentDepth < maxDepth) {
        node.children = walkDirectory(
          path.join(dir, entry.name),
          currentDepth + 1,
          maxDepth,
          nodeCount,
        );
      }

      nodes.push(node);
    }
  } catch {
    // Skip unreadable directories
  }

  return nodes;
}

function collectFileTypes(
  dir: string,
  currentDepth: number,
  maxDepth: number,
  fileTypes: Record<string, number>,
): void {
  if (currentDepth > maxDepth) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.isDirectory()) continue;

      if (entry.isDirectory()) {
        collectFileTypes(path.join(dir, entry.name), currentDepth + 1, maxDepth, fileTypes);
      } else {
        const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
        fileTypes[ext] = (fileTypes[ext] ?? 0) + 1;
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildTreeMermaid(nodes: TreeNode[], parentId: string): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    const nodeId = `${parentId}_${sanitizeId(node.name)}`;
    const label = node.isDirectory ? `${node.name}/` : node.name;
    lines.push(`  ${parentId} --> ${nodeId}["${label}"]`);

    if (node.children.length > 0) {
      lines.push(...buildTreeMermaid(node.children, nodeId));
    }
  }

  return lines;
}

function generateTreeDiagram(projectDir: string, maxDepth: number): string {
  const nodeCount = { value: 1 }; // root counts as 1
  const nodes = walkDirectory(projectDir, 1, maxDepth, nodeCount);
  const rootName = path.basename(projectDir) || 'project';
  const rootId = sanitizeId(rootName);

  const lines = [
    '```mermaid',
    'graph TD',
    `  ${rootId}["${rootName}/"]`,
    ...buildTreeMermaid(nodes, rootId),
    '```',
  ];

  return lines.join('\n');
}

function generatePieChart(fileTypes: Record<string, number>): string {
  const entries = Object.entries(fileTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 file types

  if (entries.length === 0) {
    return '';
  }

  const lines = [
    '```mermaid',
    'pie title File Type Distribution',
  ];

  for (const [ext, count] of entries) {
    lines.push(`  "${ext}" : ${count}`);
  }

  lines.push('```');
  return lines.join('\n');
}

/**
 * Generates Mermaid diagrams visualizing the project structure.
 *
 * Produces a directory tree (graph TD) and a file type distribution (pie chart).
 * Respects `.gitignore`-style exclusions (node_modules, .git, dist, build, coverage).
 * Limits diagram nodes to 50 for readability.
 *
 * @param projectDir - The project root directory to visualize.
 * @param config - The resolved toolkit configuration.
 * @returns The Mermaid markdown and file type counts.
 */
export function generateProjectVisualization(
  projectDir: string,
  config: ToolkitConfig,
): VisualizationResult {
  const maxDepth = config.projectVisualizer.maxDepth;
  const fileTypes: Record<string, number> = {};

  collectFileTypes(projectDir, 1, maxDepth, fileTypes);

  const treeDiagram = generateTreeDiagram(projectDir, maxDepth);
  const pieChart = generatePieChart(fileTypes);

  const mermaid = [
    '# Project Structure',
    '',
    '## Directory Tree',
    '',
    treeDiagram,
    '',
    '## File Type Distribution',
    '',
    pieChart,
  ].join('\n');

  return { mermaid, fileTypes };
}

function writeVisualization(
  projectDir: string,
  config: ToolkitConfig,
): string | undefined {
  try {
    const result = generateProjectVisualization(projectDir, config);

    const outputDir = config.projectVisualizer.outputPath;
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'project-structure.md');
    fs.writeFileSync(outputPath, result.mermaid + '\n', 'utf-8');

    return result.mermaid;
  } catch {
    return undefined;
  }
}

export function createHandler(_hookType: HookEventType): HookHandler<HookInputBase> {
  return async (_input, config) => {
    try {
      if (!config.projectVisualizer.enabled) {
        return undefined;
      }

      const mermaid = writeVisualization(process.cwd(), config);
      if (!mermaid) {
        return undefined;
      }

      return {
        exitCode: 0,
        stdout: JSON.stringify({ additionalContext: mermaid }),
      };
    } catch {
      // Best-effort — never crash the hook
      return undefined;
    }
  };
}
