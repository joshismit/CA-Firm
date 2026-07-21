import path from 'path';
import dotenv from 'dotenv';

/**
 * Runs before the test framework is installed (Jest `setupFiles`).
 * `@shared/base` → `@config/logger` → `@config/environment` validates
 * required env vars at import time and calls `process.exit(1)` if missing,
 * so DATABASE_URL/JWT_ACCESS_SECRET/JWT_REFRESH_SECRET must be present
 * before any `src/**` module is first imported by a test file.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
