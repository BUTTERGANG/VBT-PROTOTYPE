// src/db/pool.ts
// Neon serverless PostgreSQL driver
// Uses @neondatabase/serverless for HTTP-based connections (no TCP pool needed)
// Docs: https://github.com/neondatabase/serverless

import { neon, neonConfig } from '@neondatabase/serverless';

// Enable connection caching for better performance in serverless environments
neonConfig.fetchConnectionCache = true;

// Ensure DATABASE_URL has sslmode=require for Neon
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.warn('DATABASE_URL not set — API routes will return 503');
}

// Append sslmode=require if not already present (Neon requires SSL)
const databaseUrl = rawUrl
  ? (rawUrl.includes('sslmode=')
    ? rawUrl
    : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}sslmode=require`)
  : '';

// neon() returns a tagged template literal function that:
// - Automatically parameterizes queries (prevents SQL injection)
// - Returns rows as an array of objects
// - Supports transactions via sql.begin()
const neonSql = databaseUrl ? neon(databaseUrl) : null;

// Proxy that throws only when a query is actually executed
const sql = new Proxy({} as ReturnType<typeof neon>, {
  apply(_target, _thisArg, args) {
    if (!neonSql) throw new Error('DATABASE_URL not configured');
    return neonSql(...args);
  },
  get(_target, prop) {
    if (!neonSql) return undefined;
    return (neonSql as any)[prop];
  }
}) as ReturnType<typeof neon>;

export default sql;
