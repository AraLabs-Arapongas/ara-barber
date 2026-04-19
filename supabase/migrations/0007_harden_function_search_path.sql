-- supabase/migrations/0007_harden_function_search_path.sql
-- Hardening: fixa search_path das funções PL/pgSQL (advisor 0011_function_search_path_mutable).
-- Sem set search_path, um atacante com CREATE em algum schema poderia shadowar objetos referenciados pela função.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;
