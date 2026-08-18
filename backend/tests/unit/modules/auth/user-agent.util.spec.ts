import { detectBrowser, detectOs } from '@modules/auth/utils/user-agent.util';

describe('user-agent.util', () => {
  describe('detectBrowser', () => {
    it('detects Chrome', () => {
      expect(detectBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')).toBe(
        'Chrome',
      );
    });

    it('detects Firefox', () => {
      expect(detectBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0')).toBe('Firefox');
    });

    it('detects Edge before Chrome (Edge UA also contains "Chrome/")', () => {
      expect(detectBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')).toBe('Edge');
    });

    it('returns null for an unrecognised or missing user agent', () => {
      expect(detectBrowser('SomeCustomBot/1.0')).toBeNull();
      expect(detectBrowser(null)).toBeNull();
      expect(detectBrowser(undefined)).toBeNull();
    });
  });

  describe('detectOs', () => {
    it('detects Windows', () => {
      expect(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    });

    it('detects macOS', () => {
      expect(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
    });

    it('detects Android', () => {
      expect(detectOs('Mozilla/5.0 (Linux; Android 13; Pixel 7)')).toBe('Android');
    });

    it('detects iOS', () => {
      expect(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS');
    });

    it('returns null for an unrecognised or missing user agent', () => {
      expect(detectOs('SomeCustomBot/1.0')).toBeNull();
      expect(detectOs(null)).toBeNull();
    });
  });
});
