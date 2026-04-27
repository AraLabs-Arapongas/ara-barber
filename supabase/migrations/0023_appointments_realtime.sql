-- Habilita realtime para `appointments`. Cloud já tem (configurado via dashboard
-- na época do MVP); essa migration garante paridade no Docker local + qualquer
-- ambiente novo.
--
-- 1. Inclui appointments na publication `supabase_realtime` — sem isso o
--    Postgres nem chega a publicar mudanças no WAL pra o serviço realtime.
-- 2. Replica identity = full — sem isso, eventos DELETE/UPDATE só carregam a
--    PK no record antigo. Filtros postgres_changes do tipo
--    `filter: tenant_id=eq.X` precisam do tenant_id no payload pra avaliar
--    se entregam o evento — com replica identity default, DELETE são
--    silenciosamente dropados pelo serviço realtime.
--
-- Sintoma quando faltava: cliente cancela → row UPDATE → broadcast não chega
-- na agenda do staff → "Precisam confirmar" continua mostrando o appointment
-- até refresh manual.

alter publication supabase_realtime add table public.appointments;
alter table public.appointments replica identity full;
