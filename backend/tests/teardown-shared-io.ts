/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared-connection teardown — registered via `setupFilesAfterEnv`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `@config/redis` opens a real, persistent ioredis connection the moment the
 * module is loaded, and `@config/queue`'s BullMQ `Queue`s share that same
 * connection. No test in this suite means to talk to real Redis, but plenty
 * load it by accident: `TaskService`'s constructor defaults
 * `notificationDispatchService` to `new NotificationDispatchService()`
 * (imports `@config/queue`), and several unit tests reach a module's barrel
 * (e.g. `@modules/business`) which re-exports its router — pulling in the
 * real middleware chain along with it. Since each test file gets its own
 * module registry, any file that happens to load either module ends up
 * holding an open socket that nothing closes, and Jest hangs forever after
 * the run finishes instead of exiting.
 *
 * This runs after every test file and closes them if (and only if) that file
 * actually loaded them, using `require.cache` so files that never touch
 * Redis don't pay for a connection they never opened.
 */
/**
 * `Queue#close()` only awaits the shared client's in-flight connection
 * attempt when the client's `status` is already `'ready'` — otherwise it
 * skips straight to detaching its listeners while that connection attempt
 * is still settling in the background. Quitting the shared client right
 * after leaves that attempt to fail on its own later (because quitting
 * cancels it), and by then every queue has already stripped its own
 * listeners, so the rejection has nowhere to go but an unhandled 'error'
 * throw. Waiting for `'ready'` first keeps `close()` on its
 * fully-awaited path, so this never happens.
 */
async function waitUntilSettled(client: import('ioredis').default, timeoutMs = 5000): Promise<void> {
  if (client.status === 'ready' || client.status === 'wait' || client.status === 'end') return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    client.once('ready', done);
    client.once('end', done);
    client.once('error', done);
  });
}

afterAll(async () => {
  const redisPath = require.resolve('@config/redis');
  const redisLoaded = Boolean(require.cache[redisPath]);
  if (redisLoaded) {
    const { redis } = require(redisPath) as typeof import('../src/config/redis');
    await waitUntilSettled(redis);
  }

  const queuePath = require.resolve('@config/queue');
  if (require.cache[queuePath]) {
    const queues = require(queuePath) as typeof import('../src/config/queue');
    await Promise.all(
      [
        queues.emailQueue,
        queues.notificationQueue,
        queues.reportQueue,
        queues.auditQueue,
        queues.documentProcessingQueue,
        queues.taskReminderQueue,
      ].map((queue) => queue.close()),
    );
  }

  if (redisLoaded) {
    const { redis } = require(redisPath) as typeof import('../src/config/redis');
    if (redis.status !== 'end') {
      await redis.quit().catch(() => undefined);
    }
  }
});
