-- supabase/migrations/0013_business_hours.sql
-- Horário padrão de funcionamento do salão (1 linha por dia da semana, 0=dom).
-- RLS: platform admin + staff para escrita; leitura pública em dias abertos
-- (anônimos consultam horário pra booking sem login).

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_hours_unique unique (tenant_id, weekday),
  constraint business_hours_time_order check (start_time < end_time)
);

create index business_hours_tenant_idx on public.business_hours (tenant_id);

create trigger business_hours_touch_updated_at
  before update on public.business_hours
  for each row execute function public.touch_updated_at();

alter table public.business_hours enable row level security;

create policy "business_hours_platform_admin_all" on public.business_hours
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "business_hours_tenant_staff_all" on public.business_hours
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "business_hours_public_read" on public.business_hours
  for select
  using (is_open = true);
