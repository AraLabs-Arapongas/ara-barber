-- supabase/migrations/0004_user_profiles.sql
-- Perfil de staff (owner/recepção/profissional) + platform admin.
-- Customers NÃO usam user_profiles (a tabela customers do Épico 3 é por tenant).

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.user_role not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Platform admin NÃO tem tenant_id; staff OBRIGATORIAMENTE tem tenant_id.
  constraint user_profiles_role_tenant_check check (
    (role = 'PLATFORM_ADMIN' and tenant_id is null) or
    (role in ('SALON_OWNER','RECEPTIONIST','PROFESSIONAL') and tenant_id is not null) or
    (role = 'CUSTOMER' and tenant_id is null)
  )
);

create index user_profiles_tenant_idx on public.user_profiles (tenant_id);
create index user_profiles_role_idx on public.user_profiles (role);

create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

alter table public.user_profiles enable row level security;
