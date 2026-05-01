-- Adiciona colunas pra rastrear progresso do setup wizard pós-criação de tenant.
alter table public.tenants
  add column onboarding_completed_at timestamptz null,
  add column onboarding_step text null
    check (
      onboarding_step is null
      or onboarding_step in ('hours','services','professionals','links')
    );

comment on column public.tenants.onboarding_completed_at is
  'Quando o setup wizard foi concluído. Null = ainda não completou.';
comment on column public.tenants.onboarding_step is
  'Próximo step pendente do wizard. Null = não iniciado ou já completou.';

-- Backfill: tenants existentes (já operacionais) NÃO devem cair no wizard.
-- Marca como concluído com data = created_at pra não disparar redirect/banner.
update public.tenants
set onboarding_completed_at = created_at
where created_at < now();
