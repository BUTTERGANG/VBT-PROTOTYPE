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
  throw new Error('DATABASE_URL environment variable is required');
}

// Append sslmode=require if not already present (Neon requires SSL)
const databaseUrl = rawUrl.includes('sslmode=')
  ? rawUrl
  : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}sslmode=require`;

// neon() returns a tagged template literal function that:
// - Automatically parameterizes queries (prevents SQL injection)
// - Returns rows as an array of objects
// - Supports transactions via sql.begin()
const sql = neon(databaseUrl);

export default sql;
