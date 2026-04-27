-- Policy RLS: BUSINESS_OWNER pode UPDATE tenants do próprio tenant
-- (perfil público, branding, regras de agendamento). RECEPTIONIST e
-- PROFESSIONAL ficam de fora — só dono mexe nas configs do negócio.
-- Aplicada via MCP no cloud durante review code do C5-1; replicada aqui.

create policy tenants_owner_update_own on public.tenants
  for update
  using (id = public.current_tenant_id() and public.current_user_role() = 'BUSINESS_OWNER')
  with check (id = public.current_tenant_id() and public.current_user_role() = 'BUSINESS_OWNER');
