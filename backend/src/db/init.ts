// One-time schema initialization script
// Run via: npm run db:init
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawUrl = process.env.NEONDB || process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('Set NEONDB or DATABASE_URL');
  process.exit(1);
}

const url = rawUrl.includes('sslmode=')
  ? rawUrl
  : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}sslmode=require`;

const sql = neon(url);

const ddl = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

// Split on semicolons, respecting $$ dollar-quoted blocks
function splitStatements(src: string): string[] {
  const stmts: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let i = 0;

  while (i < src.length) {
    // Check for $$ delimiter
    if (src[i] === '$' && src[i + 1] === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i += 2;
      continue;
    }

    if (src[i] === ';' && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt) stmts.push(stmt);
      current = '';
      i++;
      continue;
    }

    current += src[i];
    i++;
  }

  const remaining = current.trim();
  if (remaining) stmts.push(remaining);
  return stmts;
}

(async () => {
  const statements = splitStatements(ddl);
  console.log(`Running ${statements.length} statements...`);

  for (const stmt of statements) {
    try {
      await sql.query(stmt);
    } catch (err: any) {
      // Ignore "already exists" errors from IF NOT EXISTS — Postgres still
      // raises these for some constraint/index forms in older versions
      if (err?.code === '42710' || err?.code === '42P07') continue;
      console.error('Failed on statement:', stmt.slice(0, 80));
      throw err;
    }
  }

  console.log('DB initialized successfully');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
