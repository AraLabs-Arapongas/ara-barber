-- M2 do revamp 2026-04-26 — bloqueios tenant-wide.
-- professional_id NULL = bloqueio vale pra todo profissional do tenant
-- (slot calculator passa a OR `professional_id IS NULL`).

alter table public.availability_blocks
  alter column professional_id drop not null;

create index availability_blocks_tenant_window_idx
  on public.availability_blocks (tenant_id, start_at, end_at)
  where professional_id is null;
