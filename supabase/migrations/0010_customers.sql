-- supabase/migrations/0010_customers.sql
-- Clientes do salão. Todo cliente TEM conta auth.users — booking exige login
-- (OTP por e-mail na Fase 1; Google OAuth entra em fase futura). Um mesmo
-- auth.user pode ser cliente em múltiplos tenants, cada um com seu próprio
-- registro em customers (phone, notes, etc são por-tenant).
--
-- name e phone são nullable: o registro nasce no primeiro login no tenant
-- (auto-insert após OTP), sem dados. name vem do Google ou do popup de confirm
-- de booking; phone só do popup. /clientes do salão lista todos os logados
-- mesmo sem agendamento, mostrando "(sem nome)" quando vazio.
--
-- RLS: platform admin + staff do tenant; além disso o próprio customer pode
-- ler/editar o próprio registro (self-service futuro).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  phone text,
  whatsapp text,
  email text,
  birth_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_user_tenant_unique unique (tenant_id, user_id)
);

create index customers_tenant_idx on public.customers (tenant_id);
create index customers_tenant_phone_idx on public.customers (tenant_id, phone);
create index customers_user_idx on public.customers (user_id);

create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

alter table public.customers enable row level security;

create policy "customers_platform_admin_all" on public.customers
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "customers_tenant_staff_all" on public.customers
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "customers_self_read" on public.customers
  for select
  using (user_id = auth.uid());

create policy "customers_self_update" on public.customers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
