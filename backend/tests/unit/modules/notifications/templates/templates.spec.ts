import { renderTemplate } from '@modules/notifications/templates';

describe('renderTemplate', () => {
  it('renders the user-invitation template with the given context', () => {
    const rendered = renderTemplate('user-invitation', {
      firstName: 'Priya',
      acceptUrl: 'https://app.example.test/invite/abc123',
      expiresAt: '2026-08-07T00:00:00.000Z',
    });

    expect(rendered.text).toContain('Hi Priya,');
    expect(rendered.text).toContain('https://app.example.test/invite/abc123');
    expect(rendered.html).toContain('https://app.example.test/invite/abc123');
  });

  it('falls back to a generic greeting when firstName is null', () => {
    const rendered = renderTemplate('user-invitation', {
      firstName: null,
      acceptUrl: 'https://app.example.test/invite/abc123',
      expiresAt: '2026-08-07T00:00:00.000Z',
    });

    expect(rendered.text.startsWith('Hi,')).toBe(true);
  });

  it('throws for an unregistered template name', () => {
    expect(() => renderTemplate('does-not-exist', {})).toThrow('Unknown email template: "does-not-exist"');
  });
});
