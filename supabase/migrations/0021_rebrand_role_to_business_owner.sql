-- Rebrand 2026-04-26: SALON_OWNER → BUSINESS_OWNER no enum user_role.
-- Aplicada via MCP no cloud durante o rebrand (commit 7de5dd7); replicada
-- aqui pra Docker local + envs novas reproduzirem o estado atual.
--
-- Postgres resolve enum por OID, então CHECK constraints e RLS policies
-- que referenciam o valor literal 'SALON_OWNER' (em 0004/0005/0006/0008)
-- continuam válidas pós-rename — a label do OID muda, expressões usando
-- o valor passam a ler 'BUSINESS_OWNER' transparentemente.

alter type public.user_role rename value 'SALON_OWNER' to 'BUSINESS_OWNER';

-- Funções armazenam o body como text em pg_proc.prosrc. RENAME VALUE só atualiza
-- expressões em CHECK constraints e RLS policies — não toca em function bodies.
-- Recriar `is_tenant_staff` com a label nova evita "invalid input value for
-- enum user_role: SALON_OWNER" no runtime quando a função é chamada.
create or replace function public.is_tenant_staff(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and tenant_id = target_tenant
      and role in ('BUSINESS_OWNER','RECEPTIONIST','PROFESSIONAL')
      and is_active = true
  )
$$;
