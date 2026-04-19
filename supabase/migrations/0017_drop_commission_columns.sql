-- supabase/migrations/0017_drop_commission_columns.sql
-- Decisão de produto: o app nunca lida com pagamento de funcionário. Todo
-- recebimento vai pra conta do tenant (dono do salão); o acerto com os
-- profissionais é privado entre dono e funcionário, fora do escopo do app.
-- Removemos as colunas e o enum pra não virar footgun futuro.

alter table public.professionals drop column if exists commission_value;
alter table public.professionals drop column if exists commission_type;

drop type if exists public.commission_type;
