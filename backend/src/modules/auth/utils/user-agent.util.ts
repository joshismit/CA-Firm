/**
 * Best-effort browser/OS detection from a raw User-Agent string. Deliberately not a full UA-parser
 * library (none is a project dependency) — a handful of ordered substring checks covering the
 * overwhelming majority of real traffic. Returns `null` for anything unrecognised rather than
 * guessing, so `UserSession.browser`/`.os` stay honest (never a fabricated value).
 */

const BROWSER_PATTERNS: Array<[RegExp, string]> = [
  [/edg\//i, 'Edge'],
  [/opr\//i, 'Opera'],
  [/chrome\//i, 'Chrome'],
  [/firefox\//i, 'Firefox'],
  [/safari\//i, 'Safari'],
];

const OS_PATTERNS: Array<[RegExp, string]> = [
  [/windows nt/i, 'Windows'],
  // Checked before the macOS pattern: an iPhone/iPad UA always includes a "like Mac OS X"
  // compatibility string, which would otherwise false-match as macOS.
  [/iphone|ipad/i, 'iOS'],
  [/mac os x/i, 'macOS'],
  [/android/i, 'Android'],
  [/linux/i, 'Linux'],
];

export function detectBrowser(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return BROWSER_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

export function detectOs(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}
