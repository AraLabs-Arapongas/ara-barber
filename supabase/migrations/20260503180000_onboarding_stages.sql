-- Wizard de onboarding agora tem 3 etapas independentes:
--   Etapa 1: configurar negócio (existente, usa onboarding_completed_at)
--   Etapa 2: personalizar marca + página pública (NOVA)
--   Etapa 3: comunicação — templates email/whatsapp + push (NOVA)
-- Cada etapa pode ser concluída independentemente. Banner mostra
-- progresso da etapa em curso. Default NULL = não concluída.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_branding_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS onboarding_communication_completed_at TIMESTAMPTZ NULL;
