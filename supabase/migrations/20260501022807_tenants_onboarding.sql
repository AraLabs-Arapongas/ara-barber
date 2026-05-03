-- Backfill da migration que foi aplicada via MCP no cloud em 2026-05-01
-- mas sem arquivo local correspondente. Recuperada via inspeção do
-- schema cloud. Adiciona suporte a onboarding tracking pra owners
-- novos terem fluxo guiado de setup inicial.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_step text;

COMMENT ON COLUMN public.tenants.onboarding_completed_at IS
  'Quando o owner concluiu (ou skipou) o onboarding. NULL = ainda não viu.';
COMMENT ON COLUMN public.tenants.onboarding_step IS
  'Estado do onboarding: NULL (nunca viu modal), "tour" (entrou em modo guiado), "skipped" (pulou). Null/skipped não disparam wizard de novo.';
