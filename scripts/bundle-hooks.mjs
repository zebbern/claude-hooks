/**
 * Bundle hook entry points into single-file ESM bundles using esbuild.
 *
 * Each hook script (e.g. pre-tool-use.ts) is invoked as a child process by
 * Claude Code. Bundling eliminates Node.js module resolution overhead,
 * reducing startup latency by ~100ms per invocation.
 *
 * Run after `tsc` so declaration files (.d.ts) are already in dist/hooks/.
 * esbuild overwrites only the .js files — declarations stay intact.
 *
 * Usage: node scripts/bundle-hooks.mjs
 */

import { build } from 'esbuild';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SHEBANG = '#!/usr/bin/env node';
const hooksDir = resolve('src/hooks');

const hookFiles = readdirSync(hooksDir)
  .filter(f => f.endsWith('.ts') && f !== 'run-hook.ts')
  .map(f => join(hooksDir, f));

if (hookFiles.length === 0) {
  console.error('No hook entry points found in src/hooks/');
  process.exit(1);
}

const result = await build({
  entryPoints: hookFiles,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outdir: 'dist/hooks',
  packages: 'bundle',
  sourcemap: false,
  minify: false,
  metafile: true,
  write: false,
});

// Write output files, ensuring exactly one shebang at the top.
for (const file of result.outputFiles) {
  let text = file.text;
  // Strip all shebang lines, then prepend exactly one
  text = text.replace(/^(#!.*\r?\n)+/g, '');
  text = SHEBANG + '\n' + text;
  writeFileSync(file.path, text);
}

// Report per-bundle sizes
const outputs = result.metafile.outputs;
const hookOutputs = Object.entries(outputs)
  .filter(([key]) => key.startsWith('dist/hooks/'))
  .sort(([a], [b]) => a.localeCompare(b));

let totalBytes = 0;
for (const [file, meta] of hookOutputs) {
  totalBytes += meta.bytes;
  const sizeKb = (meta.bytes / 1024).toFixed(1);
  console.log(`  ${file}  ${sizeKb} KB`);
}

const totalKb = (totalBytes / 1024).toFixed(1);
console.log(`\nBundled ${hookFiles.length} hook entry points -> dist/hooks/ (${totalKb} KB total)`);
