-- Janela máxima de agendamento configurável por tenant.
-- Hoje o cliente vê 14 dias hardcoded em /book/data. Com este campo o
-- staff configura em "Mais → Regras de agendamento" (1..365).
-- Default 14 mantém comportamento atual.

alter table public.tenants
  add column booking_window_days integer not null default 14
    check (booking_window_days between 1 and 365);
