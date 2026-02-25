import { describe, it, expect } from 'vitest';
import { WRITE_TOOLS, WRITE_AND_EXEC_TOOLS, isWriteTool, collectWriteContent } from '../../src/utils/tool-inputs.js';

describe('WRITE_TOOLS', () => {
  it('contains Write, Edit, MultiEdit', () => {
    expect(WRITE_TOOLS.has('Write')).toBe(true);
    expect(WRITE_TOOLS.has('Edit')).toBe(true);
    expect(WRITE_TOOLS.has('MultiEdit')).toBe(true);
  });

  it('does not contain non-write tools', () => {
    expect(WRITE_TOOLS.has('Read')).toBe(false);
    expect(WRITE_TOOLS.has('Bash')).toBe(false);
    expect(WRITE_TOOLS.has('Glob')).toBe(false);
  });
});

describe('WRITE_AND_EXEC_TOOLS', () => {
  it('includes all WRITE_TOOLS plus Bash', () => {
    for (const tool of WRITE_TOOLS) {
      expect(WRITE_AND_EXEC_TOOLS.has(tool)).toBe(true);
    }
    expect(WRITE_AND_EXEC_TOOLS.has('Bash')).toBe(true);
  });
});

describe('isWriteTool', () => {
  it('returns true for write tools', () => {
    expect(isWriteTool('Write')).toBe(true);
    expect(isWriteTool('Edit')).toBe(true);
    expect(isWriteTool('MultiEdit')).toBe(true);
  });

  it('returns false for non-write tools', () => {
    expect(isWriteTool('Read')).toBe(false);
    expect(isWriteTool('Bash')).toBe(false);
  });
});

describe('collectWriteContent', () => {
  it('extracts content from Write tool', () => {
    const result = collectWriteContent({
      tool_name: 'Write',
      tool_input: { content: 'file contents here' },
    });
    expect(result).toEqual(['file contents here']);
  });

  it('returns empty array for Write with no content', () => {
    const result = collectWriteContent({
      tool_name: 'Write',
      tool_input: {},
    });
    expect(result).toEqual([]);
  });

  it('extracts new_string from Edit tool', () => {
    const result = collectWriteContent({
      tool_name: 'Edit',
      tool_input: { new_string: 'replaced text' },
    });
    expect(result).toEqual(['replaced text']);
  });

  it('returns empty array for Edit with no new_string', () => {
    const result = collectWriteContent({
      tool_name: 'Edit',
      tool_input: {},
    });
    expect(result).toEqual([]);
  });

  it('extracts new_string from each MultiEdit edit', () => {
    const result = collectWriteContent({
      tool_name: 'MultiEdit',
      tool_input: {
        edits: [
          { new_string: 'first edit' },
          { new_string: 'second edit' },
        ],
      },
    });
    expect(result).toEqual(['first edit', 'second edit']);
  });

  it('skips MultiEdit edits without new_string', () => {
    const result = collectWriteContent({
      tool_name: 'MultiEdit',
      tool_input: {
        edits: [
          { new_string: 'valid' },
          { old_string: 'no new_string here' },
          { new_string: '' },
        ],
      },
    });
    expect(result).toEqual(['valid']);
  });

  it('handles MultiEdit with non-array edits', () => {
    const result = collectWriteContent({
      tool_name: 'MultiEdit',
      tool_input: { edits: 'not-an-array' },
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for non-write tools', () => {
    const result = collectWriteContent({
      tool_name: 'Read',
      tool_input: { content: 'should be ignored' },
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for Bash tool', () => {
    const result = collectWriteContent({
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
    expect(result).toEqual([]);
  });

  it('handles Write with non-string content', () => {
    const result = collectWriteContent({
      tool_name: 'Write',
      tool_input: { content: 42 },
    });
    expect(result).toEqual([]);
  });
});
