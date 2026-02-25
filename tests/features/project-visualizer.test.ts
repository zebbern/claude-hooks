import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { generateProjectVisualization } from '../../src/features/project-visualizer/index.js';
import { createHandler } from '../../src/features/project-visualizer/handler.js';
import type { ToolkitConfig, SessionStartInput } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

let tempDir: string;
let outputDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-project-visualizer-test-'));
  outputDir = path.join(tempDir, 'output');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeConfig(
  maxDepth = 2,
  enabled = true,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    projectVisualizer: { outputPath: outputDir, maxDepth, enabled },
  };
}

function makeSessionStartInput(): SessionStartInput {
  return {
    session_id: 'test-session',
    source: 'startup',
  };
}

function createProjectStructure(): void {
  // Create a sample project structure
  fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export {}');
  fs.writeFileSync(path.join(tempDir, 'src', 'app.tsx'), '<App/>');
  fs.writeFileSync(path.join(tempDir, 'src', 'components', 'Button.tsx'), '<Button/>');
  fs.writeFileSync(path.join(tempDir, 'tests', 'app.test.ts'), 'test()');
  fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Project');
}

describe('project-visualizer', () => {
  describe('generateProjectVisualization', () => {
    it('generates Mermaid directory tree', () => {
      createProjectStructure();
      const result = generateProjectVisualization(tempDir, makeConfig());
      expect(result.mermaid).toContain('graph TD');
      expect(result.mermaid).toContain('src/');
      expect(result.mermaid).toContain('tests/');
    });

    it('generates file type pie chart', () => {
      createProjectStructure();
      const result = generateProjectVisualization(tempDir, makeConfig());
      expect(result.mermaid).toContain('pie title File Type Distribution');
      expect(result.fileTypes['.ts']).toBeGreaterThanOrEqual(1);
      expect(result.fileTypes['.tsx']).toBeGreaterThanOrEqual(1);
    });

    it('respects maxDepth config', () => {
      createProjectStructure();
      const result1 = generateProjectVisualization(tempDir, makeConfig(1));
      const result3 = generateProjectVisualization(tempDir, makeConfig(3));
      // Depth 1 should not include nested files inside src/
      expect(result1.mermaid).not.toContain('index.ts');
      // Depth 3 should include src/components/Button.tsx
      expect(result3.mermaid).toContain('Button');
    });

    it('skips ignored directories', () => {
      createProjectStructure();
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'node_modules', 'dep.js'), '');
      fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.git', 'HEAD'), 'ref');

      const result = generateProjectVisualization(tempDir, makeConfig());
      expect(result.mermaid).not.toContain('node_modules');
      expect(result.mermaid).not.toContain('.git');
    });

    it('limits nodes to 50', () => {
      // Create many files
      for (let i = 0; i < 60; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.ts`), `// file ${i}`);
      }
      const result = generateProjectVisualization(tempDir, makeConfig());
      // Count nodes in the mermaid output (lines with -->)
      const arrowLines = result.mermaid.split('\n').filter((l) => l.includes('-->'));
      expect(arrowLines.length).toBeLessThanOrEqual(50);
    });

    it('returns file type counts', () => {
      createProjectStructure();
      const result = generateProjectVisualization(tempDir, makeConfig());
      expect(result.fileTypes).toBeDefined();
      expect(typeof result.fileTypes).toBe('object');
      const totalFiles = Object.values(result.fileTypes).reduce((sum, n) => sum + n, 0);
      expect(totalFiles).toBeGreaterThan(0);
    });

    it('handles empty directory', () => {
      const result = generateProjectVisualization(tempDir, makeConfig());
      expect(result.mermaid).toContain('graph TD');
      expect(result.fileTypes).toBeDefined();
    });
  });

  describe('createHandler', () => {
    it('skips when disabled', async () => {
      const handler = createHandler('SessionStart');
      const result = await handler(makeSessionStartInput(), makeConfig(2, false));
      expect(result).toBeUndefined();
    });
  });
});
