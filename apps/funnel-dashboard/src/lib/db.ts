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

export function getPool(): Pool {
  if (globalForPool.funnelPool) return globalForPool.funnelPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionNeedsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  if (process.env.NODE_ENV !== 'production') {
    globalForPool.funnelPool = pool;
  }
  return pool;
}
