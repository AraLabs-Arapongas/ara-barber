-- supabase/migrations/0009_professionals.sql
-- Equipe do salão. Liga opcionalmente a um auth.users (quando o profissional
-- tem login no portal). RLS: platform admin + staff do tenant.

create type public.commission_type as enum ('PERCENTAGE', 'FIXED');

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  display_name text,
  photo_url text,
  phone text,
  email text,
  commission_type public.commission_type not null default 'PERCENTAGE',
  commission_value integer not null default 0 check (commission_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index professionals_tenant_idx on public.professionals (tenant_id);
create index professionals_tenant_active_idx on public.professionals (tenant_id, is_active);

create trigger professionals_touch_updated_at
  before update on public.professionals
  for each row execute function public.touch_updated_at();

alter table public.professionals enable row level security;

create policy "professionals_platform_admin_all" on public.professionals
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "professionals_tenant_staff_all" on public.professionals
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
