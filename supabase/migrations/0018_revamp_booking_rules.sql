-- M1 do revamp 2026-04-26 — regras de agendamento configuráveis por tenant.
-- Já aplicada via MCP no cloud (jddttefvoqpolmhqwzuw); este arquivo replica
-- pra Docker local + outras envs.

alter table public.tenants
  add column min_advance_hours integer not null default 0
    check (min_advance_hours >= 0),
  add column slot_interval_minutes integer not null default 15
    check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  add column customer_can_cancel boolean not null default true;
