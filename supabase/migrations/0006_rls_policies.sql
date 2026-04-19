-- supabase/migrations/0006_rls_policies.sql
-- Policies RLS base: plans (global), tenants (isolamento por tenant), user_profiles (self + staff tenant).

-- ========================================
-- plans: leitura livre para autenticados; escrita só platform admin.
-- ========================================
create policy "plans_read_authenticated" on public.plans
  for select
  using (auth.uid() is not null);

create policy "plans_write_platform_admin" on public.plans
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ========================================
-- tenants: platform admin vê/edita tudo; staff vê apenas o próprio tenant.
-- ========================================
create policy "tenants_platform_admin_all" on public.tenants
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenants_staff_read_own" on public.tenants
  for select
  using (id = public.current_tenant_id());

-- ========================================
-- user_profiles
-- ========================================
-- Platform admin tem acesso total.
create policy "user_profiles_platform_admin_all" on public.user_profiles
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Usuário lê o próprio perfil.
create policy "user_profiles_self_read" on public.user_profiles
  for select
  using (user_id = auth.uid());

-- Staff do tenant lê perfis do mesmo tenant.
create policy "user_profiles_tenant_staff_read" on public.user_profiles
  for select
  using (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
  );

-- Owner escreve perfis do próprio tenant (adição/remoção manual de staff).
create policy "user_profiles_owner_write" on public.user_profiles
  for all
  using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() = 'SALON_OWNER'
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() = 'SALON_OWNER'
  );
