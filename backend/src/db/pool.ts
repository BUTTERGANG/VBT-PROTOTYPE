// src/db/pool.ts
// Neon serverless PostgreSQL driver
// Uses @neondatabase/serverless for HTTP-based connections (no TCP pool needed)
// Docs: https://github.com/neondatabase/serverless

import { neon, neonConfig } from '@neondatabase/serverless';

// Enable connection caching for better performance in serverless environments
neonConfig.fetchConnectionCache = true;

// Accept either DATABASE_URL or NEONDB secret name
const rawUrl = process.env.NEONDB || process.env.DATABASE_URL || null;
if (!rawUrl) {
  console.warn('No database URL found (NEONDB or DATABASE_URL) — API routes will return 503');
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

// Wrapper: defers "no DATABASE_URL" error to query time so the server
// can start (health check, static file serving) without a database.
function sql(strings: TemplateStringsArray, ...values: any[]) {
  if (!neonSql) throw new Error('Database not configured — set NEONDB or DATABASE_URL');
  return neonSql(strings, ...values);
}

// Forward .transaction() and other Neon methods when available
sql.transaction = neonSql ? neonSql.transaction.bind(neonSql) : undefined as any;

export default sql;
