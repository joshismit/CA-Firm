import { env } from './environment';

/**
 * JWT configuration.
 * Access tokens: short-lived (15m) — used for API auth.
 * Refresh tokens: long-lived (7d) — used to issue new access tokens.
 */
export const jwtConfig = {
  access: {
    secret: env.JWT_ACCESS_SECRET,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  },
  refresh: {
    secret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
} as const;

export type JwtConfig = typeof jwtConfig;
