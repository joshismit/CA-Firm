/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { NotificationChannel, NotificationTemplate } from '@prisma/client';
import { NotFoundError } from '@shared/errors';
import { NotificationTemplateRenderer } from '@modules/notifications/service/notification-template-renderer';
import { NotificationTemplateRepository } from '@modules/notifications/repository/notification-template.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NotificationTemplateRenderer — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked. Covers the lookup order (tenant override →
 * global default), the not-found/inactive throw, and `{{variable}}`
 * substitution — including the "unmatched token stays literal" rule.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';

type MockedRepository = { findByKeyAndChannel: jest.Mock; findGlobalByKeyAndChannel: jest.Mock };

function createMockRepository(): MockedRepository {
  return { findByKeyAndChannel: jest.fn().mockResolvedValue(null), findGlobalByKeyAndChannel: jest.fn().mockResolvedValue(null) };
}

function createMockTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: 'template-id',
    tenantId: null,
    key: 'password-reset',
    channel: NotificationChannel.EMAIL,
    name: 'Password Reset',
    description: null,
    subjectTemplate: 'Reset your password, {{firstName}}',
    bodyTemplateText: 'Hi {{firstName}}, reset here: {{resetUrl}}',
    bodyTemplateHtml: '<p>Hi {{firstName}}</p>',
    isActive: true,
    isSystemDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    deletedBy: null,
    ...overrides,
  };
}

function createRenderer(repo: MockedRepository): NotificationTemplateRenderer {
  return new NotificationTemplateRenderer(repo as unknown as NotificationTemplateRepository);
}

describe('NotificationTemplateRenderer', () => {
  it('prefers the tenant override over the global default', async () => {
    const repo = createMockRepository();
    repo.findByKeyAndChannel.mockResolvedValue(createMockTemplate({ bodyTemplateText: 'OVERRIDE: {{firstName}}' }));

    const renderer = createRenderer(repo);
    const result = await renderer.render(TENANT_ID, 'password-reset', NotificationChannel.EMAIL, { firstName: 'Priya' });

    expect(result.bodyText).toBe('OVERRIDE: Priya');
    expect(repo.findGlobalByKeyAndChannel).not.toHaveBeenCalled();
  });

  it('falls back to the global default when no tenant override exists', async () => {
    const repo = createMockRepository();
    repo.findGlobalByKeyAndChannel.mockResolvedValue(createMockTemplate());

    const renderer = createRenderer(repo);
    const result = await renderer.render(TENANT_ID, 'password-reset', NotificationChannel.EMAIL, {
      firstName: 'Priya',
      resetUrl: 'https://app.test/reset/abc',
    });

    expect(result.subject).toBe('Reset your password, Priya');
    expect(result.bodyText).toBe('Hi Priya, reset here: https://app.test/reset/abc');
    expect(result.bodyHtml).toBe('<p>Hi Priya</p>');
  });

  it('throws NotFoundError when neither a tenant override nor a global default exists', async () => {
    const repo = createMockRepository();

    const renderer = createRenderer(repo);

    await expect(renderer.render(TENANT_ID, 'unknown-key', NotificationChannel.EMAIL, {})).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the only matching template is inactive', async () => {
    const repo = createMockRepository();
    repo.findGlobalByKeyAndChannel.mockResolvedValue(createMockTemplate({ isActive: false }));

    const renderer = createRenderer(repo);

    await expect(renderer.render(TENANT_ID, 'password-reset', NotificationChannel.EMAIL, {})).rejects.toThrow(NotFoundError);
  });

  it('leaves an unmatched {{variable}} as literal text rather than blanking it', async () => {
    const repo = createMockRepository();
    repo.findGlobalByKeyAndChannel.mockResolvedValue(
      createMockTemplate({ bodyTemplateText: 'Hi {{firstName}}, your code is {{missingVar}}.', subjectTemplate: null }),
    );

    const renderer = createRenderer(repo);
    const result = await renderer.render(TENANT_ID, 'password-reset', NotificationChannel.EMAIL, { firstName: 'Priya' });

    expect(result.bodyText).toBe('Hi Priya, your code is {{missingVar}}.');
    expect(result.subject).toBeUndefined();
  });

  it('omits bodyHtml when the template has none (SMS/WhatsApp shape)', async () => {
    const repo = createMockRepository();
    repo.findGlobalByKeyAndChannel.mockResolvedValue(
      createMockTemplate({ channel: NotificationChannel.SMS, subjectTemplate: null, bodyTemplateHtml: null, bodyTemplateText: 'OTP: {{code}}' }),
    );

    const renderer = createRenderer(repo);
    const result = await renderer.render(TENANT_ID, 'password-reset', NotificationChannel.SMS, { code: '123456' });

    expect(result.bodyHtml).toBeUndefined();
    expect(result.bodyText).toBe('OTP: 123456');
  });
});
