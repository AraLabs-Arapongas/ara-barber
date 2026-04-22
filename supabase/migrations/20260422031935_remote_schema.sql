create extension if not exists "pg_cron" with schema "pg_catalog";

create type "public"."appointment_status" as enum ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW');


  create table "public"."appointments" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid not null,
    "customer_id" uuid,
    "professional_id" uuid not null,
    "service_id" uuid not null,
    "start_at" timestamp with time zone not null,
    "end_at" timestamp with time zone not null,
    "status" public.appointment_status not null default 'SCHEDULED'::public.appointment_status,
    "customer_name_snapshot" text,
    "price_cents_snapshot" integer,
    "notes" text,
    "canceled_at" timestamp with time zone,
    "canceled_by" uuid,
    "cancel_reason" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "reminder_24h_sent_at" timestamp with time zone,
    "reminder_2h_sent_at" timestamp with time zone
      );


alter table "public"."appointments" enable row level security;


  create table "public"."notification_log" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid,
    "appointment_id" uuid,
    "channel" text not null,
    "event" text not null,
    "recipient" text,
    "status" text not null,
    "error_message" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_log" enable row level security;


  create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "tenant_id" uuid,
    "endpoint" text not null,
    "p256dh_key" text not null,
    "auth_key" text not null,
    "user_agent" text,
    "created_at" timestamp with time zone not null default now(),
    "last_seen_at" timestamp with time zone not null default now()
      );


alter table "public"."push_subscriptions" enable row level security;

alter table "public"."customers" add column "consent_given_at" timestamp with time zone;

alter table "public"."customers" add column "deleted_at" timestamp with time zone;

alter table "public"."customers" add column "pwa_install_dismissed_at" timestamp with time zone;

alter table "public"."customers" add column "pwa_installed_at" timestamp with time zone;

alter table "public"."customers" alter column "user_id" drop not null;

alter table "public"."tenants" add column "cancellation_window_hours" integer not null default 2;

alter table "public"."tenants" add column "home_headline_accent" text;

alter table "public"."tenants" add column "home_headline_top" text;

CREATE INDEX appointments_customer_idx ON public.appointments USING btree (customer_id);

CREATE UNIQUE INDEX appointments_pkey ON public.appointments USING btree (id);

CREATE INDEX appointments_professional_day_idx ON public.appointments USING btree (professional_id, start_at);

CREATE INDEX appointments_tenant_day_idx ON public.appointments USING btree (tenant_id, start_at);

CREATE INDEX notification_log_appointment_idx ON public.notification_log USING btree (appointment_id);

CREATE UNIQUE INDEX notification_log_pkey ON public.notification_log USING btree (id);

CREATE INDEX notification_log_tenant_created_idx ON public.notification_log USING btree (tenant_id, created_at DESC);

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);

CREATE INDEX push_subscriptions_tenant_idx ON public.push_subscriptions USING btree (tenant_id) WHERE (tenant_id IS NOT NULL);

CREATE UNIQUE INDEX push_subscriptions_user_id_endpoint_key ON public.push_subscriptions USING btree (user_id, endpoint);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);

alter table "public"."appointments" add constraint "appointments_pkey" PRIMARY KEY using index "appointments_pkey";

alter table "public"."notification_log" add constraint "notification_log_pkey" PRIMARY KEY using index "notification_log_pkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey";

alter table "public"."appointments" add constraint "appointments_canceled_by_fkey" FOREIGN KEY (canceled_by) REFERENCES auth.users(id) not valid;

alter table "public"."appointments" validate constraint "appointments_canceled_by_fkey";

alter table "public"."appointments" add constraint "appointments_check" CHECK ((end_at > start_at)) not valid;

alter table "public"."appointments" validate constraint "appointments_check";

alter table "public"."appointments" add constraint "appointments_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL not valid;

alter table "public"."appointments" validate constraint "appointments_customer_id_fkey";

alter table "public"."appointments" add constraint "appointments_professional_id_fkey" FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE RESTRICT not valid;

alter table "public"."appointments" validate constraint "appointments_professional_id_fkey";

alter table "public"."appointments" add constraint "appointments_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT not valid;

alter table "public"."appointments" validate constraint "appointments_service_id_fkey";

alter table "public"."appointments" add constraint "appointments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."appointments" validate constraint "appointments_tenant_id_fkey";

alter table "public"."notification_log" add constraint "notification_log_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL not valid;

alter table "public"."notification_log" validate constraint "notification_log_appointment_id_fkey";

alter table "public"."notification_log" add constraint "notification_log_channel_check" CHECK ((channel = ANY (ARRAY['email'::text, 'push'::text]))) not valid;

alter table "public"."notification_log" validate constraint "notification_log_channel_check";

alter table "public"."notification_log" add constraint "notification_log_event_check" CHECK ((event = ANY (ARRAY['confirmation'::text, 'cancellation'::text, 'reminder_24h'::text, 'reminder_2h'::text]))) not valid;

alter table "public"."notification_log" validate constraint "notification_log_event_check";

alter table "public"."notification_log" add constraint "notification_log_status_check" CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text]))) not valid;

alter table "public"."notification_log" validate constraint "notification_log_status_check";

alter table "public"."notification_log" add constraint "notification_log_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL not valid;

alter table "public"."notification_log" validate constraint "notification_log_tenant_id_fkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_tenant_id_fkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_endpoint_key" UNIQUE using index "push_subscriptions_user_id_endpoint_key";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.select_reminder_candidates(p_flag_column text, p_lower_interval text, p_upper_interval text)
 RETURNS TABLE(id uuid, tenant_id uuid, start_at timestamp with time zone, service_name text, customer_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_flag_column not in ('reminder_24h_sent_at', 'reminder_2h_sent_at') then
    raise exception 'invalid flag column %', p_flag_column;
  end if;

  return query execute format($q$
    select a.id, a.tenant_id, a.start_at, s.name as service_name, c.user_id as customer_user_id
    from appointments a
    join services s on s.id = a.service_id
    join customers c on c.id = a.customer_id
    where a.status in ('SCHEDULED', 'CONFIRMED')
      and a.%I is null
      and a.start_at between now() + %L::interval and now() + %L::interval
  $q$, p_flag_column, p_lower_interval, p_upper_interval);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_on_appointment_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_project_url text := 'https://sixgkgiirifigoiqbyow.supabase.co';
  v_body jsonb;
begin
  v_body := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
  );

  perform net.http_post(
    url := v_project_url || '/functions/v1/on-appointment-event',
    headers := jsonb_build_object('content-type', 'application/json'),
    body := v_body
  );

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_appointment_conflict(p_tenant_id uuid, p_professional_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
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
$function$
;

grant delete on table "public"."appointments" to "anon";

grant insert on table "public"."appointments" to "anon";

grant references on table "public"."appointments" to "anon";

grant select on table "public"."appointments" to "anon";

grant trigger on table "public"."appointments" to "anon";

grant truncate on table "public"."appointments" to "anon";

grant update on table "public"."appointments" to "anon";

grant delete on table "public"."appointments" to "authenticated";

grant insert on table "public"."appointments" to "authenticated";

grant references on table "public"."appointments" to "authenticated";

grant select on table "public"."appointments" to "authenticated";

grant trigger on table "public"."appointments" to "authenticated";

grant truncate on table "public"."appointments" to "authenticated";

grant update on table "public"."appointments" to "authenticated";

grant delete on table "public"."appointments" to "service_role";

grant insert on table "public"."appointments" to "service_role";

grant references on table "public"."appointments" to "service_role";

grant select on table "public"."appointments" to "service_role";

grant trigger on table "public"."appointments" to "service_role";

grant truncate on table "public"."appointments" to "service_role";

grant update on table "public"."appointments" to "service_role";

grant delete on table "public"."notification_log" to "anon";

grant insert on table "public"."notification_log" to "anon";

grant references on table "public"."notification_log" to "anon";

grant select on table "public"."notification_log" to "anon";

grant trigger on table "public"."notification_log" to "anon";

grant truncate on table "public"."notification_log" to "anon";

grant update on table "public"."notification_log" to "anon";

grant delete on table "public"."notification_log" to "authenticated";

grant insert on table "public"."notification_log" to "authenticated";

grant references on table "public"."notification_log" to "authenticated";

grant select on table "public"."notification_log" to "authenticated";

grant trigger on table "public"."notification_log" to "authenticated";

grant truncate on table "public"."notification_log" to "authenticated";

grant update on table "public"."notification_log" to "authenticated";

grant delete on table "public"."notification_log" to "service_role";

grant insert on table "public"."notification_log" to "service_role";

grant references on table "public"."notification_log" to "service_role";

grant select on table "public"."notification_log" to "service_role";

grant trigger on table "public"."notification_log" to "service_role";

grant truncate on table "public"."notification_log" to "service_role";

grant update on table "public"."notification_log" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant references on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant trigger on table "public"."push_subscriptions" to "anon";

grant truncate on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant references on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant trigger on table "public"."push_subscriptions" to "authenticated";

grant truncate on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant references on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant trigger on table "public"."push_subscriptions" to "service_role";

grant truncate on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";


  create policy "appointments_customer_insert"
  on "public"."appointments"
  as permissive
  for insert
  to authenticated
with check ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));



  create policy "appointments_customer_read"
  on "public"."appointments"
  as permissive
  for select
  to authenticated
using ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));



  create policy "appointments_customer_update"
  on "public"."appointments"
  as permissive
  for update
  to authenticated
using ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))))
with check ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));



  create policy "appointments_platform_admin_all"
  on "public"."appointments"
  as permissive
  for all
  to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());



  create policy "appointments_tenant_staff_all"
  on "public"."appointments"
  as permissive
  for all
  to authenticated
using (public.is_tenant_staff(tenant_id))
with check (public.is_tenant_staff(tenant_id));



  create policy "customers_self_insert"
  on "public"."customers"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "notification_log_platform_admin"
  on "public"."notification_log"
  as permissive
  for all
  to public
using (public.is_platform_admin())
with check (public.is_platform_admin());



  create policy "notification_log_staff_read"
  on "public"."notification_log"
  as permissive
  for select
  to public
using (((tenant_id IS NOT NULL) AND public.is_tenant_staff(tenant_id)));



  create policy "professionals_customer_read"
  on "public"."professionals"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.tenant_id = professionals.tenant_id) AND (c.user_id = auth.uid())))));



  create policy "push_subscriptions_platform_admin"
  on "public"."push_subscriptions"
  as permissive
  for all
  to public
using (public.is_platform_admin())
with check (public.is_platform_admin());



  create policy "push_subscriptions_self_delete"
  on "public"."push_subscriptions"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "push_subscriptions_self_insert"
  on "public"."push_subscriptions"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "push_subscriptions_self_select"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "push_subscriptions_self_update"
  on "public"."push_subscriptions"
  as permissive
  for update
  to public
using ((user_id = auth.uid()));



  create policy "push_subscriptions_staff_read"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using (((tenant_id IS NOT NULL) AND public.is_tenant_staff(tenant_id)));



  create policy "services_customer_read"
  on "public"."services"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.tenant_id = services.tenant_id) AND (c.user_id = auth.uid())))));


CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER on_appointment_event_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trigger_on_appointment_event();

CREATE TRIGGER on_appointment_event_update AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trigger_on_appointment_event();


