-- supabase/migrations/0012_professional_services.sql
-- Join entre profissionais e serviços (quais serviços cada profissional executa).
-- Usado pra filtrar opções no booking público e limitar agendamentos.
-- tenant_id redundante (derivável via FK) é mantido pra simplificar RLS.

create table public.professional_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint professional_services_unique unique (tenant_id, professional_id, service_id)
);

create index professional_services_tenant_idx on public.professional_services (tenant_id);
create index professional_services_professional_idx on public.professional_services (professional_id);
create index professional_services_service_idx on public.professional_services (service_id);

alter table public.professional_services enable row level security;

create policy "professional_services_platform_admin_all" on public.professional_services
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "professional_services_tenant_staff_all" on public.professional_services
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
