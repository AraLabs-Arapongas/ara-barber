-- RPC pra criar combo booking atomicamente: 1 group + N appointments
-- numa transação. Se qualquer segment conflitar com appointment existente,
-- a transação inteira aborta (sem grupo órfão).
--
-- Acesso: SECURITY INVOKER (default) — RLS dos appointments e groups
-- aplicam normalmente baseadas no JWT do chamador. Cliente só consegue
-- criar group com seu customer_id (RLS appointment_groups_customer_insert).
--
-- Input: array json de segments. Cada segment inclui prof, service,
-- start_at, end_at, price_cents_snapshot, position, e o nome do
-- snapshot do cliente (denormalizado pra todos appointments).
--
-- Returns: id do group criado, ou raise exception se conflito.

create or replace function public.create_combo_booking(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_customer_name_snapshot text,
  p_total_duration_minutes integer,
  p_total_price_cents integer,
  p_segments jsonb -- [{service_id, professional_id, start_at, end_at, price_cents_snapshot, position, notes?}, ...]
)
returns uuid
language plpgsql
as $$
declare
  v_group_id uuid;
  v_segment jsonb;
  v_no_conflict boolean;
begin
  -- 1. Valida conflito pra cada segment ANTES de inserir nada.
  for v_segment in select * from jsonb_array_elements(p_segments)
  loop
    select public.validate_appointment_conflict(
      p_tenant_id := p_tenant_id,
      p_professional_id := (v_segment->>'professional_id')::uuid,
      p_start_at := (v_segment->>'start_at')::timestamptz,
      p_end_at := (v_segment->>'end_at')::timestamptz
    ) into v_no_conflict;

    if not v_no_conflict then
      raise exception 'Horário não disponível: serviço % com conflito.',
        v_segment->>'service_id';
    end if;
  end loop;

  -- 2. Insere group
  insert into public.appointment_groups (
    tenant_id, customer_id, status,
    total_duration_minutes, total_price_cents
  ) values (
    p_tenant_id, p_customer_id, 'SCHEDULED',
    p_total_duration_minutes, p_total_price_cents
  ) returning id into v_group_id;

  -- 3. Insere cada appointment do combo
  for v_segment in select * from jsonb_array_elements(p_segments)
  loop
    insert into public.appointments (
      tenant_id, customer_id, professional_id, service_id,
      start_at, end_at, status,
      customer_name_snapshot, price_cents_snapshot,
      group_id, position
    ) values (
      p_tenant_id,
      p_customer_id,
      (v_segment->>'professional_id')::uuid,
      (v_segment->>'service_id')::uuid,
      (v_segment->>'start_at')::timestamptz,
      (v_segment->>'end_at')::timestamptz,
      'SCHEDULED',
      p_customer_name_snapshot,
      (v_segment->>'price_cents_snapshot')::integer,
      v_group_id,
      (v_segment->>'position')::integer
    );
  end loop;

  return v_group_id;
end;
$$;

grant execute on function public.create_combo_booking(uuid, uuid, text, integer, integer, jsonb) to authenticated;

-- ============================================================================
-- Cancel cascata: 1 RPC pra cancelar group inteiro atomicamente.
-- ============================================================================

create or replace function public.cancel_appointment_group(
  p_group_id uuid,
  p_canceled_by uuid,
  p_reason text default null
)
returns void
language plpgsql
as $$
begin
  -- Update todos appointments do group em 1 statement (atômico).
  update public.appointments
  set
    status = 'CANCELED',
    canceled_at = now(),
    canceled_by = p_canceled_by,
    cancel_reason = p_reason,
    updated_at = now()
  where group_id = p_group_id
    and status in ('SCHEDULED', 'CONFIRMED');

  -- Update group status
  update public.appointment_groups
  set
    status = 'CANCELED',
    updated_at = now()
  where id = p_group_id;
end;
$$;

grant execute on function public.cancel_appointment_group(uuid, uuid, text) to authenticated;
