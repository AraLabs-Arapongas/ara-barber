-- Permite que o mesmo user tenha profile em vários tenants
-- (ex: contador atende várias clínicas, dono com 2 negócios, demo
-- account em N tenants pra showcase). RLS continua isolando por
-- tenant_id; o que muda é só a constraint UNIQUE.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;

-- Substitui por (user_id, tenant_id) único. NULLS NOT DISTINCT (PG 15+)
-- garante que (user, NULL) é único também — previne 2 PLATFORM_ADMIN
-- profiles pro mesmo user.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_tenant_unique
  ON public.user_profiles (user_id, tenant_id) NULLS NOT DISTINCT;

-- current_user_role() antes fazia LIMIT 1 sem filtrar tenant — com
-- multi-tenant per user ia retornar role arbitrária e furar RLS
-- (user BUSINESS_OWNER em A + PROFESSIONAL em B, visitando B,
-- recebia 'BUSINESS_OWNER' de A e passava em policies que não devia).
-- Filtra explicitamente pelo tenant atual; pra PLATFORM_ADMIN
-- (current_tenant_id IS NULL), busca profile com tenant_id NULL.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_profiles
   WHERE user_id = auth.uid()
     AND (
       tenant_id = current_tenant_id()
       OR (current_tenant_id() IS NULL AND tenant_id IS NULL)
     )
   LIMIT 1
$$;
