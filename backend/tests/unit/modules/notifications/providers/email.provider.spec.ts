jest.mock('@config/mail', () => ({
  mailTransport: { sendMail: jest.fn() },
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
});
