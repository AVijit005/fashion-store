/**
 * Optional testcontainers-based Postgres/Redis bootstrap for local E2E runs.
 *
 * This helper is NOT used by default. The default E2E harness reads
 * DATABASE_URL / REDIS_URL from `.env.test`, which works with:
 *   - CI sidecar services (GitHub Actions)
 *   - `docker compose up postgres redis`
 *   - locally installed Postgres/Redis
 *
 * To use testcontainers instead, set USE_TESTCONTAINERS=1 before running tests.
 * This requires a working Docker daemon.
 */
export interface TestContainers {
  databaseUrl: string;
  redisUrl: string;
  stop: () => Promise<void>;
}

export async function startTestContainers(): Promise<TestContainers> {
  if (process.env.USE_TESTCONTAINERS !== '1') {
    throw new Error('USE_TESTCONTAINERS is not enabled');
  }

  const [{ PostgreSqlContainer }, { GenericContainer }] = await Promise.all([
    import('@testcontainers/postgresql'),
    import('testcontainers'),
  ]);

  const postgres = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('fashion_store_test')
    .withUsername('root')
    .withPassword('root')
    .withExposedPorts(5432)
    .start();

  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const databaseUrl = postgres.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  return {
    databaseUrl,
    redisUrl,
    stop: async () => {
      await postgres.stop();
      await redis.stop();
    },
  };
}
