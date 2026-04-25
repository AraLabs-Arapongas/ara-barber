> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire email (Resend) + web push notifications for the ara-barber pilot, covering booking confirmation, cancellation, staff new-booking alerts, and customer reminders (24h + 2h).

**Architecture:** Webhook-driven. Supabase Database Webhooks on `appointments` INSERT/UPDATE call an edge function that fans out across channels (Resend for email, web-push for push). A separate cron-triggered edge function runs every 5min to dispatch reminders. Push subscriptions live in a new `push_subscriptions` table; audit lives in `notification_log`.

**Tech Stack:** Supabase Edge Functions (Deno), Resend SDK, web-push npm package, pg_cron + pg_net, React Email for email templates, Next.js 16 Service Worker for push consumption on client.

**Source spec:** [`docs/superpowers/specs/2026-04-20-notifications-design.md`](../specs/2026-04-20-notifications-design.md)

**Manual actions flagged in the plan (pause and ask the user):**
- Resend account/domain setup + SPF/DKIM/DMARC DNS records
- VAPID key generation (local command, results go to Supabase secrets)
- Enabling pg_cron + pg_net in the Supabase project
- Registering Database Webhooks in the Supabase dashboard

**Validation approach:** No automated tests (user decision). Each phase ends with manual smoke verification; `docs/smoke-test-pilot.md` gets updated in Phase G.

---

## Phase A — Schema, secrets, shared modules

### Task A1: Migration — new tables and columns

**Files:**
- Use MCP: `mcp__supabase__apply_migration` with name `notifications_schema`

- [ ] **Step 1: Apply the migration**

Use the MCP tool `mcp__supabase__apply_migration` with:

```sql
-- push subscriptions (per user, possibly multi-device)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index push_subscriptions_tenant_idx on public.push_subscriptions(tenant_id) where tenant_id is not null;

alter table public.push_subscriptions enable row level security;

-- user owns their own subscriptions
create policy push_subscriptions_self_select on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subscriptions_self_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_subscriptions_self_update on public.push_subscriptions
  for update using (user_id = auth.uid());
create policy push_subscriptions_self_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- staff of a tenant can see staff subscriptions of the same tenant (for dashboards)
create policy push_subscriptions_staff_read on public.push_subscriptions
  for select using (
    tenant_id is not null
    and public.is_tenant_staff(tenant_id)
  );

-- platform admin can do everything
create policy push_subscriptions_platform_admin on public.push_subscriptions
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- notification log (audit)
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  channel text not null check (channel in ('email', 'push')),
  event text not null check (event in ('confirmation', 'cancellation', 'reminder_24h', 'reminder_2h')),
  recipient text,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index notification_log_appointment_idx on public.notification_log(appointment_id);
create index notification_log_tenant_created_idx on public.notification_log(tenant_id, created_at desc);

alter table public.notification_log enable row level security;

-- only platform admin + tenant staff read their own tenant logs
create policy notification_log_staff_read on public.notification_log
  for select using (
    tenant_id is not null and public.is_tenant_staff(tenant_id)
  );
create policy notification_log_platform_admin on public.notification_log
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- edge function writes via service role, bypasses RLS naturally

-- appointments: reminder flags + canceled_by
alter table public.appointments
  add column reminder_24h_sent_at timestamptz,
  add column reminder_2h_sent_at timestamptz,
  add column canceled_by text check (canceled_by in ('CUSTOMER', 'STAFF'));

-- customers: pwa tracking
alter table public.customers
  add column pwa_installed_at timestamptz,
  add column pwa_install_dismissed_at timestamptz;
```

- [ ] **Step 2: Verify with advisors**

Use MCP `mcp__supabase__get_advisors` with `{type: 'security'}`. Expected: no new security findings for the new tables (policies cover the required roles).

Use MCP `mcp__supabase__get_advisors` with `{type: 'performance'}`. Expected: no new unindexed FKs.

- [ ] **Step 3: Regenerate types**

Use MCP `mcp__supabase__generate_typescript_types` — overwrite `src/lib/supabase/types.ts`.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations src/lib/supabase/types.ts
git commit -m "feat(db): schema pra notificações (push_subscriptions, notification_log, flags em appointments/customers)"
```

---

### Task A2: Generate VAPID keys (MANUAL — pause and ask user)

**Manual action required.** VAPID keys sign push messages so browsers trust them.

- [ ] **Step 1: Ask the user to run the command locally**

Post this message to the user:

> "Preciso que você gere o par de chaves VAPID localmente. Rode:
> ```bash
> npx -y web-push generate-vapid-keys --json
> ```
> E me passa a saída (public key + private key). Vou guardar a privada como secret no Supabase e a pública no env do Next."

Wait for the user response before proceeding.

- [ ] **Step 2: Store VAPID private key as Supabase secret**

Once the user provides the keys, use MCP `mcp__supabase__execute_sql` to set them via Vault or ask the user to add them via the Supabase dashboard (Project Settings → Edge Functions → Secrets). Names:

- `VAPID_PRIVATE_KEY` — the private key value
- `VAPID_PUBLIC_KEY` — the public key value (also stored as a Supabase secret for edge function access)
- `VAPID_SUBJECT` — `mailto:avisos@aralabs.com.br`

Ask the user to confirm they've set these three secrets in the Supabase dashboard.

- [ ] **Step 3: Add VAPID public key to `.env.local`**

Instruct the user to append to their local `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from step 1>
```

Commit nothing in this step — `.env.local` is gitignored. The key is safe to be public (that's the whole point of asymmetric crypto).

---

### Task A3: Resend account + domain setup (MANUAL — pause and ask user)

**Manual action required.** Resend needs the `aralabs.com.br` domain verified via DNS.

- [ ] **Step 1: Ask the user to set up Resend**

Post this message:

> "Preciso que você:
> 1. Crie conta em resend.com (grátis, 3k emails/mês)
> 2. Em 'Domains' → 'Add Domain' → `aralabs.com.br`
> 3. Resend vai te dar 3 registros DNS (SPF, DKIM, DMARC). Adiciona no provedor de DNS do domínio.
> 4. Volta no Resend e clica 'Verify'. Pode levar uns minutos propagar.
> 5. Cria uma API key em 'API Keys' com nome `ara-barber-pilot`, permission 'Sending access'. Me passa a key.
>
> Enquanto DNS propaga (até 24h), podemos continuar desenvolvendo — só não manda email de verdade."

Wait for the user to confirm domain verification + send the API key.

- [ ] **Step 2: Store Resend secrets in Supabase**

Ask the user to set in Supabase dashboard (Project Settings → Edge Functions → Secrets):

- `RESEND_API_KEY` — the API key from step 1
- `RESEND_FROM_EMAIL` — `avisos@aralabs.com.br`
- `RESEND_FROM_NAME` — `AraLabs`

Confirm with user they're set.

---

### Task A4: Enable pg_cron + pg_net (MANUAL — pause and ask user)

**Manual action required.** These extensions power the scheduled reminder dispatch.

- [ ] **Step 1: Check current extensions**

Use MCP `mcp__supabase__list_extensions`. Look for `pg_cron` and `pg_net` in the enabled list.

- [ ] **Step 2: Enable missing extensions**

If either is not enabled, use MCP `mcp__supabase__apply_migration` with name `enable_cron_net`:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- allow service role to call net functions
grant usage on schema net to service_role;
```

- [ ] **Step 3: Set CRON_SECRET**

Generate a random secret and store it in Supabase:

```bash
openssl rand -base64 32
```

Ask user to add as Supabase secret: `CRON_SECRET=<output>`.

Also ask user to set this as a Postgres custom GUC for the cron job (Supabase supports `app.*` GUCs via the Dashboard → Settings → API → "Custom Postgres Config"). Value should match the secret:

```
app.cron_secret = '<same value>'
```

Confirm with user both are set.

---

### Task A5: Shared edge function module — `channels/push.ts`

**Files:**
- Create: `supabase/functions/_shared/channels/push.ts`
- Create: `supabase/functions/_shared/supabase-admin.ts`

- [ ] **Step 1: Create the Supabase admin client helper**

Write to `supabase/functions/_shared/supabase-admin.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3'

export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 2: Create the push channel module**

Write to `supabase/functions/_shared/channels/push.ts`:

```typescript
import webpush from 'npm:web-push@3.6.7'
import { createAdminClient } from '../supabase-admin.ts'

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
}

type Subscription = {
  id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
}

function configureVapid() {
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
}

async function sendOne(sub: Subscription, payload: PushPayload) {
  const client = createAdminClient()
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      },
      JSON.stringify(payload),
      { TTL: 3600 },
    )
    return { ok: true as const }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    if (statusCode === 410 || statusCode === 404) {
      // subscription expired — clean up
      await client.from('push_subscriptions').delete().eq('id', sub.id)
    }
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  configureVapid()
  const client = createAdminClient()
  const { data: subs } = await client
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    const r = await sendOne(sub, payload)
    if (r.ok) sent++
    else failed++
  }
  return { sent, failed }
}

export async function sendPushToTenantStaff(tenantId: string, payload: PushPayload) {
  configureVapid()
  const client = createAdminClient()

  // join push_subscriptions with user_profiles to filter active staff
  const { data: staffProfiles } = await client
    .from('user_profiles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['SALON_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'])
    .eq('is_active', true)

  if (!staffProfiles || staffProfiles.length === 0) return { sent: 0, failed: 0 }

  const userIds = staffProfiles.map((p) => p.user_id)
  const { data: subs } = await client
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    const r = await sendOne(sub, payload)
    if (r.ok) sent++
    else failed++
  }
  return { sent, failed }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat(notifications): shared edge function modules — push + supabase admin"
```

---

### Task A6: Shared edge function module — `channels/email.ts` + templates

**Files:**
- Create: `supabase/functions/_shared/channels/email.ts`
- Create: `supabase/functions/_shared/templates/booking-confirmation.ts`
- Create: `supabase/functions/_shared/templates/booking-canceled.ts`
- Create: `supabase/functions/_shared/format.ts`

- [ ] **Step 1: Date formatter helper**

Write to `supabase/functions/_shared/format.ts`:

```typescript
const TZ = 'America/Sao_Paulo'

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(iso))
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} às ${formatTime(iso)}`
}
```

- [ ] **Step 2: Booking confirmation template**

Write to `supabase/functions/_shared/templates/booking-confirmation.ts`:

```typescript
import { formatDateTime } from '../format.ts'

export type ConfirmationData = {
  customerName: string
  serviceName: string
  professionalName: string
  startAtISO: string
  tenantName: string
  tenantPrimaryColor: string | null
  tenantLogoUrl: string | null
  tenantPhone: string | null
  appointmentUrl: string
}

export function renderConfirmationHtml(d: ConfirmationData): string {
  const color = d.tenantPrimaryColor ?? '#17343f'
  const logo = d.tenantLogoUrl
    ? `<img src="${d.tenantLogoUrl}" alt="${escapeHtml(d.tenantName)}" style="max-height:48px;margin-bottom:12px" />`
    : `<div style="font-weight:600;font-size:18px;color:${color};margin-bottom:12px">${escapeHtml(d.tenantName)}</div>`

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f1f1f">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 16px">${logo}</td></tr>
    <tr><td style="padding:0 32px 24px">
      <h1 style="margin:0 0 8px;font-size:22px">Reserva confirmada</h1>
      <p style="margin:0 0 16px;color:#555">Olá ${escapeHtml(d.customerName)}, seu horário está marcado.</p>
      <div style="padding:16px;background:#f5f0e8;border-radius:8px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Quando</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600">${formatDateTime(d.startAtISO)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Serviço</p>
        <p style="margin:0 0 12px">${escapeHtml(d.serviceName)} · com ${escapeHtml(d.professionalName)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Onde</p>
        <p style="margin:0">${escapeHtml(d.tenantName)}${d.tenantPhone ? `<br/>☎ ${escapeHtml(d.tenantPhone)}` : ''}</p>
      </div>
      <a href="${d.appointmentUrl}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Ver minha reserva</a>
    </td></tr>
    <tr><td style="padding:24px 32px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center">
      Enviado pela plataforma AraLabs em nome de ${escapeHtml(d.tenantName)}.
    </td></tr>
  </table>
</body></html>`
}

export function confirmationSubject(d: ConfirmationData): string {
  return `Reserva confirmada — ${formatDateTime(d.startAtISO)}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!))
}
```

- [ ] **Step 3: Booking canceled template**

Write to `supabase/functions/_shared/templates/booking-canceled.ts`:

```typescript
import { formatDateTime } from '../format.ts'

export type CancelData = {
  customerName: string
  serviceName: string
  professionalName: string
  startAtISO: string
  tenantName: string
  tenantPrimaryColor: string | null
  tenantLogoUrl: string | null
  canceledBy: 'CUSTOMER' | 'STAFF'
  bookAgainUrl: string
}

export function renderCancelHtml(d: CancelData): string {
  const color = d.tenantPrimaryColor ?? '#17343f'
  const logo = d.tenantLogoUrl
    ? `<img src="${d.tenantLogoUrl}" alt="${escapeHtml(d.tenantName)}" style="max-height:48px;margin-bottom:12px" />`
    : `<div style="font-weight:600;font-size:18px;color:${color};margin-bottom:12px">${escapeHtml(d.tenantName)}</div>`

  const intro = d.canceledBy === 'CUSTOMER'
    ? `Olá ${escapeHtml(d.customerName)}, recebemos seu cancelamento.`
    : `Olá ${escapeHtml(d.customerName)}, o salão cancelou sua reserva.`

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f1f1f">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 16px">${logo}</td></tr>
    <tr><td style="padding:0 32px 24px">
      <h1 style="margin:0 0 8px;font-size:22px">Reserva cancelada</h1>
      <p style="margin:0 0 16px;color:#555">${intro}</p>
      <div style="padding:16px;background:#f5f0e8;border-radius:8px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Era em</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;text-decoration:line-through">${formatDateTime(d.startAtISO)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.08em">Serviço</p>
        <p style="margin:0">${escapeHtml(d.serviceName)} · com ${escapeHtml(d.professionalName)}</p>
      </div>
      <a href="${d.bookAgainUrl}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Agendar novamente</a>
    </td></tr>
    <tr><td style="padding:24px 32px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center">
      Enviado pela plataforma AraLabs em nome de ${escapeHtml(d.tenantName)}.
    </td></tr>
  </table>
</body></html>`
}

export function cancelSubject(d: CancelData): string {
  return `Reserva cancelada — ${formatDateTime(d.startAtISO)}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!))
}
```

- [ ] **Step 4: Email channel module**

Write to `supabase/functions/_shared/channels/email.ts`:

```typescript
import { Resend } from 'npm:resend@4.0.0'
import { createAdminClient } from '../supabase-admin.ts'

type SendArgs = {
  to: string
  subject: string
  html: string
  replyTo?: string | null
  tenantId: string
  appointmentId: string
  event: 'confirmation' | 'cancellation'
}

export async function sendEmail(args: SendArgs) {
  const apiKey = Deno.env.get('RESEND_API_KEY')!
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')!
  const fromName = Deno.env.get('RESEND_FROM_NAME')!
  const resend = new Resend(apiKey)
  const client = createAdminClient()

  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo ?? undefined,
    })

    if (error) {
      await client.from('notification_log').insert({
        tenant_id: args.tenantId,
        appointment_id: args.appointmentId,
        channel: 'email',
        event: args.event,
        recipient: args.to,
        status: 'failed',
        error_message: error.message ?? JSON.stringify(error),
      })
      return { ok: false as const }
    }

    await client.from('notification_log').insert({
      tenant_id: args.tenantId,
      appointment_id: args.appointmentId,
      channel: 'email',
      event: args.event,
      recipient: args.to,
      status: 'sent',
    })
    return { ok: true as const }
  } catch (err) {
    await client.from('notification_log').insert({
      tenant_id: args.tenantId,
      appointment_id: args.appointmentId,
      channel: 'email',
      event: args.event,
      recipient: args.to,
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
    })
    return { ok: false as const }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat(notifications): shared email module + templates + date formatter"
```

---

## Phase B — Email confirmação (INSERT event)

### Task B1: Edge function `on-appointment-event` skeleton

**Files:**
- Create: `supabase/functions/on-appointment-event/index.ts`

- [ ] **Step 1: Write the edge function**

Write to `supabase/functions/on-appointment-event/index.ts`:

```typescript
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/channels/email.ts'
import { sendPushToUser, sendPushToTenantStaff } from '../_shared/channels/push.ts'
import {
  renderConfirmationHtml,
  confirmationSubject,
  type ConfirmationData,
} from '../_shared/templates/booking-confirmation.ts'
import {
  renderCancelHtml,
  cancelSubject,
  type CancelData,
} from '../_shared/templates/booking-canceled.ts'

type AppointmentRow = {
  id: string
  tenant_id: string
  customer_id: string
  service_id: string
  professional_id: string
  start_at: string
  status: string
  canceled_by: 'CUSTOMER' | 'STAFF' | null
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: AppointmentRow | null
  old_record: AppointmentRow | null
  schema: string
}

async function loadEnrichedData(appointmentId: string) {
  const client = createAdminClient()
  const { data } = await client
    .from('appointments')
    .select(`
      id, tenant_id, start_at, status, canceled_by,
      service:services(id, name),
      professional:professionals(id, name, display_name),
      customer:customers(id, user_id, name, email),
      tenant:tenants(id, name, slug, primary_color, logo_url, contact_phone, email)
    `)
    .eq('id', appointmentId)
    .maybeSingle()
  return data
}

function tenantAppointmentUrl(slug: string, appointmentId: string): string {
  const root = Deno.env.get('TENANT_ROOT_DOMAIN') ?? 'aralabs.com.br'
  return `https://${slug}.${root}/meus-agendamentos/${appointmentId}`
}

function tenantBookAgainUrl(slug: string): string {
  const root = Deno.env.get('TENANT_ROOT_DOMAIN') ?? 'aralabs.com.br'
  return `https://${slug}.${root}/book`
}

async function handleInsert(row: AppointmentRow) {
  const data = await loadEnrichedData(row.id)
  if (!data || !data.customer || !data.tenant || !data.service || !data.professional) {
    return { skipped: 'missing enrichment' }
  }

  const customer = data.customer as { id: string; user_id: string | null; name: string | null; email: string | null }
  const tenant = data.tenant as { id: string; name: string; slug: string; primary_color: string | null; logo_url: string | null; contact_phone: string | null; email: string | null }
  const service = data.service as { id: string; name: string }
  const professional = data.professional as { id: string; name: string; display_name: string | null }
  const proLabel = professional.display_name ?? professional.name

  // 1) Email to customer
  if (customer.email) {
    const confirmData: ConfirmationData = {
      customerName: customer.name ?? 'cliente',
      serviceName: service.name,
      professionalName: proLabel,
      startAtISO: row.start_at,
      tenantName: tenant.name,
      tenantPrimaryColor: tenant.primary_color,
      tenantLogoUrl: tenant.logo_url,
      tenantPhone: tenant.contact_phone,
      appointmentUrl: tenantAppointmentUrl(tenant.slug, row.id),
    }
    await sendEmail({
      to: customer.email,
      subject: confirmationSubject(confirmData),
      html: renderConfirmationHtml(confirmData),
      replyTo: tenant.email,
      tenantId: row.tenant_id,
      appointmentId: row.id,
      event: 'confirmation',
    })
  }

  // 2) Push to customer (if they have a user_id)
  if (customer.user_id) {
    const result = await sendPushToUser(customer.user_id, {
      title: 'Horário marcado',
      body: `${service.name} · ${proLabel}`,
      url: `/meus-agendamentos/${row.id}`,
      tag: `appointment-${row.id}`,
    })
    await logPush(row.tenant_id, row.id, 'confirmation', customer.user_id, result)
  }

  // 3) Push to staff
  const staffResult = await sendPushToTenantStaff(row.tenant_id, {
    title: 'Novo agendamento',
    body: `${customer.name ?? 'cliente'} — ${service.name}`,
    url: `/salon/dashboard/agenda/${row.id}`,
    tag: `new-booking-${row.id}`,
  })
  await logPush(row.tenant_id, row.id, 'confirmation', 'staff-fanout', staffResult)

  return { ok: true }
}

async function handleStatusChange(oldRow: AppointmentRow, row: AppointmentRow) {
  // Only act on transition to CANCELED
  if (oldRow.status === row.status || row.status !== 'CANCELED') {
    return { skipped: 'not cancel' }
  }

  const data = await loadEnrichedData(row.id)
  if (!data || !data.customer || !data.tenant || !data.service || !data.professional) {
    return { skipped: 'missing enrichment' }
  }

  const customer = data.customer as { id: string; user_id: string | null; name: string | null; email: string | null }
  const tenant = data.tenant as { id: string; name: string; slug: string; primary_color: string | null; logo_url: string | null; email: string | null }
  const service = data.service as { id: string; name: string }
  const professional = data.professional as { id: string; name: string; display_name: string | null }
  const proLabel = professional.display_name ?? professional.name
  const canceledBy = row.canceled_by ?? 'STAFF'

  // 1) Email to customer
  if (customer.email) {
    const cancelData: CancelData = {
      customerName: customer.name ?? 'cliente',
      serviceName: service.name,
      professionalName: proLabel,
      startAtISO: row.start_at,
      tenantName: tenant.name,
      tenantPrimaryColor: tenant.primary_color,
      tenantLogoUrl: tenant.logo_url,
      canceledBy,
      bookAgainUrl: tenantBookAgainUrl(tenant.slug),
    }
    await sendEmail({
      to: customer.email,
      subject: cancelSubject(cancelData),
      html: renderCancelHtml(cancelData),
      replyTo: tenant.email,
      tenantId: row.tenant_id,
      appointmentId: row.id,
      event: 'cancellation',
    })
  }

  // 2) Push to customer
  if (customer.user_id) {
    const result = await sendPushToUser(customer.user_id, {
      title: 'Reserva cancelada',
      body: `${service.name} — ${proLabel}`,
      url: `/meus-agendamentos/${row.id}`,
      tag: `cancel-${row.id}`,
    })
    await logPush(row.tenant_id, row.id, 'cancellation', customer.user_id, result)
  }

  // 3) Push to staff
  const staffResult = await sendPushToTenantStaff(row.tenant_id, {
    title: 'Reserva cancelada',
    body: `${customer.name ?? 'cliente'} — ${service.name}`,
    url: `/salon/dashboard/agenda/${row.id}`,
    tag: `cancel-staff-${row.id}`,
  })
  await logPush(row.tenant_id, row.id, 'cancellation', 'staff-fanout', staffResult)

  return { ok: true }
}

async function logPush(
  tenantId: string,
  appointmentId: string,
  event: 'confirmation' | 'cancellation',
  recipient: string,
  result: { sent: number; failed: number },
) {
  const client = createAdminClient()
  if (result.sent > 0) {
    await client.from('notification_log').insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      channel: 'push',
      event,
      recipient,
      status: 'sent',
    })
  }
  if (result.failed > 0) {
    await client.from('notification_log').insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      channel: 'push',
      event,
      recipient,
      status: 'failed',
      error_message: `${result.failed} subscriptions failed`,
    })
  }
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload
    if (payload.table !== 'appointments') {
      return new Response(JSON.stringify({ skipped: 'wrong table' }), { status: 200 })
    }

    let result: unknown
    if (payload.type === 'INSERT' && payload.record) {
      result = await handleInsert(payload.record)
    } else if (payload.type === 'UPDATE' && payload.record && payload.old_record) {
      result = await handleStatusChange(payload.old_record, payload.record)
    } else {
      result = { skipped: 'unhandled type' }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('on-appointment-event error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Deploy the edge function**

Use MCP `mcp__supabase__deploy_edge_function` with name `on-appointment-event` and all files from `supabase/functions/on-appointment-event/` and `supabase/functions/_shared/`.

The MCP call expects a `files` array with name + content. List:
- `index.ts` → contents of `supabase/functions/on-appointment-event/index.ts`
- `_shared/supabase-admin.ts`
- `_shared/channels/push.ts`
- `_shared/channels/email.ts`
- `_shared/format.ts`
- `_shared/templates/booking-confirmation.ts`
- `_shared/templates/booking-canceled.ts`

- [ ] **Step 3: Set TENANT_ROOT_DOMAIN secret**

Ask user to set in Supabase dashboard:
```
TENANT_ROOT_DOMAIN=lvh.me:3008
```
(For local dev. In prod this becomes `aralabs.com.br`.)

Confirm user set it.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/on-appointment-event
git commit -m "feat(notifications): edge function on-appointment-event"
```

---

### Task B2: Register Database Webhook (MANUAL — pause and ask user)

**Files:** none (configuration in Supabase dashboard or via SQL)

- [ ] **Step 1: Ask user to create the webhook**

Post to user:

> "Preciso que você crie o Database Webhook no Supabase dashboard:
> 1. Vai em Database → Webhooks → 'Create a new hook'
> 2. Name: `on-appointment-event`
> 3. Table: `appointments`
> 4. Events: marca `Insert` e `Update`
> 5. Type: `Supabase Edge Functions`
> 6. Edge Function: `on-appointment-event`
> 7. HTTP Method: `POST` (default)
> 8. HTTP Headers: Supabase já adiciona o auth; deixa default
> 9. Salva.
>
> Alternativa via SQL (se preferir): me avisa que eu rodo a migration."

Wait for user to confirm webhook is created.

---

### Task B3: Smoke — email confirmação

- [ ] **Step 1: Create appointment via wizard**

Ask user to:
1. Start dev server: `pnpm dev`
2. Open `http://barbearia-teste.lvh.me:3008/` in an anonymous window
3. Complete booking flow with a real email (e.g. their own)
4. Verify the success page shows

- [ ] **Step 2: Verify email arrived**

Ask user to check inbox for "Reserva confirmada — [date]". Body should include correct service, professional, date, and a clickable "Ver minha reserva" button.

- [ ] **Step 3: Verify notification_log**

Use MCP `mcp__supabase__execute_sql`:

```sql
select channel, event, recipient, status, error_message, created_at
from notification_log
order by created_at desc
limit 10;
```

Expected: at least one row with `channel=email, event=confirmation, status=sent, recipient=<the test email>`.

If `status=failed`, inspect `error_message`, fix, and redo the smoke.

- [ ] **Step 4: Optional — check edge function logs**

Use MCP `mcp__supabase__get_logs` with `service=edge-function`. Scan for "on-appointment-event" entries and any errors.

---

## Phase C — Push cliente

### Task C1: Service Worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Write the service worker**

Write to `public/sw.js`:

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Aviso', body: event.data.text(), url: '/' }
  }
  const { title, body, url, tag } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url: url ?? '/' },
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(url)) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
```

- [ ] **Step 2: Verify icons exist**

Check that `public/icon-192.png` and `public/badge-72.png` exist. If not, use the existing tenant/app icon from `public/` or fallback to the AraLabs logo. If missing entirely, use MCP Bash to copy an existing icon:

```bash
ls public/*.png public/*.ico 2>/dev/null
```

If needed, create minimal placeholders:
- Copy an existing 192px icon to `public/icon-192.png`
- Copy a 72px version to `public/badge-72.png`

If none exist, skip — the browser will render without icon (still works).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(notifications): service worker pra push"
```

---

### Task C2: Client-side push subscription helper

**Files:**
- Create: `src/lib/push/register.ts`
- Create: `src/app/actions/push-subscriptions.ts`

- [ ] **Step 1: Server action to save subscription**

Write to `src/app/actions/push-subscriptions.ts`:

```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/tenant/context'

const saveSchema = z.object({
  endpoint: z.string().url(),
  p256dhKey: z.string().min(1),
  authKey: z.string().min(1),
  userAgent: z.string().optional(),
})

export async function savePushSubscription(raw: z.infer<typeof saveSchema>) {
  const parsed = saveSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Payload inválido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Não autenticado.' }

  const tenantId = await getCurrentTenantId()

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        tenant_id: tenantId,
        endpoint: parsed.data.endpoint,
        p256dh_key: parsed.data.p256dhKey,
        auth_key: parsed.data.authKey,
        user_agent: parsed.data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    )

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteMyPushSubscription(endpoint: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Não autenticado.' }
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
```

- [ ] **Step 2: Browser-side helper**

Write to `src/lib/push/register.ts`:

```typescript
'use client'

import { savePushSubscription, deleteMyPushSubscription } from '@/app/actions/push-subscriptions'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function currentPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.error('SW register failed', err)
    return null
  }
}

export async function requestAndSubscribe(): Promise<
  { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'failed'; error?: string }
> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()

  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const reg = await ensureServiceWorker()
  if (!reg) return { ok: false, reason: 'failed', error: 'SW registration failed' }

  try {
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const result = await savePushSubscription({
      endpoint: json.endpoint,
      p256dhKey: json.keys.p256dh,
      authKey: json.keys.auth,
      userAgent: navigator.userAgent,
    })
    if (!result.ok) return { ok: false, reason: 'failed', error: result.error }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
}

export async function unsubscribe(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await deleteMyPushSubscription(sub.endpoint)
  await sub.unsubscribe()
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/push src/app/actions/push-subscriptions.ts
git commit -m "feat(notifications): client push subscription helper + server action"
```

---

### Task C3: Customer push consent after booking

**Files:**
- Modify: `src/app/book/confirmar/page.tsx` or the booking confirm client component (need to locate the post-confirmation hook)
- Create: `src/components/push/after-booking-prompt.tsx`

- [ ] **Step 1: Locate the confirmation component**

Run:

```bash
rg -l "Confirmar reserva" src/
```

Expect something like `src/components/booking/confirm-form.tsx` or similar. Open it and locate where the successful confirmation redirects to `/book/sucesso`.

- [ ] **Step 2: Create the prompt component**

Write to `src/components/push/after-booking-prompt.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { requestAndSubscribe, currentPermission, isPushSupported } from '@/lib/push/register'

type Props = {
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function AfterBookingPushPrompt({ open, onClose, onDone }: Props) {
  const [pending, setPending] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!isPushSupported()) {
      onDone()
      return
    }
    if (currentPermission() === 'granted' || currentPermission() === 'denied') {
      onDone()
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- trigger bottom sheet to open
    setShown(true)
  }, [open, onDone])

  async function enable() {
    setPending(true)
    await requestAndSubscribe()
    setPending(false)
    onDone()
  }

  function later() {
    onDone()
  }

  if (!shown) return null
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Receber avisos do salão"
      description="Confirmação e lembretes direto no seu celular."
    >
      <div className="space-y-3 pb-2">
        <Button fullWidth onClick={enable} loading={pending}>
          Ativar avisos
        </Button>
        <Button variant="secondary" fullWidth onClick={later} disabled={pending}>
          Agora não
        </Button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 3: Wire the prompt into the confirm flow**

Open the confirm form component (found in Step 1). After the server action returns `ok: true`, **before** navigating to `/book/sucesso`, show the prompt. Only navigate after the prompt closes.

Modify the flow roughly like this (adapt to the actual component's state management):

```typescript
// Add state
const [pushPromptOpen, setPushPromptOpen] = useState(false)
const [pendingRedirectUrl, setPendingRedirectUrl] = useState<string | null>(null)

// In the submit handler, after result.ok:
if (result.ok) {
  setPendingRedirectUrl(`/book/sucesso?appointmentId=${result.appointmentId}`)
  setPushPromptOpen(true)
}

// In the JSX:
<AfterBookingPushPrompt
  open={pushPromptOpen}
  onClose={() => {
    setPushPromptOpen(false)
    if (pendingRedirectUrl) router.push(pendingRedirectUrl)
  }}
  onDone={() => {
    setPushPromptOpen(false)
    if (pendingRedirectUrl) router.push(pendingRedirectUrl)
  }}
/>
```

- [ ] **Step 4: Lint + typecheck**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/push src/components/booking
git commit -m "feat(notifications): prompt de push cliente após confirmar reserva"
```

---

### Task C4: PWA install bottom sheet on login

**Files:**
- Create: `src/components/pwa/install-prompt.tsx`
- Create: `src/app/actions/pwa-tracking.ts`
- Modify: `src/app/layout.tsx` (or appropriate provider-level layout)

- [ ] **Step 1: Server action to track PWA events**

Write to `src/app/actions/pwa-tracking.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/tenant/context'

async function getMyCustomerIdForTenant(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? null
}

export async function markPwaInstalled() {
  const id = await getMyCustomerIdForTenant()
  if (!id) return { ok: false as const }
  const supabase = await createClient()
  await supabase
    .from('customers')
    .update({ pwa_installed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pwa_installed_at', null)
  return { ok: true as const }
}

export async function markPwaInstallDismissed() {
  const id = await getMyCustomerIdForTenant()
  if (!id) return { ok: false as const }
  const supabase = await createClient()
  await supabase
    .from('customers')
    .update({ pwa_install_dismissed_at: new Date().toISOString() })
    .eq('id', id)
  return { ok: true as const }
}
```

- [ ] **Step 2: Install prompt component**

Write to `src/components/pwa/install-prompt.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { markPwaInstalled, markPwaInstallDismissed } from '@/app/actions/pwa-tracking'

const DISMISS_KEY = 'ara:pwa-install-dismissed-at'
const DISMISS_DAYS = 30

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const ts = Number(raw)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < DISMISS_DAYS * 86_400_000
}

export function PwaInstallPrompt() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'chrome' | 'manual'>('chrome')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) {
      void markPwaInstalled()
      return
    }
    if (wasDismissedRecently()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('chrome')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opens sheet reacting to browser event
      setOpen(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS Safari never fires beforeinstallprompt; show manual after a short delay
    if (isIOS()) {
      const t = setTimeout(() => {
        if (!wasDismissedRecently()) {
          setMode('manual')
          setOpen(true)
        }
      }, 1500)
      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
        clearTimeout(t)
      }
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function install() {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        void markPwaInstalled()
      }
    }
    setOpen(false)
    setDeferred(null)
  }

  function later() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    void markPwaInstallDismissed()
    setOpen(false)
  }

  if (!open) return null

  return (
    <BottomSheet
      open={open}
      onClose={later}
      title="Instale o app"
      description={
        mode === 'chrome'
          ? 'Receba avisos e agende mais rápido.'
          : 'No Safari iOS, use o menu compartilhar pra adicionar à tela de início.'
      }
    >
      <div className="space-y-3 pb-2">
        {mode === 'chrome' ? (
          <Button fullWidth onClick={install}>
            Instalar
          </Button>
        ) : (
          <div className="rounded-lg bg-bg-subtle p-4 text-[0.9375rem] text-fg">
            1. Toque no ícone <strong>Compartilhar</strong> (retângulo com seta pra cima).<br />
            2. Role e escolha <strong>Adicionar à Tela de Início</strong>.<br />
            3. Confirme. Pronto.
          </div>
        )}
        <Button variant="secondary" fullWidth onClick={later}>
          Mais tarde
        </Button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 3: Mount the prompt**

Find the customer-facing root layout. Based on the project structure, this is likely `src/app/layout.tsx`. Open it.

Add import and mount conditionally (only on tenant area, authenticated customer):

```typescript
import { PwaInstallPrompt } from '@/components/pwa/install-prompt'
```

And inside the layout body, add:

```typescript
<PwaInstallPrompt />
```

If the layout is shared across areas, gate via a client component that reads the area header (or mount under `src/app/(customer-authenticated)/layout.tsx` if exists — use `rg -l "CustomerBottomTabNav"` to locate the correct layout).

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/pwa src/app/actions/pwa-tracking.ts src/app/layout.tsx
git commit -m "feat(notifications): bottom sheet pra instalar PWA + tracking em customers"
```

---

### Task C5: Smoke — push cliente

- [ ] **Step 1: Subscribe flow**

Ask user:
1. In dev server, open `http://barbearia-teste.lvh.me:3008/` in a Chrome window (push requires secure context; `lvh.me` is treated as secure by Chrome? — if not, use `localhost` via a test tenant).
2. Log in as a customer.
3. Book an appointment through the wizard.
4. After "Confirmar reserva", the prompt should appear. Click "Ativar avisos".
5. Browser will show the native permission dialog. Accept.
6. Complete flow, reach `/book/sucesso`.

**Note:** Chrome may not offer `beforeinstallprompt` on `lvh.me` (not HTTPS). For install prompt testing, deploy to staging or tunnel via `ngrok` / `cloudflared`. For push, localhost and `lvh.me` with Chrome should work with `chrome://flags` → "Insecure origins treated as secure" pointing to `http://barbearia-teste.lvh.me:3008` if needed.

- [ ] **Step 2: Verify subscription saved**

Use MCP `mcp__supabase__execute_sql`:

```sql
select user_id, endpoint, user_agent, created_at
from push_subscriptions
order by created_at desc
limit 5;
```

Expect a row with the customer's user_id and a Chrome/WebKit endpoint.

- [ ] **Step 3: Trigger a push**

Still as the logged-in customer, book ANOTHER appointment. Within seconds of confirming, the browser should show a notification ("Horário marcado — [service]").

- [ ] **Step 4: Click notification**

Clicking should open `/meus-agendamentos/<appointment_id>`.

- [ ] **Step 5: Verify notification_log**

```sql
select channel, event, recipient, status
from notification_log
order by created_at desc
limit 5;
```

Expect both `email` and `push` rows with `status=sent` for the new appointment.

---

## Phase D — Push staff

### Task D1: Staff push banner + toggle in /mais

**Files:**
- Create: `src/components/push/staff-push-banner.tsx`
- Create: `src/components/push/staff-push-toggle.tsx`
- Modify: `src/app/salon/(authenticated)/dashboard/agenda/page.tsx` (or its client sub-component)
- Modify: `src/app/salon/(authenticated)/dashboard/mais/page.tsx`

- [ ] **Step 1: Staff banner component**

Write to `src/components/push/staff-push-banner.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requestAndSubscribe, isPushSupported, currentPermission } from '@/lib/push/register'

const DISMISS_KEY = 'ara:staff-push-dismissed'

export function StaffPushBanner() {
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    const perm = currentPermission()
    if (perm === 'granted' || perm === 'denied' || perm === 'unsupported') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows banner reacting to browser state
    setVisible(true)
  }, [])

  async function enable() {
    setPending(true)
    const r = await requestAndSubscribe()
    setPending(false)
    if (r.ok) setVisible(false)
    else if (r.reason === 'denied') {
      localStorage.setItem(DISMISS_KEY, '1')
      setVisible(false)
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium text-fg">Avisar quando entrar agendamento</p>
        <p className="truncate text-[0.8125rem] text-fg-muted">
          Notificação no celular em tempo real.
        </p>
      </div>
      <Button size="sm" onClick={enable} loading={pending}>
        Ativar
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Staff toggle for /mais**

Write to `src/components/push/staff-push-toggle.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import {
  requestAndSubscribe,
  unsubscribe,
  currentPermission,
  isPushSupported,
} from '@/lib/push/register'

const DISMISS_KEY = 'ara:staff-push-dismissed'

export function StaffPushToggle() {
  const [state, setState] = useState<'on' | 'off' | 'unsupported' | 'denied' | 'loading'>('loading')

  useEffect(() => {
    if (!isPushSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser capability
      setState('unsupported')
      return
    }
    const perm = currentPermission()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads permission state
    if (perm === 'granted') setState('on')
    else if (perm === 'denied') setState('denied')
    else setState('off')
  }, [])

  async function toggle() {
    if (state === 'on') {
      await unsubscribe()
      setState('off')
      return
    }
    if (state === 'off') {
      localStorage.removeItem(DISMISS_KEY)
      const r = await requestAndSubscribe()
      if (r.ok) setState('on')
      else if (r.reason === 'denied') setState('denied')
    }
  }

  const Icon = state === 'on' ? Bell : BellOff
  const label =
    state === 'on' ? 'Avisos por push ativos'
    : state === 'off' ? 'Ativar avisos por push'
    : state === 'denied' ? 'Permissão negada no navegador'
    : state === 'unsupported' ? 'Push não suportado neste navegador'
    : 'Carregando…'
  const hint =
    state === 'on' ? 'Toque pra desativar.'
    : state === 'off' ? 'Recebe aviso de novo agendamento.'
    : state === 'denied' ? 'Habilite nas configurações do navegador.'
    : state === 'unsupported' ? 'Tente no Chrome, Edge ou Safari PWA.'
    : ' '

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'unsupported' || state === 'denied' || state === 'loading'}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg">{label}</p>
        <p className="truncate text-[0.8125rem] text-fg-muted">{hint}</p>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Mount the banner on agenda page**

Open `src/app/salon/(authenticated)/dashboard/agenda/page.tsx`. Find the JSX where the header ends and the list begins. Add the banner above the list.

Since `agenda/page.tsx` is a server component, import the client banner:

```typescript
import { StaffPushBanner } from '@/components/push/staff-push-banner'
```

Insert `<StaffPushBanner />` after the `<header>` block, before the list.

- [ ] **Step 4: Add the toggle to /mais**

Open `src/app/salon/(authenticated)/dashboard/mais/page.tsx`. The file has a `SECTIONS` array. Add a new section for Notifications or add to an existing one:

```typescript
import { StaffPushToggle } from '@/components/push/staff-push-toggle'
```

Add a new `<section>` block after Cadastros/Agenda sections, before the logout card:

```tsx
<section>
  <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
    Avisos
  </h2>
  <Card className="shadow-xs">
    <ul className="divide-y divide-border">
      <li>
        <StaffPushToggle />
      </li>
    </ul>
  </Card>
</section>
```

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add src/components/push/staff-push-banner.tsx src/components/push/staff-push-toggle.tsx src/app/salon/(authenticated)/dashboard/agenda/page.tsx src/app/salon/(authenticated)/dashboard/mais/page.tsx
git commit -m "feat(notifications): banner + toggle de push pro staff"
```

---

### Task D2: Smoke — push staff

- [ ] **Step 1: Log in as staff**

Ask user to open a different browser profile / incognito window and log in at `http://barbearia-teste.lvh.me:3008/salon/login` with seed credentials.

- [ ] **Step 2: Banner visible on agenda**

Navigate to `/salon/dashboard/agenda`. The banner should appear above the list. Click "Ativar" → browser permission prompt → accept.

- [ ] **Step 3: Verify subscription saved with tenant_id**

```sql
select user_id, tenant_id, user_agent
from push_subscriptions
where tenant_id is not null
order by created_at desc
limit 5;
```

Expect a row with staff user_id and the tenant_id of barbearia-teste.

- [ ] **Step 4: Trigger staff push**

In another window (customer), book a new appointment for barbearia-teste. Within seconds, the staff browser should show a notification ("Novo agendamento — [customer] — [service]").

- [ ] **Step 5: Click notification opens detail**

Click the notification → opens `/salon/dashboard/agenda/[id]`.

- [ ] **Step 6: Toggle in /mais**

Navigate to `/salon/dashboard/mais`. Find "Avisos" section with the toggle. Click it → should unsubscribe (state changes to "Ativar avisos por push"). Click again → re-subscribes.

---

## Phase E — Cancelamento

### Task E1: Wire `canceled_by` into cancel server actions

**Files:**
- Modify: `src/app/actions/appointments/cancel.ts` (or wherever customer cancels — find via grep)
- Modify: `src/app/salon/(authenticated)/actions/appointment-status.ts`

- [ ] **Step 1: Locate customer cancel action**

Run:

```bash
rg -n "cancel" src/app/ --type ts | grep -i customer
```

Find the server action that handles customer-side cancel. Likely something in `src/app/actions/appointments/` or `src/app/meus-agendamentos/actions.ts`.

- [ ] **Step 2: Set canceled_by=CUSTOMER**

In the customer cancel action, when updating status to `CANCELED`, include `canceled_by: 'CUSTOMER'` in the update payload.

Example pattern:

```typescript
const { error } = await supabase
  .from('appointments')
  .update({
    status: 'CANCELED',
    canceled_by: 'CUSTOMER',
    cancel_reason: reason ?? null,
    canceled_at: new Date().toISOString(),
  })
  .eq('id', appointmentId)
  .eq('customer_id', customerId)
```

- [ ] **Step 3: Set canceled_by=STAFF in staff action**

Open `src/app/salon/(authenticated)/actions/appointment-status.ts`. Find the transition to `CANCELED`. Add `canceled_by: 'STAFF'` to the update.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "feat(appointments): preenche canceled_by (CUSTOMER|STAFF) ao cancelar"
```

---

### Task E2: Smoke — cancelamento

- [ ] **Step 1: Customer cancels own reservation**

Ask user:
1. As customer, `/meus-agendamentos`, click Cancelar em uma reserva futura.
2. Confirm via modal.
3. Status turns CANCELED.

- [ ] **Step 2: Verify webhook fired → emails + pushes**

Check email inbox (the customer's): "Reserva cancelada — [date]" email arrives with "Olá, recebemos seu cancelamento."

Push on customer's browser: "Reserva cancelada — [service]".

Push on staff's browser: "Reserva cancelada — [customer] — [service]".

- [ ] **Step 3: Verify notification_log**

```sql
select channel, event, recipient, status, created_at
from notification_log
where event = 'cancellation'
order by created_at desc
limit 10;
```

Expect rows for email (customer) + push (customer) + push (staff).

- [ ] **Step 4: Staff cancels**

As staff in /salon/dashboard/agenda, open a future appointment, click Cancelar, fill reason, confirm.

- [ ] **Step 5: Verify staff-initiated email**

Customer receives email with text "o salão cancelou sua reserva" (different from self-cancel text).

---

## Phase F — Reminders (cron)

### Task F1: Edge function `send-reminders`

**Files:**
- Create: `supabase/functions/send-reminders/index.ts`

- [ ] **Step 1: Write the function**

Write to `supabase/functions/send-reminders/index.ts`:

```typescript
import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendPushToUser } from '../_shared/channels/push.ts'
import { formatTime } from '../_shared/format.ts'

const CRON_SECRET = Deno.env.get('CRON_SECRET')!

type Window = '24h' | '2h'

async function processWindow(window: Window) {
  const client = createAdminClient()
  const flagColumn = window === '24h' ? 'reminder_24h_sent_at' : 'reminder_2h_sent_at'
  const lower = window === '24h' ? '23 hours 55 minutes' : '1 hour 55 minutes'
  const upper = window === '24h' ? '24 hours 5 minutes' : '2 hours 5 minutes'

  const { data: rows, error } = await client.rpc('select_reminder_candidates', {
    p_flag_column: flagColumn,
    p_lower_interval: lower,
    p_upper_interval: upper,
  })

  if (error || !rows) {
    console.error('query failed', error)
    return { processed: 0, sent: 0 }
  }

  let sent = 0
  for (const row of rows as Array<{
    id: string
    tenant_id: string
    start_at: string
    service_name: string
    customer_user_id: string | null
  }>) {
    if (!row.customer_user_id) continue

    const r = await sendPushToUser(row.customer_user_id, {
      title: window === '24h' ? 'Lembrete: amanhã' : 'Lembrete: em 2h',
      body: `${row.service_name} às ${formatTime(row.start_at)}`,
      url: `/meus-agendamentos/${row.id}`,
      tag: `reminder-${window}-${row.id}`,
    })

    // Mark sent regardless of individual subscription outcomes
    await client
      .from('appointments')
      .update({ [flagColumn]: new Date().toISOString() })
      .eq('id', row.id)
      .is(flagColumn, null)

    await client.from('notification_log').insert({
      tenant_id: row.tenant_id,
      appointment_id: row.id,
      channel: 'push',
      event: window === '24h' ? 'reminder_24h' : 'reminder_2h',
      recipient: row.customer_user_id,
      status: r.sent > 0 ? 'sent' : 'failed',
      error_message: r.sent === 0 ? 'no successful push send' : null,
    })

    if (r.sent > 0) sent++
  }

  return { processed: rows.length, sent }
}

Deno.serve(async (req) => {
  // Auth check
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  try {
    const [r24, r2] = await Promise.all([processWindow('24h'), processWindow('2h')])
    return new Response(JSON.stringify({ r24, r2 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('send-reminders error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
    })
  }
})
```

- [ ] **Step 2: Create the RPC function used by the edge function**

Use MCP `mcp__supabase__apply_migration` with name `reminders_rpc`:

```sql
create or replace function public.select_reminder_candidates(
  p_flag_column text,
  p_lower_interval text,
  p_upper_interval text
)
returns table(
  id uuid,
  tenant_id uuid,
  start_at timestamptz,
  service_name text,
  customer_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- only service role calls this
revoke all on function public.select_reminder_candidates(text, text, text) from public;
grant execute on function public.select_reminder_candidates(text, text, text) to service_role;
```

- [ ] **Step 3: Deploy the function**

Use MCP `mcp__supabase__deploy_edge_function` with name `send-reminders` — include `index.ts` + all `_shared/` files.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-reminders
git commit -m "feat(notifications): edge function send-reminders + RPC select_reminder_candidates"
```

---

### Task F2: Schedule the cron

**Files:** none (SQL migration only)

- [ ] **Step 1: Apply the cron schedule**

Use MCP `mcp__supabase__apply_migration` with name `schedule_reminders_cron`:

```sql
-- unschedule any previous version
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'send-reminders';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

-- schedule every 5min
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $cmd$
    select net.http_post(
      url := 'https://sixgkgiirifigoiqbyow.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
```

- [ ] **Step 2: Verify the job is scheduled**

Use MCP `mcp__supabase__execute_sql`:

```sql
select jobname, schedule, active from cron.job where jobname = 'send-reminders';
```

Expect: 1 row, `active=true`, `schedule='*/5 * * * *'`.

- [ ] **Step 3: Trigger once manually to verify**

```sql
select cron.schedule_in_database(...) -- or call directly:
select net.http_post(
  url := 'https://sixgkgiirifigoiqbyow.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object(
    'content-type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.cron_secret')
  ),
  body := '{}'::jsonb
);
```

Expect HTTP 200 response.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore(notifications): agenda cron send-reminders (aplicado via MCP)"
```

(Migration was applied via MCP; the empty commit just records the event in the repo history.)

---

### Task F3: Smoke — reminders

- [ ] **Step 1: Seed a near-future appointment**

Use MCP `mcp__supabase__execute_sql` to shift an existing customer-subscribed appointment into the 24h window:

```sql
update appointments
set start_at = now() + interval '24 hours',
    reminder_24h_sent_at = null,
    reminder_2h_sent_at = null,
    status = 'SCHEDULED'
where id = '<id of a test appointment owned by the subscribed customer>';
```

Pick an appointment whose customer has an active push subscription (verify via `push_subscriptions`).

- [ ] **Step 2: Wait for cron or trigger manually**

Either wait up to 5min for the cron fire, or trigger manually:

```sql
select net.http_post(
  url := 'https://sixgkgiirifigoiqbyow.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object(
    'content-type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.cron_secret')
  ),
  body := '{}'::jsonb
);
```

- [ ] **Step 3: Verify push arrived**

Customer's browser should show "Lembrete: amanhã — [service] às [time]".

- [ ] **Step 4: Verify idempotency**

```sql
select id, reminder_24h_sent_at from appointments where id = '<same id>';
```

Expect `reminder_24h_sent_at` is non-null.

Trigger the cron a second time (same http_post). No duplicate push should arrive (the flag prevents re-dispatch).

- [ ] **Step 5: Repeat for 2h window**

```sql
update appointments
set start_at = now() + interval '2 hours',
    reminder_2h_sent_at = null
where id = '<same id>';
```

Trigger cron. Verify a 2h reminder push arrives.

---

## Phase G — Polish + smoke test update

### Task G1: PWA badge in /salon/dashboard/clientes

**Files:**
- Modify: `src/app/salon/(authenticated)/dashboard/clientes/page.tsx`

- [ ] **Step 1: Update the query to include PWA columns**

Open `src/app/salon/(authenticated)/dashboard/clientes/page.tsx`. Find the Supabase query. Add `pwa_installed_at, pwa_install_dismissed_at` to the `.select(...)`.

- [ ] **Step 2: Render the badge**

Next to each customer's name in the list, render a badge. Insert markup like:

```tsx
{customer.pwa_installed_at ? (
  <span className="ml-2 rounded-full bg-success-bg px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-success">
    📱 Instalado
  </span>
) : customer.pwa_install_dismissed_at ? (
  <span
    className="ml-2 rounded-full bg-bg-subtle px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle"
    title={`Dispensou em ${new Date(customer.pwa_install_dismissed_at).toLocaleDateString('pt-BR')}`}
  >
    — Dispensou
  </span>
) : (
  <span className="ml-2 rounded-full bg-bg-subtle px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
    — Não instalado
  </span>
)}
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/salon/(authenticated)/dashboard/clientes/page.tsx
git commit -m "feat(clientes): badge PWA (instalado/dispensou/não instalado)"
```

---

### Task G2: Update smoke test doc

**Files:**
- Modify: `docs/smoke-test-pilot.md`

- [ ] **Step 1: Add notifications sections**

Open `docs/smoke-test-pilot.md`. Add a new top-level section after section 4 (or before LGPD), insert before "## 8. LGPD":

````markdown
## 7c. Notificações — confirmação (email + push cliente)

- [ ] Agendar pelo wizard: email "Reserva confirmada" chega no inbox do cliente.
- [ ] Prompt de push aparece após confirmar; aceitar registra subscription.
- [ ] Próximo agendamento com push ativo: push "Horário marcado" chega em <5s.
- [ ] Clicar notificação abre `/meus-agendamentos/[id]`.

## 7d. Notificações — cancelamento

- [ ] Cliente cancela: email com "recebemos seu cancelamento" + push pro cliente + push pro staff.
- [ ] Staff cancela: email com "o salão cancelou" + pushes equivalentes.
- [ ] `canceled_by` preenchido corretamente em `appointments`.

## 7e. Notificações — staff push

- [ ] Primeiro acesso em `/salon/dashboard/agenda`: banner "Ativar avisos" aparece.
- [ ] Ativar registra subscription com tenant_id. Em X do banner: dispensa permanente.
- [ ] Recuperação via toggle em `/salon/dashboard/mais` → Avisos.
- [ ] Novo agendamento via cliente → push no staff em <5s.

## 7f. Notificações — lembretes

- [ ] Appointment com `start_at = now()+24h` recebe push de lembrete em ≤5min (cron).
- [ ] Flag `reminder_24h_sent_at` é preenchida após envio.
- [ ] Cron disparando 2× não duplica push.
- [ ] Mesmo fluxo pro 2h.

## 7g. PWA install

- [ ] Cliente logado sem PWA instalada: bottom sheet aparece no login.
- [ ] Chrome/Edge: botão "Instalar" usa dialog nativo.
- [ ] iOS Safari: instruções manuais.
- [ ] "Mais tarde" salva `pwa_install_dismissed_at` + dismissa 30d.
- [ ] Após instalar: `pwa_installed_at` preenche, badge "📱 Instalado" em `/salon/dashboard/clientes`.

## 7h. Notificações — auditoria

- [ ] `notification_log` tem rows com `status=sent` pros eventos disparados.
- [ ] Falhas aparecem com `error_message` preenchido.
````

- [ ] **Step 2: Update the technical smoke list**

In section 10, add:

```markdown
- [ ] `notification_log` sem rows com `status=failed` recentes (ou só com causas conhecidas).
- [ ] Edge function logs sem erros 500 não explicados.
```

- [ ] **Step 3: Commit**

```bash
git add docs/smoke-test-pilot.md
git commit -m "docs(smoke): seções 7c-h cobrindo notificações + PWA install"
```

---

### Task G3: Final verification

- [ ] **Step 1: Run all local checks**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: zero errors. Lint warnings pre-existing in `customer-client.ts` tolerated.

- [ ] **Step 2: Review edge function logs for 24h**

Use MCP `mcp__supabase__get_logs` with `service=edge-function`. Scan for 500s or repeated failures in `on-appointment-event` and `send-reminders`.

- [ ] **Step 3: Review advisors**

Use MCP `mcp__supabase__get_advisors` with `{type: 'security'}` and `{type: 'performance'}`. Resolve anything new introduced by this plan.

- [ ] **Step 4: Final commit (if nothing else)**

If all green, no commit needed. Otherwise fix and commit.

---

## Post-implementation checklist

- [ ] All Phase A-G tasks checked off
- [ ] Smoke test doc updated
- [ ] `pnpm build` green
- [ ] Supabase advisors green
- [ ] VAPID keys stored as secrets (not committed)
- [ ] Resend domain verified in prod (or pending if dev-only for now)
- [ ] Database Webhook enabled pointing to `on-appointment-event`
- [ ] `cron.job` has active `send-reminders` schedule
- [ ] README/CLAUDE.md updated if any new env var conventions introduced
