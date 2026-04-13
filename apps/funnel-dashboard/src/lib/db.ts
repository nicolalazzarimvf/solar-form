import { Pool } from 'pg';

function connectionNeedsSsl(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  return (
    connectionString.includes('amazonaws.com') ||
    connectionString.includes('heroku') ||
    connectionString.includes('neon.tech') ||
    /sslmode=require/i.test(connectionString)
  );
}

const globalForPool = globalThis as unknown as { funnelPool?: Pool };

/** Vercel / Lambda: one small pool per warm isolate; never 10× per request. */
function defaultPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 20);
  }
  const serverless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  return serverless ? 1 : 10;
}

export function getPool(): Pool {
  if (globalForPool.funnelPool) return globalForPool.funnelPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const max = defaultPoolMax();
  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: max <= 2 ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: max <= 2,
    ssl: connectionNeedsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  globalForPool.funnelPool = pool;
  return pool;
}
