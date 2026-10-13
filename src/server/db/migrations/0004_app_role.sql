-- A dedicated, least-privilege role for the running application.
--
-- Why a separate role: Supabase's poolers ignore connection-level settings (startup options and
-- postgres.js's `connection` option are dropped), so a per-role setting is the one way to give the
-- app's connections a server-side statement timeout that survives the transaction pooler. Giving it
-- to a role used only by the app means migrations and the seed (which connect as `postgres` through
-- DIRECT_URL) are not affected by it.
--
-- BYPASSRLS keeps the security model unchanged: row level security stays enabled on every table
-- with no policies, which blocks Supabase's public REST API, while this server-side role still works.
--
-- The role is created without a password. Set one out of band (see README, "Database setup"):
--   ALTER ROLE salary_app PASSWORD '...';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salary_app') THEN
    CREATE ROLE salary_app LOGIN BYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
ALTER ROLE salary_app SET statement_timeout = '15s';
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO salary_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "employees" TO salary_app;
--> statement-breakpoint
GRANT SELECT ON "countries" TO salary_app;
