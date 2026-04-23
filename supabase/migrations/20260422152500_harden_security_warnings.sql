-- supabase/migrations/20260422152500_harden_security_warnings.sql
-- Fecha 2 warnings do Supabase security advisor:
-- 1) validate_appointment_conflict sem search_path fixado
-- 2) tenant-assets bucket público com policy de SELECT permite listar todos os arquivos

create or replace function public.validate_appointment_conflict(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_start_at timestamp with time zone,
  p_end_at timestamp with time zone,
  p_exclude_id uuid default null::uuid
)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.appointments
     WHERE tenant_id = p_tenant_id
       AND professional_id = p_professional_id
       AND status NOT IN ('CANCELED', 'NO_SHOW')
       AND (p_exclude_id IS NULL OR id <> p_exclude_id)
       AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.availability_blocks
     WHERE tenant_id = p_tenant_id
       AND professional_id = p_professional_id
       AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at)
  );
$function$;

drop policy if exists "tenant_assets_public_read" on storage.objects;
