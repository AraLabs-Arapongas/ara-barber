-- Estende check constraint de onboarding_step pra aceitar os novos
-- valores das Etapas 2 e 3 do wizard. Também aceita 'tour' e 'skipped'
-- usados pelo welcome modal.
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_onboarding_step_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_onboarding_step_check
  CHECK (
    onboarding_step IS NULL
    OR onboarding_step IN (
      -- Welcome modal
      'tour', 'skipped',
      -- Stage 1
      'hours', 'services', 'professionals', 'links',
      -- Stage 2
      'brand', 'landing',
      -- Stage 3
      'email', 'whatsapp', 'push'
    )
  );
