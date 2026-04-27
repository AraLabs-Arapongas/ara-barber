-- Rebrand 2026-04-26: SALON_OWNER → BUSINESS_OWNER no enum user_role.
-- Aplicada via MCP no cloud durante o rebrand (commit 7de5dd7); replicada
-- aqui pra Docker local + envs novas reproduzirem o estado atual.
--
-- Postgres resolve enum por OID, então CHECK constraints e RLS policies
-- que referenciam o valor literal 'SALON_OWNER' (em 0004/0005/0006/0008)
-- continuam válidas pós-rename — a label do OID muda, expressões usando
-- o valor passam a ler 'BUSINESS_OWNER' transparentemente.

alter type public.user_role rename value 'SALON_OWNER' to 'BUSINESS_OWNER';
