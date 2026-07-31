/**
 * SmsProvider — Unit Tests. Mirrors `whatsapp.provider.spec.ts` exactly —
 * same unconfigured/configured/non-2xx cases, same reason for
 * `jest.resetModules()` + `jest.doMock('@config/environment', ...)` per test.
 */

jest.mock('@config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

const globalFetch = global.fetch;

afterEach(() => {
  jest.resetModules();
  global.fetch = globalFetch;
});

export {};

describe('SmsProvider', () => {
  it('is not configured when SMS_API_URL/KEY are unset (the real default today)', async () => {
    jest.doMock('@config/environment', () => ({ env: {} }));
    const { SmsProvider } = await import('@modules/notifications/providers/sms.provider');

    const provider = new SmsProvider();
    expect(provider.isConfigured).toBe(false);

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.send({ to: '+919876543210', subject: 'Reminder', message: 'Your GST return is due.' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'SMS is not configured for this firm yet.' });
  });

  it('POSTs to the configured URL and returns the provider message ID on success', async () => {
    jest.doMock('@config/environment', () => ({
      env: { SMS_API_URL: 'https://sms.example.test/v1/send', SMS_API_KEY: 'test-key', SMS_SENDER_ID: 'CAFIRM' },
    }));
    const { SmsProvider } = await import('@modules/notifications/providers/sms.provider');

    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ id: 'sms-123' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new SmsProvider();
    expect(provider.isConfigured).toBe(true);

    const result = await provider.send({ to: '+919876543210', subject: 'Reminder', message: 'Your GST return is due.' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sms.example.test/v1/send',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) }),
    );
    expect(result).toEqual({ success: true, providerMessageId: 'sms-123' });
  });

  it('returns success: false (never throws) when the provider responds with a non-2xx status', async () => {
    jest.doMock('@config/environment', () => ({
      env: { SMS_API_URL: 'https://sms.example.test/v1/send', SMS_API_KEY: 'test-key' },
    }));
    const { SmsProvider } = await import('@modules/notifications/providers/sms.provider');

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const provider = new SmsProvider();
    const result = await provider.send({ to: '+919876543210', subject: 'Reminder', message: 'Body' });

    expect(result).toEqual({ success: false, error: 'SMS provider responded with 500' });
  });
});
