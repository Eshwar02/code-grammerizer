-- 004_secure_project_files_rls.sql
--
-- SECURITY FIX (critical): public.project_files shipped with Row-Level Security
-- DISABLED, so anyone holding the public anon key (it is bundled into the
-- frontend JS) could read every user's uploaded source code directly through
-- PostgREST:  GET /rest/v1/project_files?select=*   ->  441 rows leaked.
--
-- Every other table already uses "RLS enabled + no policy" = default deny for
-- anon/authenticated. The backend talks to Supabase with the service_role key,
-- which bypasses RLS, so enabling RLS here changes nothing for the app. The
-- frontend never queries project_files directly (no supabase-js .from() call),
-- so there is no client breakage.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
