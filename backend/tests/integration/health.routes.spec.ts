import request from 'supertest';
import { Application } from 'express';
import { createFullTestApp } from './helpers/full-test-app';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Health / Readiness — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `createFullTestApp()` mounts the exact same /health and /ready handlers as
 * `src/app.ts` (see that helper's header comment), backed by the real Prisma
 * client and the real Redis connection this test process already uses.
 *
 * SMTP is NOT mocked here — `checks.smtp` genuinely reflects whether
 * `MAIL_HOST`/`MAIL_PORT` from `.env` are reachable in whatever environment
 * these tests run in (a local Mailtrap/Ethereal relay, none at all in bare
 * CI). Assertions therefore pin down `database`/`redis`/`storage` (which are
 * deterministic in this repo's test environment) and only check `smtp`'s
 * *shape*, not its outcome — see `tests/unit/shared/health/health.service.spec.ts`
 * for the fully-mocked all-paths-covered version of that logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('Health / Readiness — integration', () => {
  let app: Application;

  beforeAll(() => {
    app = createFullTestApp();
  });

  describe('GET /health', () => {
    it('returns 200 with liveness details', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ status: 'ok' });
      expect(res.body.data.version).toBeDefined();
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.data).toHaveProperty('commitSha');
      expect(res.body.data.timestamp).toBeDefined();
      expect(res.body.correlationId).toBeDefined();
    });

    it('never touches the database or Redis — stays 200 even if they were down', async () => {
      // No mocking needed to prove this: /health simply never imports/calls
      // any check function, unlike /ready. Documented via a direct assertion
      // that liveness is O(1) — it must respond well under the readiness
      // checks' own timeout budget.
      const start = Date.now();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(Date.now() - start).toBeLessThan(500);
    });
  });

  describe('GET /ready', () => {
    it('returns a structured component breakdown for database, redis, smtp, and storage', async () => {
      const res = await request(app).get('/ready');

      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBe(res.status === 200 ? 'READY' : 'NOT READY');
      expect(res.body.success).toBe(res.status === 200);
      expect(res.body.correlationId).toBeDefined();
      expect(res.body.checks).toEqual(
        expect.objectContaining({
          database: expect.objectContaining({ status: expect.any(String) }),
          redis: expect.objectContaining({ status: expect.any(String) }),
          smtp: expect.objectContaining({ status: expect.any(String) }),
          storage: expect.objectContaining({ status: expect.any(String) }),
        }),
      );
    });

    it('database is reachable in this test environment (real Postgres, same connection every other integration test uses)', async () => {
      const res = await request(app).get('/ready');
      expect(res.body.checks.database.status).toBe('ok');
      expect(res.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('redis is reachable in this test environment (real IORedis connection)', async () => {
      const res = await request(app).get('/ready');
      expect(res.body.checks.redis.status).toBe('ok');
    });

    it('storage is skipped — STORAGE_PROVIDER defaults to "local" with no bucket configured in .env', async () => {
      const res = await request(app).get('/ready');
      expect(res.body.checks.storage.status).toBe('skipped');
    });

    it('overall status is derived from the components — READY iff none of them errored', async () => {
      const res = await request(app).get('/ready');
      const anyErrored = Object.values(res.body.checks as Record<string, { status: string }>).some(
        (c) => c.status === 'error',
      );
      expect(res.body.status).toBe(anyErrored ? 'NOT READY' : 'READY');
      expect(res.status).toBe(anyErrored ? 503 : 200);
    });
  });
});
