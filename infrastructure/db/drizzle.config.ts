import { defineConfig } from 'drizzle-kit';

// WHY: schema.ts is a placeholder until Phase 1B Block 018 lands the
// first real schema (tenants + users). drizzle-kit tolerates the
// missing file for `migrate` / `studio`; only `generate` and `push`
// require it.
export default defineConfig({
  dialect: 'postgresql',
  schema: './schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  strict: true,
  verbose: true,
});
