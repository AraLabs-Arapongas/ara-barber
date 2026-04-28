-- Habilita pgTAP pra testes de RLS isolation cross-tenant.
-- pgTAP roda via `pnpm test:rls` (= `supabase db test`).
-- Tests vivem em supabase/tests/database/*.sql.
create extension if not exists pgtap with schema extensions;
