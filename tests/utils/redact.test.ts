import { describe, it, expect } from 'vitest';
import { redactSensitiveFields } from '../../src/utils/redact.js';

describe('redactSensitiveFields', () => {
  const LONG_STRING = 'x'.repeat(250);

  it('passes through data without tool_input unchanged', () => {
    const data = { session_id: 'abc', tool_name: 'Write' };
    const result = redactSensitiveFields(data);
    expect(result).toEqual(data);
  });

  it('keeps short sensitive fields as-is', () => {
    const data = {
      tool_input: {
        content: 'short content',
        new_string: 'short',
        old_string: 'short',
      },
    };
    const result = redactSensitiveFields(data);
    expect((result.tool_input as Record<string, unknown>).content).toBe('short content');
    expect((result.tool_input as Record<string, unknown>).new_string).toBe('short');
    expect((result.tool_input as Record<string, unknown>).old_string).toBe('short');
  });

  it('truncates long content field at 200 chars with [TRUNCATED] suffix', () => {
    const data = { tool_input: { content: LONG_STRING } };
    const result = redactSensitiveFields(data);
    const truncated = (result.tool_input as Record<string, unknown>).content as string;
    expect(truncated.length).toBe(200 + ' [TRUNCATED]'.length);
    expect(truncated).toContain('[TRUNCATED]');
    expect(truncated.startsWith('x'.repeat(200))).toBe(true);
  });

  it('truncates long new_string field', () => {
    const data = { tool_input: { new_string: LONG_STRING } };
    const result = redactSensitiveFields(data);
    const truncated = (result.tool_input as Record<string, unknown>).new_string as string;
    expect(truncated).toContain('[TRUNCATED]');
  });

  it('truncates long old_string field', () => {
    const data = { tool_input: { old_string: LONG_STRING } };
    const result = redactSensitiveFields(data);
    const truncated = (result.tool_input as Record<string, unknown>).old_string as string;
    expect(truncated).toContain('[TRUNCATED]');
  });

  it('does not truncate non-sensitive fields', () => {
    const data = { tool_input: { file_path: LONG_STRING } };
    const result = redactSensitiveFields(data);
    expect((result.tool_input as Record<string, unknown>).file_path).toBe(LONG_STRING);
  });

  it('handles edits array for MultiEdit operations', () => {
    const data = {
      tool_input: {
        edits: [
          { new_string: LONG_STRING, old_string: 'short' },
          { new_string: 'short', old_string: LONG_STRING },
        ],
      },
    };
    const result = redactSensitiveFields(data);
    const edits = (result.tool_input as Record<string, unknown>).edits as Record<string, unknown>[];
    expect((edits[0]!.new_string as string)).toContain('[TRUNCATED]');
    expect(edits[0]!.old_string).toBe('short');
    expect(edits[1]!.new_string).toBe('short');
    expect((edits[1]!.old_string as string)).toContain('[TRUNCATED]');
  });

  it('does not mutate the original input', () => {
    const data = { tool_input: { content: LONG_STRING } };
    const original = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    redactSensitiveFields(data);
    expect(data).toEqual(original);
  });

  it('handles non-object tool_input gracefully', () => {
    const data = { tool_input: 'just a string' };
    const result = redactSensitiveFields(data);
    expect(result.tool_input).toBe('just a string');
  });

  it('handles null tool_input gracefully', () => {
    const data = { tool_input: null };
    const result = redactSensitiveFields(data);
    expect(result.tool_input).toBeNull();
  });

  describe('secret pattern redaction', () => {
    it('redacts Stripe-style keys in content', () => {
      const data = { tool_input: { content: 'api key: sk-live-abcdefghijklmnopqrstuvwxyz1234' } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).toContain('[REDACTED]');
      expect(content).not.toContain('sk-live-');
    });

    it('redacts GitHub tokens in new_string', () => {
      const data = { tool_input: { new_string: 'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh' } };
      const result = redactSensitiveFields(data);
      const value = (result.tool_input as Record<string, unknown>).new_string as string;
      expect(value).toContain('[REDACTED]');
      expect(value).not.toContain('ghp_');
    });

    it('redacts AWS access keys', () => {
      const data = { tool_input: { content: 'aws_key=AKIAIOSFODNN7EXAMPLE' } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).toContain('[REDACTED]');
      expect(content).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('redacts JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
      const data = { tool_input: { content: `Authorization: Bearer ${jwt}` } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).toContain('[REDACTED]');
      expect(content).not.toContain('eyJhbGci');
    });

    it('redacts Slack tokens', () => {
      const prefix = 'xoxb';
      const fakeToken = `${prefix}-1234567890-abcdefghijklmnop`;
      const data = { tool_input: { content: `slack: ${fakeToken}` } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).toContain('[REDACTED]');
      expect(content).not.toContain(prefix + '-');
    });

    it('redacts generic key=value secrets', () => {
      const data = { tool_input: { content: 'apikey=AbCdEfGhIjKlMnOpQrSt1234' } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).toContain('[REDACTED]');
    });

    it('redacts secrets in short strings (not just >200 chars)', () => {
      const data = { tool_input: { content: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh' } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).toBe('[REDACTED]');
    });

    it('redacts secrets inside MultiEdit edits array', () => {
      const data = {
        tool_input: {
          edits: [
            { new_string: 'key: sk-test-abcdefghijklmnopqrstuvwxyz1234', old_string: 'old' },
          ],
        },
      };
      const result = redactSensitiveFields(data);
      const edits = (result.tool_input as Record<string, unknown>).edits as Record<string, unknown>[];
      expect((edits[0]!.new_string as string)).toContain('[REDACTED]');
    });

    it('applies redaction before truncation', () => {
      const secret = 'ghp_' + 'A'.repeat(100);
      const longContent = secret + ' ' + '-'.repeat(200);
      const data = { tool_input: { content: longContent } };
      const result = redactSensitiveFields(data);
      const content = (result.tool_input as Record<string, unknown>).content as string;
      expect(content).not.toContain('ghp_');
      expect(content).toContain('[TRUNCATED]');
    });

    it('leaves non-secret short strings unchanged', () => {
      const data = { tool_input: { content: 'just normal code here' } };
      const result = redactSensitiveFields(data);
      expect((result.tool_input as Record<string, unknown>).content).toBe('just normal code here');
    });
  });
});
