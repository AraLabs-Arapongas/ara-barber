-- supabase/migrations/0014_professional_availability.sql
-- Disponibilidade semanal recorrente de cada profissional (janelas dentro
-- do horário do salão). Múltiplas janelas por dia permitidas (ex: manhã + tarde).
-- RLS: platform admin + staff; leitura pública de janelas disponíveis.

create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_availability_unique unique (tenant_id, professional_id, weekday, start_time),
  constraint professional_availability_time_order check (start_time < end_time)
);

create index professional_availability_prof_idx
  on public.professional_availability (professional_id, weekday);

create trigger professional_availability_touch_updated_at
  before update on public.professional_availability
  for each row execute function public.touch_updated_at();

alter table public.professional_availability enable row level security;

create policy "professional_availability_platform_admin_all" on public.professional_availability
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "professional_availability_tenant_staff_all" on public.professional_availability
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

create policy "professional_availability_public_read" on public.professional_availability
  for select using (is_available = true);
