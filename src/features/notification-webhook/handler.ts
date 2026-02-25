import type { HookEventType, HookHandler, HookInputBase, ToolkitConfig } from '../../types.js';

/** Protocols permitted for webhook URLs. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Regex patterns matching private/internal IPv4 ranges and localhost.
 * Used to block SSRF attempts targeting internal infrastructure.
 */
const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
];

/**
 * Validates a webhook URL for safety.
 * Rejects invalid URLs, non-HTTP(S) protocols, and internal/private addresses.
 *
 * @returns `true` if the URL is safe to call, `false` otherwise.
 */
export function isWebhookUrlSafe(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  const hostname = parsed.hostname;
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return false;
    }
  }

  return true;
}

/**
 * Sends a webhook notification for the given hook event.
 *
 * POSTs a JSON body containing `hookType`, `timestamp`, and `session_id` to the
 * configured URL. By default only minimal event metadata is sent. Set
 * `webhooks.includeFullInput: true` in config to include the full hook input.
 *
 * URL validation blocks SSRF attempts (internal IPs, non-HTTP protocols).
 * Fire-and-forget — errors are silently caught.
 *
 * @param hookType - The current hook event type.
 * @param input - The hook input data.
 * @param config - The resolved toolkit configuration.
 */
export async function sendWebhook(
  hookType: HookEventType,
  input: HookInputBase,
  config: ToolkitConfig,
): Promise<void> {
  try {
    if (!config.webhooks.enabled) return;
    if (!config.webhooks.url) return;
    if (config.webhooks.events.length === 0) return;
    if (!config.webhooks.events.includes(hookType)) return;

    if (!isWebhookUrlSafe(config.webhooks.url)) return;

    const url = new URL(config.webhooks.url);
    if (url.protocol === 'http:' && config.webhooks.includeFullInput) {
      process.stderr.write(
        '[claude-hooks] WARNING: Webhook uses HTTP with includeFullInput enabled. Data will be sent in plaintext. Consider using HTTPS.\n',
      );
    }

    const body: Record<string, unknown> = {
      hookType,
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
    };

    if (config.webhooks.includeFullInput) {
      body.data = { ...input };
    }

    fetch(config.webhooks.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Fire-and-forget — silently ignore errors
    });
  } catch {
    // Best-effort — never crash the hook
  }
}

export function createHandler(hookType: HookEventType): HookHandler<HookInputBase> {
  return async (input, config) => {
    await sendWebhook(hookType, input, config);
    return undefined;
  };
}
