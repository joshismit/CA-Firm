/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WhatsAppProvider — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Two states matter: unconfigured (the real default in every environment
 * today — no WHATSAPP_* env vars) short-circuits before any network call,
 * and configured makes a real-shaped `fetch` call whose success/failure maps
 * onto `NotificationSendResult`. `jest.resetModules()` + a fresh
 * `jest.doMock('@config/environment', ...)` per test is required because
 * `WhatsAppProvider.isConfigured` is computed once at module load from `env`
 * — there's no way to change it after import.
 * ─────────────────────────────────────────────────────────────────────────────
 */

jest.mock('@config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

const globalFetch = global.fetch;

afterEach(() => {
  jest.resetModules();
  global.fetch = globalFetch;
});

export {};

describe('WhatsAppProvider', () => {
  it('is not configured when WHATSAPP_API_URL/TOKEN are unset (the real default today)', async () => {
    jest.doMock('@config/environment', () => ({ env: {} }));
    const { WhatsAppProvider } = await import('@modules/notifications/providers/whatsapp.provider');

    const provider = new WhatsAppProvider();
    expect(provider.isConfigured).toBe(false);

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.send({ to: '+919876543210', subject: 'Reminder', message: 'Your GST return is due.' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'WhatsApp is not configured for this platform yet.' });
  });

  it('POSTs to the configured URL and returns the provider message ID on success', async () => {
    jest.doMock('@config/environment', () => ({
      env: { WHATSAPP_API_URL: 'https://graph.example.test/v1/messages', WHATSAPP_API_TOKEN: 'test-token', WHATSAPP_SENDER_ID: 'sender-1' },
    }));
    const { WhatsAppProvider } = await import('@modules/notifications/providers/whatsapp.provider');

    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ id: 'wamid-123' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new WhatsAppProvider();
    expect(provider.isConfigured).toBe(true);

    const result = await provider.send({ to: '+919876543210', subject: 'Reminder', message: 'Your GST return is due.' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.example.test/v1/messages',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }),
    );
    expect(result).toEqual({ success: true, providerMessageId: 'wamid-123' });
  });

  it('returns success: false (never throws) when the provider responds with a non-2xx status', async () => {
    jest.doMock('@config/environment', () => ({
      env: { WHATSAPP_API_URL: 'https://graph.example.test/v1/messages', WHATSAPP_API_TOKEN: 'test-token' },
    }));
    const { WhatsAppProvider } = await import('@modules/notifications/providers/whatsapp.provider');

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const provider = new WhatsAppProvider();
    const result = await provider.send({ to: '+919876543210', subject: 'Reminder', message: 'Body' });

    expect(result).toEqual({ success: false, error: 'WhatsApp provider responded with 401' });
  });
});
