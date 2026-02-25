import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readJsonlRecords, appendJsonlRecord } from '../../src/utils/jsonl.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'hooks-jsonl-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('readJsonlRecords', () => {
  it('returns empty array for non-existent file', () => {
    const result = readJsonlRecords(path.join(tempDir, 'missing.jsonl'));
    expect(result).toEqual([]);
  });

  it('parses valid JSONL records', () => {
    const filePath = path.join(tempDir, 'test.jsonl');
    fs.writeFileSync(filePath, '{"a":1}\n{"a":2}\n{"a":3}\n', 'utf-8');

    const result = readJsonlRecords<{ a: number }>(filePath);
    expect(result).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it('skips malformed lines', () => {
    const filePath = path.join(tempDir, 'test.jsonl');
    fs.writeFileSync(filePath, '{"a":1}\nnot-json\n{"a":3}\n', 'utf-8');

    const result = readJsonlRecords<{ a: number }>(filePath);
    expect(result).toEqual([{ a: 1 }, { a: 3 }]);
  });

  it('handles empty file', () => {
    const filePath = path.join(tempDir, 'empty.jsonl');
    fs.writeFileSync(filePath, '', 'utf-8');

    const result = readJsonlRecords(filePath);
    expect(result).toEqual([]);
  });

  it('handles file with only whitespace', () => {
    const filePath = path.join(tempDir, 'whitespace.jsonl');
    fs.writeFileSync(filePath, '  \n  \n', 'utf-8');

    const result = readJsonlRecords(filePath);
    expect(result).toEqual([]);
  });

  it('handles file with trailing newlines', () => {
    const filePath = path.join(tempDir, 'trailing.jsonl');
    fs.writeFileSync(filePath, '{"x":1}\n\n\n', 'utf-8');

    const result = readJsonlRecords<{ x: number }>(filePath);
    expect(result).toEqual([{ x: 1 }]);
  });
});

describe('appendJsonlRecord', () => {
  it('creates file and appends record', () => {
    const filePath = path.join(tempDir, 'append.jsonl');
    appendJsonlRecord(filePath, { key: 'value' });

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBe('{"key":"value"}\n');
  });

  it('appends multiple records', () => {
    const filePath = path.join(tempDir, 'multi.jsonl');
    appendJsonlRecord(filePath, { n: 1 });
    appendJsonlRecord(filePath, { n: 2 });
    appendJsonlRecord(filePath, { n: 3 });

    const records = readJsonlRecords<{ n: number }>(filePath);
    expect(records).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('appends to existing file', () => {
    const filePath = path.join(tempDir, 'existing.jsonl');
    fs.writeFileSync(filePath, '{"existing":true}\n', 'utf-8');

    appendJsonlRecord(filePath, { added: true });

    const records = readJsonlRecords<Record<string, boolean>>(filePath);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ existing: true });
    expect(records[1]).toEqual({ added: true });
  });
});
