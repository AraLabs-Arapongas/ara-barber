-- supabase/migrations/0005_helper_functions.sql
-- Funções helper chamadas pelas RLS policies.
-- Moradia: schema public (cloud Supabase não permite criar funções em auth).
-- Todas security definer (rodam como owner para enxergar user_profiles sem loop de RLS).

-- Retorna o tenant_id do usuário logado (staff). NULL para customer ou platform admin.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_tenant_id() to authenticated, anon;

-- Retorna a role do usuário logado.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

grant execute on function public.current_user_role() to authenticated, anon;

-- É platform admin ativo?
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'PLATFORM_ADMIN' and is_active = true
  )
$$;

grant execute on function public.is_platform_admin() to authenticated, anon;

-- É staff ativo de um tenant específico?
create or replace function public.is_tenant_staff(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and tenant_id = target_tenant
      and role in ('SALON_OWNER','RECEPTIONIST','PROFESSIONAL')
      and is_active = true
  )
$$;

grant execute on function public.is_tenant_staff(uuid) to authenticated, anon;
