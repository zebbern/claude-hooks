import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendWebhook, isWebhookUrlSafe } from '../../src/features/notification-webhook/handler.js';
import { createHandler } from '../../src/features/notification-webhook/handler.js';
import type { HookInputBase, ToolkitConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config.js';

function makeConfig(
  url = 'https://example.com/webhook',
  events: string[] = ['Stop', 'Notification'],
  enabled = true,
  includeFullInput = false,
): ToolkitConfig {
  return {
    ...DEFAULT_CONFIG,
    webhooks: {
      url,
      events: events as ToolkitConfig['webhooks']['events'],
      enabled,
      includeFullInput,
    },
  };
}

function makeInput(): HookInputBase {
  return { session_id: 'test-session' };
}

describe('notification-webhook', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isWebhookUrlSafe', () => {
    it('accepts valid https URLs', () => {
      expect(isWebhookUrlSafe('https://example.com/webhook')).toBe(true);
    });

    it('accepts valid http URLs', () => {
      expect(isWebhookUrlSafe('http://example.com/webhook')).toBe(true);
    });

    it('rejects invalid URLs', () => {
      expect(isWebhookUrlSafe('not-a-url')).toBe(false);
    });

    it('rejects non-http protocols (ftp)', () => {
      expect(isWebhookUrlSafe('ftp://example.com/file')).toBe(false);
    });

    it('rejects file:// protocol', () => {
      expect(isWebhookUrlSafe('file:///etc/passwd')).toBe(false);
    });

    it('blocks localhost', () => {
      expect(isWebhookUrlSafe('http://localhost/hook')).toBe(false);
    });

    it('blocks 127.0.0.1', () => {
      expect(isWebhookUrlSafe('http://127.0.0.1/hook')).toBe(false);
    });

    it('blocks 0.0.0.0', () => {
      expect(isWebhookUrlSafe('http://0.0.0.0/hook')).toBe(false);
    });

    it('blocks ::1', () => {
      expect(isWebhookUrlSafe('http://[::1]/hook')).toBe(false);
    });

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isWebhookUrlSafe('http://169.254.1.1/hook')).toBe(false);
    });

    it('blocks 10.x.x.x (private)', () => {
      expect(isWebhookUrlSafe('http://10.0.0.1/hook')).toBe(false);
    });

    it('blocks 172.16.x.x (private)', () => {
      expect(isWebhookUrlSafe('http://172.16.0.1/hook')).toBe(false);
    });

    it('blocks 172.31.x.x (private)', () => {
      expect(isWebhookUrlSafe('http://172.31.255.255/hook')).toBe(false);
    });

    it('allows 172.32.x.x (not private)', () => {
      expect(isWebhookUrlSafe('http://172.32.0.1/hook')).toBe(true);
    });

    it('blocks 192.168.x.x (private)', () => {
      expect(isWebhookUrlSafe('http://192.168.1.1/hook')).toBe(false);
    });
  });

  describe('sendWebhook', () => {
    it('skips when url is empty', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig(''));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips when events array is empty', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig('https://example.com/webhook', []));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips when hookType not in events', async () => {
      await sendWebhook('PreToolUse', makeInput(), makeConfig('https://example.com/webhook', ['Stop']));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips when URL targets internal address', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig('http://127.0.0.1/hook'));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends POST when hookType matches', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig());
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('sends minimal metadata by default (no full input)', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig());
      expect(fetchSpy).toHaveBeenCalledOnce();

      const callArgs = fetchSpy.mock.calls[0]!;
      const options = callArgs[1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.hookType).toBe('Stop');
      expect(body.session_id).toBe('test-session');
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.data).toBeUndefined();
    });

    it('includes full input when includeFullInput is true', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig(
        'https://example.com/webhook', ['Stop', 'Notification'], true, true,
      ));
      expect(fetchSpy).toHaveBeenCalledOnce();

      const callArgs = fetchSpy.mock.calls[0]!;
      const options = callArgs[1] as RequestInit;
      const body = JSON.parse(options.body as string);

      expect(body.data).toBeDefined();
      expect(body.data.session_id).toBe('test-session');
    });

    it('handles fetch errors silently', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));
      await expect(sendWebhook('Stop', makeInput(), makeConfig())).resolves.toBeUndefined();
    });

    it('skips when disabled', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig('https://example.com/webhook', ['Stop'], false));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('warns on stderr when HTTP is used with includeFullInput', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig(
        'http://example.com/webhook', ['Stop', 'Notification'], true, true,
      ));
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Webhook uses HTTP with includeFullInput enabled'),
      );
    });

    it('does not warn when HTTPS is used with includeFullInput', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig(
        'https://example.com/webhook', ['Stop', 'Notification'], true, true,
      ));
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('does not warn when HTTP is used without includeFullInput', async () => {
      await sendWebhook('Stop', makeInput(), makeConfig(
        'http://example.com/webhook', ['Stop', 'Notification'], true, false,
      ));
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe('createHandler', () => {
    it('returns undefined (never blocks)', async () => {
      const handler = createHandler('Stop');
      const result = await handler(makeInput(), makeConfig());
      expect(result).toBeUndefined();
    });
  });
});
