import type { Config } from 'jest';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Jest Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Did not exist before this — `package.json`'s `test:unit`/`test:integration`/
 * `test:e2e` scripts already assumed `tests/unit`, `tests/integration`,
 * `tests/e2e`, but nothing configured ts-jest or the `@shared/*`-style path
 * aliases used throughout `src/`, so no test file could have compiled. This
 * mirrors `tsconfig.json`'s `paths` mapping exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/teardown-shared-io.ts'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@workers/(.*)$': '<rootDir>/src/workers/$1',
    '^@storage/(.*)$': '<rootDir>/src/storage/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/shared/utils/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};

export default config;
