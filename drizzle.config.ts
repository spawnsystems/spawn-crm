import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema/index.ts',
  out: './supabase/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
