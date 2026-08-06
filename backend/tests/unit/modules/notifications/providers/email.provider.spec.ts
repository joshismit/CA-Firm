jest.mock('@config/mail', () => ({
  mailTransport: { sendMail: jest.fn(), verify: jest.fn() },
  mailConfig: { from: '"CA Firm ERP" <noreply@cafirm.com>', defaults: { replyTo: 'noreply@cafirm.com' } },
}));

import { mailTransport } from '@config/mail';
import { EmailProvider } from '@modules/notifications/providers/email.provider';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EmailProvider — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * `mailTransport` is fully mocked — exercises only `EmailProvider`'s own
 * logic: always `isConfigured`, mapping a successful send to
 * `{success: true, providerMessageId}`, and catching (never throwing) a
 * transport failure as `{success: false, error}`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const sendMailMock = mailTransport.sendMail as jest.Mock;

describe('EmailProvider', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
  });

  it('is always configured', () => {
    expect(new EmailProvider().isConfigured).toBe(true);
  });

  it('sends via mailTransport and returns the provider message ID on success', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'msg-123' });

    const provider = new EmailProvider();
    const result = await provider.send({ to: 'staff@acme.test', subject: 'Hello', message: 'Body text' });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'staff@acme.test', subject: 'Hello', text: 'Body text' }),
    );
    expect(result).toEqual({ success: true, providerMessageId: 'msg-123' });
  });

  it('catches a transport failure and returns success: false rather than throwing', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));

    const provider = new EmailProvider();
    const result = await provider.send({ to: 'staff@acme.test', subject: 'Hello', message: 'Body text' });

    expect(result).toEqual({ success: false, error: 'SMTP connection refused' });
  });

  describe('validate/health/getCapabilities', () => {
    const verifyMock = mailTransport.verify as jest.Mock;

    beforeEach(() => {
      verifyMock.mockReset();
    });

    it('validate() is always valid — there is no "not configured" state for Email', async () => {
      await expect(new EmailProvider().validate()).resolves.toEqual({ valid: true });
    });

    it('health() reports "up" when mailTransport.verify() succeeds', async () => {
      verifyMock.mockResolvedValue(true);

      const health = await new EmailProvider().health();

      expect(health.status).toBe('up');
      expect(typeof health.latencyMs).toBe('number');
    });

    it('health() reports "down" (never throws) when mailTransport.verify() fails', async () => {
      verifyMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const health = await new EmailProvider().health();

      expect(health.status).toBe('down');
      expect(health.detail).toBe('ECONNREFUSED');
    });

    it('getCapabilities() reflects that Email supports rich text but not attachments', () => {
      expect(new EmailProvider().getCapabilities()).toEqual({
        supportsRichText: true,
        supportsAttachments: false,
        maxMessageLength: null,
      });
    });
  });
});
