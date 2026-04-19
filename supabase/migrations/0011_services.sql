-- supabase/migrations/0011_services.sql
-- Catálogo de serviços oferecidos pelo salão. Campos de depósito ficam
-- definidos mas sem enforcement (Fase 2 ativa cobrança real).
-- RLS: platform admin + staff. Leitura pública vem via server action dedicada
-- no Épico 5 (booking público), não direto na tabela.

create type public.deposit_type as enum ('FIXED', 'PERCENTAGE');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 480),
  price_cents integer not null check (price_cents >= 0),
  deposit_required boolean not null default false,
  deposit_type public.deposit_type,
  deposit_value_cents integer check (deposit_value_cents is null or deposit_value_cents >= 0),
  deposit_percentage integer check (
    deposit_percentage is null
    or (deposit_percentage >= 0 and deposit_percentage <= 10000)
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_tenant_idx on public.services (tenant_id);
create index services_tenant_active_idx on public.services (tenant_id, is_active);

create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

alter table public.services enable row level security;

create policy "services_platform_admin_all" on public.services
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "services_tenant_staff_all" on public.services
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
