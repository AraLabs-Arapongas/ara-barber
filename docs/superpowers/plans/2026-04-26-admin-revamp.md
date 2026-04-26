# Admin Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/admin/dashboard/*` em uma central operacional completa: revamp das 5 telas top-level + reorganização da Mais em 5 seções com 14 sub-telas, wizard de criação manual de agendamento, novas migrations (regras, bloqueios tenant-wide, message templates) e integração com edge functions.

**Architecture:** Layered execution. Schema antes, foundation utils depois, wizard manual em cima, revamps de UI no topo. Slot calculator vira util shared client/server. Wizard manual roda client-side com fetch único de contexto. Bloqueios passam a aceitar `professional_id NULL` (vale pro tenant inteiro). Message templates ficam editáveis em DB com fallback hard-coded na edge function.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres + Auth + Realtime + Storage + Edge Functions), Tailwind 4, Zod, lucide-react.

**Source spec:** [`docs/superpowers/specs/2026-04-26-admin-revamp-design.md`](../specs/2026-04-26-admin-revamp-design.md)

**Validation approach:** Sem testes automáticos novos (convenção do repo, ver AGENTS.md). Cada commit atualiza `docs/smoke-test-pilot.md` com fluxos novos/alterados. Smoke verificado manualmente em `http://barbearia-teste.lvh.me:3008` antes do commit.

**Manual actions flagged in the plan (pause and ask the user):**
- Aplicar migrations via MCP (`mcp__supabase__apply_migration`) — usuário aprova nome/conteúdo
- Regenerar types (`mcp__supabase__generate_typescript_types`) — output sobrescreve `src/lib/supabase/types.ts`
- Atualizar Épico 10 (`docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md`) com itens #31 e #32

**Decisão revisada do spec:** WhatsApp helper. Spec diz criar `src/lib/messaging/whatsapp.ts`, mas exploração mostrou `src/lib/contact/whatsapp.ts` já existindo com `buildWhatsappUrl` e `buildTelUrl`. **Plano reutiliza o módulo existente**, estendendo com template substitution onde necessário.

---

## Pre-requirements

Antes de começar:

- [ ] Branch `claude/nifty-pascal-489446` (worktree atual) é onde tudo acontece.
- [ ] `pnpm dev` rodando na porta 3008 com Supabase cloud `sixgkgiirifigoiqbyow`.
- [ ] Tenant `barbearia-teste` seeded com staff `dono@barbearia-teste.test` / `barber1234` (smoke test referência).
- [ ] Cada commit deste plano respeita a regra do AGENTS.md: smoke test atualizado **no mesmo commit** se mudou fluxo visível.

---

## Phase 0 — Schema + types (C1)

**Goal:** Aplicar M1 + M2 + M3, seedar templates default, regenerar types TS.

**Files:**
- Apply via MCP: 3 migrations (`revamp_booking_rules`, `revamp_blocks_tenant_wide`, `revamp_message_templates`)
- Apply via MCP: seed defaults SQL
- Modify: `src/lib/supabase/types.ts` (regenerated)
- Modify: `src/lib/booking/slots.ts:30-37` (relaxar tipo `AvailabilityBlock` para aceitar `professionalId: string | null`)
- Modify: `src/lib/booking/queries.ts:34-37` (mesmo, `professionalId: string | null`)

### Task 0.1: Aplicar Migration M1 — regras de agendamento

- [ ] **Step 1: Pedir aprovação ao usuário** (manual action)

Confirmar com o usuário que está OK aplicar a migration `revamp_booking_rules`. Mostrar o SQL exato que vai ser executado.

- [ ] **Step 2: Aplicar via MCP**

Usar `mcp__supabase__apply_migration`:

```
name: revamp_booking_rules
query: |
  alter table public.tenants
    add column min_advance_hours integer not null default 0
      check (min_advance_hours >= 0),
    add column slot_interval_minutes integer not null default 15
      check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
    add column customer_can_cancel boolean not null default true;
```

- [ ] **Step 3: Verificar colunas existem**

Usar `mcp__supabase__execute_sql`:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tenants'
  and column_name in ('min_advance_hours', 'slot_interval_minutes', 'customer_can_cancel');
```

Esperado: 3 rows.

### Task 0.2: Aplicar Migration M2 — bloqueios tenant-wide

- [ ] **Step 1: Pedir aprovação ao usuário** (manual action)

- [ ] **Step 2: Aplicar via MCP**

```
name: revamp_blocks_tenant_wide
query: |
  alter table public.availability_blocks
    alter column professional_id drop not null;

  create index availability_blocks_tenant_window_idx
    on public.availability_blocks (tenant_id, start_at, end_at)
    where professional_id is null;
```

- [ ] **Step 3: Verificar nullable**

```sql
select is_nullable from information_schema.columns
where table_schema = 'public'
  and table_name = 'availability_blocks'
  and column_name = 'professional_id';
```

Esperado: `YES`.

### Task 0.3: Aplicar Migration M3 — message templates

- [ ] **Step 1: Pedir aprovação ao usuário** (manual action)

- [ ] **Step 2: Aplicar via MCP**

```
name: revamp_message_templates
query: |
  create table public.tenant_message_templates (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    channel text not null check (channel in ('EMAIL', 'WHATSAPP')),
    event text not null check (event in (
      'BOOKING_CONFIRMATION',
      'BOOKING_CANCELLATION',
      'BOOKING_REMINDER',
      'BOOKING_THANKS',
      'SHARE_LINK',
      'CUSTOM'
    )),
    enabled boolean not null default true,
    subject text,
    body text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, channel, event)
  );

  create index tenant_message_templates_tenant_idx
    on public.tenant_message_templates (tenant_id);

  alter table public.tenant_message_templates enable row level security;

  create policy tenant_message_templates_staff_all on public.tenant_message_templates
    for all using (public.is_tenant_staff(tenant_id))
    with check (public.is_tenant_staff(tenant_id));

  create policy tenant_message_templates_platform_admin on public.tenant_message_templates
    for all using (public.is_platform_admin())
    with check (public.is_platform_admin());
```

- [ ] **Step 3: Seedar defaults**

Usar `mcp__supabase__execute_sql`:

```sql
insert into public.tenant_message_templates (tenant_id, channel, event, subject, body)
select t.id, c.channel, c.event, c.subject, c.body
from public.tenants t
cross join (values
  ('EMAIL',    'BOOKING_CONFIRMATION', 'Seu agendamento foi confirmado',  'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.'),
  ('EMAIL',    'BOOKING_CANCELLATION', 'Seu agendamento foi cancelado',   'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.'),
  ('EMAIL',    'BOOKING_REMINDER',     'Lembrete do seu agendamento',     'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.'),
  ('WHATSAPP', 'BOOKING_CONFIRMATION', null, 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}. Qualquer coisa, me avisa por aqui!'),
  ('WHATSAPP', 'BOOKING_REMINDER',     null, 'Oi {nome}, lembrete: você tem {servico} {horario}. Te espero!'),
  ('WHATSAPP', 'SHARE_LINK',           null, 'Oi! Agora você pode agendar comigo direto por aqui: {link}')
) as c(channel, event, subject, body)
on conflict (tenant_id, channel, event) do nothing;
```

- [ ] **Step 4: Verificar seed**

```sql
select tenant_id, count(*) from public.tenant_message_templates group by tenant_id;
```

Esperado: 6 rows por tenant existente.

### Task 0.4: Rodar advisors

- [ ] **Step 1: Security advisors**

Usar `mcp__supabase__get_advisors({type: 'security'})`. Verificar se aparecem warnings novos relacionados às tabelas/colunas adicionadas. Se aparecer, anotar e tratar antes de seguir.

- [ ] **Step 2: Performance advisors**

Usar `mcp__supabase__get_advisors({type: 'performance'})`. Mesma checagem.

### Task 0.5: Regenerar types TS

- [ ] **Step 1: Gerar via MCP**

Usar `mcp__supabase__generate_typescript_types`. Output sobrescreve `src/lib/supabase/types.ts`.

- [ ] **Step 2: Verificar tipos novos**

Confirmar que `Database['public']['Tables']['tenant_message_templates']` existe e tem `Row`, `Insert`, `Update`. Confirmar que `Database['public']['Tables']['tenants']['Row']` agora inclui `min_advance_hours`, `slot_interval_minutes`, `customer_can_cancel`.

- [ ] **Step 3: Confirmar `availability_blocks.professional_id` é nullable**

Em `src/lib/supabase/types.ts`, dentro de `availability_blocks.Row`, `professional_id` agora é `string | null`.

### Task 0.6: Relaxar tipos no booking module

- [ ] **Step 1: Editar `src/lib/booking/queries.ts`**

Localizar `export type AvailabilityBlock` (linha ~32-37):

```typescript
export type AvailabilityBlock = {
  professionalId: string | null
  startAt: string
  endAt: string
}
```

Mudar `professionalId: string` → `professionalId: string | null`.

- [ ] **Step 2: Editar `src/lib/booking/slots.ts`**

Localizar import/uso de `AvailabilityBlock`. Garantir que tipo casa com a mudança acima. Não mexer em lógica ainda — só tipo. (Lógica é updated em C2.)

- [ ] **Step 3: Rodar typecheck**

```bash
pnpm typecheck
```

Esperado: sem erros novos.

### Task 0.7: Atualizar smoke test (delta de schema)

- [ ] **Step 1: Editar `docs/smoke-test-pilot.md`**

Adicionar nota nos prerequisitos:

```markdown
> **Pré-condição (após revamp 2026-04-26):** colunas `tenants.{min_advance_hours, slot_interval_minutes, customer_can_cancel}` existem; `availability_blocks.professional_id` é nullable; tabela `tenant_message_templates` seedada com 6 templates default por tenant.
```

### Task 0.8: Commit C1

- [ ] **Step 1: Verificar working tree**

```bash
git status
```

Esperado: modificados `src/lib/supabase/types.ts`, `src/lib/booking/queries.ts`, `src/lib/booking/slots.ts`, `docs/smoke-test-pilot.md`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/booking/queries.ts src/lib/booking/slots.ts docs/smoke-test-pilot.md
git commit -m "feat(db): schema do revamp (regras + bloqueios tenant-wide + message templates)

- M1: tenants ganha min_advance_hours, slot_interval_minutes, customer_can_cancel
- M2: availability_blocks.professional_id vira NULL-able + índice tenant-wide
- M3: tenant_message_templates (channel, event, subject, body, enabled) com RLS staff/platform_admin
- Seed defaults: 3 EMAIL + 3 WHATSAPP por tenant existente
- Types TS regenerados; tipo AvailabilityBlock relaxa professionalId pra string|null"
```

---

## Phase 1 — Foundation (C2)

**Goal:** Foundation utils que C3+ vão consumir. Sem UI nova; só código de biblioteca + uma server action.

**Files:**
- Modify: `src/lib/booking/slots.ts` (lógica: aceitar blocks com `professionalId === null`)
- Create: `src/app/admin/(authenticated)/actions/booking-context.ts` (server action `getBookingContext`)
- Create: `src/lib/admin/derivations.ts` (utils `isLate`, `worksToday`, `hasNoSchedule`)
- Modify: `src/lib/contact/whatsapp.ts` (estender com `applyTemplate(body, vars)`)

### Task 1.1: Slot calculator respeita tenant-wide blocks

- [ ] **Step 1: Localizar a função `computeSlots` em `src/lib/booking/slots.ts`**

Função na linha 116. Procurar o trecho que filtra `blocks` por professional. Hoje filtra `b.professionalId === professionalId` em algum loop interno.

- [ ] **Step 2: Atualizar filtro de blocks**

Mudar o predicado pra incluir tenant-wide (NULL):

```typescript
// dentro de computeSlots, ao verificar conflito de slot com block:
const blocksForCandidate = input.blocks.filter(
  (b) => b.professionalId === professionalId || b.professionalId === null,
)
```

(O nome da variável pode variar; o ponto é OR com `=== null`.)

- [ ] **Step 3: Verificar `getBlocksInWindow` (em `src/lib/booking/queries.ts` ou `src/lib/appointments/queries.ts`)**

Confirmar se a query SQL atual filtra por `professional_id = X`. Se filtrar, mudar para `(professional_id = X OR professional_id IS NULL) AND tenant_id = Y`. A função usada pelo public booking pra carregar blocks pra um profissional candidato precisa devolver blocks tenant-wide também.

```typescript
// exemplo de query atualizada:
const { data } = await supabase
  .from('availability_blocks')
  .select('professional_id, start_at, end_at')
  .eq('tenant_id', tenantId)
  .or(`professional_id.eq.${professionalId},professional_id.is.null`)
  .gte('end_at', windowStart)
  .lte('start_at', windowEnd)
```

- [ ] **Step 4: Smoke verificar (sem UI nova ainda)**

Em `http://barbearia-teste.lvh.me:3008/book`, rodar wizard público completo. Confirmar que `/book/horario` ainda lista slots corretamente (regressão zero pro caso `professional_id != null`).

Manualmente, via MCP:

```sql
-- criar block tenant-wide hoje das 14h às 16h
insert into public.availability_blocks (tenant_id, professional_id, start_at, end_at, reason)
select id, null, (current_date::timestamptz + interval '14 hours') at time zone timezone,
       (current_date::timestamptz + interval '16 hours') at time zone timezone, 'Teste tenant-wide'
from public.tenants where slug = 'barbearia-teste';
```

Re-rodar wizard público pra mesma data. Confirmar que slots 14:00-16:00 somem pra TODOS os profissionais.

Limpar:

```sql
delete from public.availability_blocks where reason = 'Teste tenant-wide';
```

### Task 1.2: Server action `getBookingContext`

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/booking-context.ts`**

```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'
import type {
  BookingService,
  BookingProfessional,
  BusinessHour,
  ProfessionalAvailabilityEntry,
  AvailabilityBlock,
} from '@/lib/booking/queries'

const Input = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data YYYY-MM-DD'),
})

export type BookingContext = {
  tenantId: string
  tenantTimezone: string
  services: BookingService[]
  professionals: BookingProfessional[]
  professionalServices: Array<{ professionalId: string; serviceId: string }>
  businessHours: BusinessHour[]
  availability: ProfessionalAvailabilityEntry[]
  blocks: AvailabilityBlock[]
  existingAppointments: Array<{
    professionalId: string
    startAt: string
    endAt: string
  }>
}

export async function getBookingContext(
  raw: z.infer<typeof Input>,
): Promise<{ data?: BookingContext; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const { from, to } = parsed.data
  const fromISO = `${from}T00:00:00.000Z`
  const toISO = `${to}T23:59:59.999Z`

  const [services, professionals, profServices, hours, availability, blocks, appts] =
    await Promise.all([
      supabase
        .from('services')
        .select('id, name, description, duration_minutes, price_cents')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('professionals')
        .select('id, name, display_name, phone')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('professional_services')
        .select('professional_id, service_id')
        .eq('tenant_id', tenant.id),
      supabase
        .from('business_hours')
        .select('weekday, is_open, start_time, end_time')
        .eq('tenant_id', tenant.id),
      supabase
        .from('professional_availability')
        .select('professional_id, weekday, start_time, end_time')
        .eq('tenant_id', tenant.id),
      supabase
        .from('availability_blocks')
        .select('professional_id, start_at, end_at')
        .eq('tenant_id', tenant.id)
        .gte('end_at', fromISO)
        .lte('start_at', toISO),
      supabase
        .from('appointments')
        .select('professional_id, start_at, end_at')
        .eq('tenant_id', tenant.id)
        .neq('status', 'CANCELED')
        .neq('status', 'NO_SHOW')
        .gte('start_at', fromISO)
        .lte('start_at', toISO),
    ])

  return {
    data: {
      tenantId: tenant.id,
      tenantTimezone: tenant.timezone,
      services: (services.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
      })),
      professionals: (professionals.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        phone: p.phone,
      })),
      professionalServices: (profServices.data ?? []).map((r) => ({
        professionalId: r.professional_id,
        serviceId: r.service_id,
      })),
      businessHours: (hours.data ?? []).map((h) => ({
        weekday: h.weekday,
        isOpen: h.is_open,
        startTime: h.start_time,
        endTime: h.end_time,
      })),
      availability: (availability.data ?? []).map((a) => ({
        professionalId: a.professional_id,
        weekday: a.weekday,
        startTime: a.start_time,
        endTime: a.end_time,
      })),
      blocks: (blocks.data ?? []).map((b) => ({
        professionalId: b.professional_id,
        startAt: b.start_at,
        endAt: b.end_at,
      })),
      existingAppointments: (appts.data ?? []).map((a) => ({
        professionalId: a.professional_id,
        startAt: a.start_at,
        endAt: a.end_at,
      })),
    },
  }
}
```

- [ ] **Step 2: Confirmar que `assertStaff` existe**

```bash
grep -rn "export.*assertStaff" src/lib/auth/
```

Se não existir com esse nome, adaptar import (pode ser `assertTenantStaff` ou similar). A guard precisa rejeitar non-staff.

- [ ] **Step 3: Smoke verificar typecheck**

```bash
pnpm typecheck
```

Sem erros.

### Task 1.3: Utils de derivação

- [ ] **Step 1: Criar `src/lib/admin/derivations.ts`**

```typescript
import type { AgendaAppointment } from '@/lib/appointments/queries'

/**
 * Considera atrasado quando o appointment ainda está em estado "pendente"
 * (SCHEDULED ou CONFIRMED) e o horário de início já passou.
 */
export function isLate(
  appointment: { status: string; startAt: string },
  now: Date = new Date(),
): boolean {
  if (appointment.status !== 'SCHEDULED' && appointment.status !== 'CONFIRMED') return false
  return new Date(appointment.startAt).getTime() < now.getTime()
}

/**
 * Retorna minutos de atraso (ou 0 se não está atrasado).
 */
export function lateMinutes(
  appointment: { status: string; startAt: string },
  now: Date = new Date(),
): number {
  if (!isLate(appointment, now)) return 0
  return Math.floor((now.getTime() - new Date(appointment.startAt).getTime()) / 60000)
}

export type WorkingWindow = { startTime: string; endTime: string }

/**
 * Devolve o intervalo de trabalho do profissional no dia (no timezone do tenant).
 * Retorna null se o profissional não tem availability cadastrada pro weekday.
 */
export function worksToday(
  availability: Array<{ professionalId: string; weekday: number; startTime: string; endTime: string }>,
  professionalId: string,
  weekday: number,
): WorkingWindow | null {
  const entry = availability.find(
    (a) => a.professionalId === professionalId && a.weekday === weekday,
  )
  if (!entry) return null
  return { startTime: entry.startTime, endTime: entry.endTime }
}

/**
 * True se o profissional não tem nenhuma `professional_availability` cadastrada
 * (nenhum dia da semana). Usado pra alerta "sem horário configurado".
 */
export function hasNoSchedule(
  availability: Array<{ professionalId: string }>,
  professionalId: string,
): boolean {
  return !availability.some((a) => a.professionalId === professionalId)
}

/**
 * Conta agendamentos ativos (excluindo CANCELED/NO_SHOW) de um profissional num dia.
 */
export function countAppointmentsForProfessional(
  appointments: AgendaAppointment[],
  professionalId: string,
): number {
  return appointments.filter(
    (a) =>
      a.professionalId === professionalId &&
      a.status !== 'CANCELED' &&
      a.status !== 'NO_SHOW',
  ).length
}
```

- [ ] **Step 2: Smoke verificar typecheck**

```bash
pnpm typecheck
```

### Task 1.4: WhatsApp helper estendido

- [ ] **Step 1: Ler `src/lib/contact/whatsapp.ts` atual**

Verificar exports existentes (`buildWhatsappUrl`, `buildTelUrl`).

- [ ] **Step 2: Adicionar `applyTemplate`**

No mesmo arquivo, adicionar:

```typescript
/**
 * Substitui placeholders {chave} no body por valores. Placeholders sem valor
 * permanecem literais (não vira "undefined" ou string vazia).
 *
 * Exemplo: applyTemplate("Oi {nome}, {servico} às {horario}", { nome: "Ana", servico: "Corte", horario: "14h" })
 *       → "Oi Ana, Corte às 14h"
 */
export function applyTemplate(
  body: string,
  vars: Record<string, string | undefined | null>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key]
    return v == null || v === '' ? match : v
  })
}

/**
 * Conveniência: gera URL `wa.me/<phone>?text=<msg>` aplicando template + percent-encoding.
 */
export function buildWhatsappFromTemplate(
  phone: string,
  template: string,
  vars: Record<string, string | undefined | null>,
): string {
  const body = applyTemplate(template, vars)
  return buildWhatsappUrl(phone, body)
}
```

- [ ] **Step 3: Smoke verificar typecheck**

```bash
pnpm typecheck
```

### Task 1.5: Atualizar smoke test (foundation)

- [ ] **Step 1: Editar `docs/smoke-test-pilot.md`**

Adicionar seção curta (não testa UI ainda — apenas documenta a invariante):

```markdown
## 0c. Foundation utils (revamp 2026-04-26)

- [ ] `getBookingContext({from, to})` retorna `{services, professionals, professionalServices, businessHours, availability, blocks, existingAppointments}` num único payload (testar via wizard manual em fase posterior).
- [ ] Slot calculator respeita `availability_blocks.professional_id IS NULL` (block tenant-wide some pra todo profissional).
```

### Task 1.6: Commit C2

- [ ] **Step 1: Status**

```bash
git status
```

Esperado: modificados `src/lib/booking/slots.ts`, `src/lib/booking/queries.ts`, `src/lib/contact/whatsapp.ts`, `docs/smoke-test-pilot.md`. Novos: `src/app/admin/(authenticated)/actions/booking-context.ts`, `src/lib/admin/derivations.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/booking/slots.ts src/lib/booking/queries.ts src/lib/contact/whatsapp.ts src/app/admin/\(authenticated\)/actions/booking-context.ts src/lib/admin/derivations.ts docs/smoke-test-pilot.md
git commit -m "feat(admin): foundation — slot util tenant-wide-aware + getBookingContext + derivations + whatsapp template helper

- slots.ts: respeita availability_blocks com professional_id NULL (vale pro tenant inteiro)
- booking-context action: payload único com services + professionals + hours + availability + blocks + appointments do range, pra wizard manual client-side
- derivations.ts: isLate, lateMinutes, worksToday, hasNoSchedule, countAppointmentsForProfessional
- contact/whatsapp.ts: applyTemplate + buildWhatsappFromTemplate (substitution {chave} + percent-encoding)"
```

---

## Phase 2 — Wizard de criação manual (C3)

**Goal:** Rota nova `/admin/dashboard/agenda/novo` com wizard client-side. Staff cria appointment sem fluxo OTP. Cliente pode ser existente (busca por nome/telefone) ou criado on-the-fly.

**Files:**
- Create: `src/app/admin/(authenticated)/dashboard/agenda/novo/page.tsx` (server entrypoint, busca contexto inicial)
- Create: `src/app/admin/(authenticated)/dashboard/agenda/novo/wizard.tsx` ('use client', state machine + steps)
- Create: `src/app/admin/(authenticated)/actions/manual-appointment.ts` (server action `createManualAppointment`)
- Create: `src/components/dashboard/manual-booking/customer-step.tsx`
- Create: `src/components/dashboard/manual-booking/service-step.tsx`
- Create: `src/components/dashboard/manual-booking/professional-step.tsx`
- Create: `src/components/dashboard/manual-booking/datetime-step.tsx`
- Create: `src/components/dashboard/manual-booking/confirm-step.tsx`

### Task 2.1: Server action `createManualAppointment`

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/manual-appointment.ts`**

```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

const Input = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startAtISO: z.string().datetime(),
  // cliente: usa um dos dois caminhos
  customerId: z.string().uuid().optional(),
  customerNew: z
    .object({
      name: z.string().min(1).max(120),
      phone: z.string().min(8).max(20).optional(),
      email: z.string().email().optional().or(z.literal('')),
    })
    .optional(),
  notes: z.string().max(500).optional(),
})

export type CreateManualAppointmentInput = z.infer<typeof Input>

export async function createManualAppointment(
  raw: CreateManualAppointmentInput,
): Promise<{ id?: string; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const data = parsed.data
  if (!data.customerId && !data.customerNew) return { error: 'Cliente obrigatório' }

  // 1. resolver cliente
  let customerId = data.customerId
  let customerNameSnapshot: string | null = null

  if (!customerId && data.customerNew) {
    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenant.id,
        name: data.customerNew.name,
        phone: data.customerNew.phone || null,
        email: data.customerNew.email || null,
        source: 'STAFF_MANUAL',
      })
      .select('id, name')
      .single()
    if (error || !created) return { error: error?.message ?? 'Falha ao criar cliente' }
    customerId = created.id
    customerNameSnapshot = created.name
  } else if (customerId) {
    const { data: existing } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .eq('tenant_id', tenant.id)
      .single()
    customerNameSnapshot = existing?.name ?? null
  }

  // 2. carregar serviço (duração + preço snapshot)
  const { data: service } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_cents')
    .eq('id', data.serviceId)
    .eq('tenant_id', tenant.id)
    .single()
  if (!service) return { error: 'Serviço inválido' }

  const startAt = new Date(data.startAtISO)
  const endAt = new Date(startAt.getTime() + service.duration_minutes * 60_000)

  // 3. re-check de conflito server-side (defesa)
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('professional_id', data.professionalId)
    .neq('status', 'CANCELED')
    .neq('status', 'NO_SHOW')
    .lt('start_at', endAt.toISOString())
    .gt('end_at', startAt.toISOString())
    .limit(1)

  if (conflicts && conflicts.length > 0) return { error: 'Horário não disponível' }

  // 4. inserir appointment
  const { data: created, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenant.id,
      customer_id: customerId,
      professional_id: data.professionalId,
      service_id: data.serviceId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'CONFIRMED', // staff cria já confirmado
      customer_name_snapshot: customerNameSnapshot,
      service_name_snapshot: service.name,
      price_cents_snapshot: service.price_cents,
      notes: data.notes || null,
      created_via: 'STAFF_MANUAL',
    })
    .select('id')
    .single()

  if (error || !created) return { error: error?.message ?? 'Falha ao criar agendamento' }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/dashboard/agenda')
  return { id: created.id }
}
```

- [ ] **Step 2: Confirmar colunas em `appointments` e `customers`**

```bash
grep -E "customer_name_snapshot|service_name_snapshot|price_cents_snapshot|created_via|source" supabase/migrations/*.sql
```

Se `customers.source` ou `appointments.created_via` não existirem como colunas, **remover do insert** (são opcionais aqui — staff manual pode ser inferido por outros campos). Não criar coluna nova só pra isso — fica como nice-to-have futuro.

- [ ] **Step 3: Smoke verificar via SQL**

Não testa UI ainda. Apenas typecheck:

```bash
pnpm typecheck
```

### Task 2.2: Server entrypoint da rota

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/agenda/novo/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getBookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { createClient } from '@/lib/supabase/server'
import { ManualBookingWizard } from './wizard'

function todayISO(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function NewAppointmentPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const today = todayISO(tenant.timezone)
  const horizon = addDays(today, 60)

  const ctxResult = await getBookingContext({ from: today, to: horizon })
  if (ctxResult.error || !ctxResult.data) {
    throw new Error(ctxResult.error ?? 'Falha ao carregar contexto')
  }

  // pré-busca clientes ativos pra autocomplete (limita a 200 mais recentes)
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, email')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Novo agendamento
        </h1>
      </header>
      <ManualBookingWizard
        context={ctxResult.data}
        customers={(customers ?? []).map((c) => ({
          id: c.id,
          name: c.name ?? '',
          phone: c.phone,
          email: c.email,
        }))}
      />
    </main>
  )
}
```

### Task 2.3: Wizard root (state machine)

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/agenda/novo/wizard.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { CustomerStep, type CustomerSelection } from '@/components/dashboard/manual-booking/customer-step'
import { ServiceStep } from '@/components/dashboard/manual-booking/service-step'
import { ProfessionalStep } from '@/components/dashboard/manual-booking/professional-step'
import { DateTimeStep } from '@/components/dashboard/manual-booking/datetime-step'
import { ConfirmStep } from '@/components/dashboard/manual-booking/confirm-step'
import { createManualAppointment } from '@/app/admin/(authenticated)/actions/manual-appointment'

type Customer = { id: string; name: string; phone: string | null; email: string | null }

type Step = 1 | 2 | 3 | 4 | 5

type State = {
  customer: CustomerSelection | null
  serviceId: string | null
  professionalId: string | null
  startAtISO: string | null
  notes: string
}

const INIT: State = {
  customer: null,
  serviceId: null,
  professionalId: null,
  startAtISO: null,
  notes: '',
}

export function ManualBookingWizard({
  context,
  customers,
}: {
  context: BookingContext
  customers: Customer[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<State>(INIT)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function next() {
    setStep((s) => Math.min(5, (s + 1) as Step))
  }
  function back() {
    setStep((s) => Math.max(1, (s - 1) as Step))
  }

  function submit() {
    if (!state.customer || !state.serviceId || !state.professionalId || !state.startAtISO) return
    setError(null)
    startTransition(async () => {
      const customerPayload =
        state.customer!.kind === 'existing'
          ? { customerId: state.customer!.id }
          : { customerNew: state.customer! }
      const result = await createManualAppointment({
        ...customerPayload,
        serviceId: state.serviceId!,
        professionalId: state.professionalId!,
        startAtISO: state.startAtISO!,
        notes: state.notes || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/admin/dashboard/agenda/${result.id}`)
    })
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {error ? (
        <div className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      {step === 1 ? (
        <CustomerStep
          customers={customers}
          value={state.customer}
          onChange={(customer) => setState((s) => ({ ...s, customer }))}
          onNext={next}
        />
      ) : null}
      {step === 2 ? (
        <ServiceStep
          services={context.services}
          value={state.serviceId}
          onChange={(serviceId) => setState((s) => ({ ...s, serviceId, professionalId: null, startAtISO: null }))}
          onBack={back}
          onNext={next}
        />
      ) : null}
      {step === 3 ? (
        <ProfessionalStep
          context={context}
          serviceId={state.serviceId!}
          value={state.professionalId}
          onChange={(professionalId) => setState((s) => ({ ...s, professionalId, startAtISO: null }))}
          onBack={back}
          onNext={next}
        />
      ) : null}
      {step === 4 ? (
        <DateTimeStep
          context={context}
          serviceId={state.serviceId!}
          professionalId={state.professionalId!}
          value={state.startAtISO}
          onChange={(startAtISO) => setState((s) => ({ ...s, startAtISO }))}
          onBack={back}
          onNext={next}
        />
      ) : null}
      {step === 5 ? (
        <ConfirmStep
          state={state}
          context={context}
          onBack={back}
          onSubmit={submit}
          pending={pending}
          notes={state.notes}
          onNotesChange={(notes) => setState((s) => ({ ...s, notes }))}
        />
      ) : null}
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const labels = ['Cliente', 'Serviço', 'Profissional', 'Data/hora', 'Confirmar']
  return (
    <ol className="flex items-center gap-2 text-[0.75rem] font-medium uppercase tracking-[0.14em]">
      {labels.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <li
            key={label}
            className={
              active
                ? 'text-brand-primary'
                : done
                  ? 'text-fg-muted'
                  : 'text-fg-subtle'
            }
          >
            {n}. {label}
            {n < 5 ? <span className="mx-1 text-fg-subtle">·</span> : null}
          </li>
        )
      })}
    </ol>
  )
}
```

### Task 2.4: Step 1 — Cliente (existente ou novo)

- [ ] **Step 1: Criar `src/components/dashboard/manual-booking/customer-step.tsx`**

```typescript
'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Customer = { id: string; name: string; phone: string | null; email: string | null }

export type CustomerSelection =
  | { kind: 'existing'; id: string; name: string; phone: string | null; email: string | null }
  | { kind: 'new'; name: string; phone?: string; email?: string }

export function CustomerStep({
  customers,
  value,
  onChange,
  onNext,
}: {
  customers: Customer[]
  value: CustomerSelection | null
  onChange: (sel: CustomerSelection | null) => void
  onNext: () => void
}) {
  const [mode, setMode] = useState<'pick' | 'new'>(
    value?.kind === 'new' ? 'new' : 'pick',
  )
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers.slice(0, 30)
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [search, customers])

  const [newName, setNewName] = useState(value?.kind === 'new' ? value.name : '')
  const [newPhone, setNewPhone] = useState(value?.kind === 'new' ? value.phone ?? '' : '')
  const [newEmail, setNewEmail] = useState(value?.kind === 'new' ? value.email ?? '' : '')

  const canContinue =
    (mode === 'pick' && value?.kind === 'existing') ||
    (mode === 'new' && newName.trim().length > 0)

  function selectExisting(c: Customer) {
    onChange({ kind: 'existing', id: c.id, name: c.name, phone: c.phone, email: c.email })
  }

  function commitNew() {
    onChange({
      kind: 'new',
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'pick' ? 'default' : 'outline'}
          onClick={() => {
            setMode('pick')
            if (value?.kind === 'new') onChange(null)
          }}
        >
          Cliente existente
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'default' : 'outline'}
          onClick={() => {
            setMode('new')
            if (value?.kind === 'existing') onChange(null)
          }}
        >
          Novo cliente
        </Button>
      </div>

      {mode === 'pick' ? (
        <>
          <Input
            type="search"
            placeholder="Buscar por nome, telefone ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="divide-y divide-border rounded-lg border border-border">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-fg-muted">Nenhum cliente encontrado.</li>
            ) : null}
            {filtered.map((c) => {
              const selected = value?.kind === 'existing' && value.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectExisting(c)}
                    className={`flex w-full flex-col px-4 py-3 text-left transition-colors hover:bg-bg-subtle ${
                      selected ? 'bg-brand-primary/10' : ''
                    }`}
                  >
                    <span className="font-medium text-fg">{c.name}</span>
                    <span className="text-sm text-fg-muted">
                      {c.phone ?? c.email ?? '(sem contato)'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="space-y-3">
          <Input
            placeholder="Nome do cliente *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={commitNew}
          />
          <Input
            placeholder="Telefone (opcional)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            onBlur={commitNew}
          />
          <Input
            placeholder="E-mail (opcional)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onBlur={commitNew}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            if (mode === 'new') commitNew()
            onNext()
          }}
          disabled={!canContinue}
        >
          Continuar
        </Button>
      </div>
    </section>
  )
}
```

### Task 2.5: Step 2 — Serviço

- [ ] **Step 1: Criar `src/components/dashboard/manual-booking/service-step.tsx`**

```typescript
'use client'

import type { BookingService } from '@/lib/booking/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

export function ServiceStep({
  services,
  value,
  onChange,
  onBack,
  onNext,
}: {
  services: BookingService[]
  value: string | null
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <section className="space-y-4">
      <ul className="space-y-2">
        {services.map((s) => {
          const selected = value === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onChange(s.id)}
                className="block w-full text-left"
              >
                <Card
                  className={`shadow-xs transition-colors ${
                    selected ? 'border-brand-primary bg-brand-primary/5' : 'hover:bg-bg-subtle'
                  }`}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-fg">{s.name}</p>
                      <p className="text-sm text-fg-muted">
                        {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={!value}>
          Continuar
        </Button>
      </div>
    </section>
  )
}
```

### Task 2.6: Step 3 — Profissional

- [ ] **Step 1: Criar `src/components/dashboard/manual-booking/professional-step.tsx`**

```typescript
'use client'

import { useMemo } from 'react'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ProfessionalStep({
  context,
  serviceId,
  value,
  onChange,
  onBack,
  onNext,
}: {
  context: BookingContext
  serviceId: string
  value: string | null
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const candidates = useMemo(() => {
    const ids = new Set(
      context.professionalServices
        .filter((ps) => ps.serviceId === serviceId)
        .map((ps) => ps.professionalId),
    )
    return context.professionals.filter((p) => ids.has(p.id))
  }, [context, serviceId])

  return (
    <section className="space-y-4">
      {candidates.length === 0 ? (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
          Nenhum profissional vinculado a este serviço. Vincule em Equipe → [profissional] → Serviços.
        </p>
      ) : (
        <ul className="space-y-2">
          {candidates.map((p) => {
            const selected = value === p.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p.id)}
                  className="block w-full text-left"
                >
                  <Card
                    className={`shadow-xs transition-colors ${
                      selected ? 'border-brand-primary bg-brand-primary/5' : 'hover:bg-bg-subtle'
                    }`}
                  >
                    <CardContent className="py-3">
                      <p className="font-medium text-fg">{p.displayName ?? p.name}</p>
                      {p.phone ? <p className="text-sm text-fg-muted">{p.phone}</p> : null}
                    </CardContent>
                  </Card>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={!value}>
          Continuar
        </Button>
      </div>
    </section>
  )
}
```

### Task 2.7: Step 4 — Data/hora

- [ ] **Step 1: Criar `src/components/dashboard/manual-booking/datetime-step.tsx`**

```typescript
'use client'

import { useMemo, useState } from 'react'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { computeSlots } from '@/lib/booking/slots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function todayISOInTZ(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function DateTimeStep({
  context,
  serviceId,
  professionalId,
  value,
  onChange,
  onBack,
  onNext,
}: {
  context: BookingContext
  serviceId: string
  professionalId: string
  value: string | null
  onChange: (iso: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const [date, setDate] = useState<string>(() => todayISOInTZ(context.tenantTimezone))
  const service = context.services.find((s) => s.id === serviceId)!

  const slots = useMemo(() => {
    return computeSlots({
      serviceDurationMinutes: service.durationMinutes,
      dateISO: date,
      tenantTimezone: context.tenantTimezone,
      candidateProfessionalIds: [professionalId],
      businessHours: context.businessHours,
      availability: context.availability,
      blocks: context.blocks,
      existingAppointments: context.existingAppointments,
      now: new Date(),
    })
  }, [date, service, professionalId, context])

  return (
    <section className="space-y-4">
      <Input
        type="date"
        value={date}
        min={todayISOInTZ(context.tenantTimezone)}
        onChange={(e) => setDate(e.target.value)}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.length === 0 ? (
          <p className="col-span-full rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
            Sem horários disponíveis nesta data.
          </p>
        ) : null}
        {slots.map((s) => {
          const selected = value === s.startISO
          return (
            <button
              key={s.startISO}
              type="button"
              disabled={!s.available}
              onClick={() => onChange(s.startISO)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-primary bg-brand-primary text-white'
                  : s.available
                    ? 'border-border bg-bg hover:bg-bg-subtle'
                    : 'border-border bg-bg-subtle text-fg-subtle line-through'
              }`}
            >
              {s.time}
            </button>
          )
        })}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={!value}>
          Continuar
        </Button>
      </div>
    </section>
  )
}
```

### Task 2.8: Step 5 — Confirmar

- [ ] **Step 1: Criar `src/components/dashboard/manual-booking/confirm-step.tsx`**

```typescript
'use client'

import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import type { CustomerSelection } from './customer-step'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

type State = {
  customer: CustomerSelection | null
  serviceId: string | null
  professionalId: string | null
  startAtISO: string | null
  notes: string
}

export function ConfirmStep({
  state,
  context,
  notes,
  onNotesChange,
  onBack,
  onSubmit,
  pending,
}: {
  state: State
  context: BookingContext
  notes: string
  onNotesChange: (n: string) => void
  onBack: () => void
  onSubmit: () => void
  pending: boolean
}) {
  if (!state.customer || !state.serviceId || !state.professionalId || !state.startAtISO) return null
  const service = context.services.find((s) => s.id === state.serviceId)!
  const professional = context.professionals.find((p) => p.id === state.professionalId)!

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: context.tenantTimezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(state.startAtISO))
  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: context.tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(state.startAtISO))

  return (
    <section className="space-y-4">
      <Card>
        <CardContent className="space-y-2 py-4">
          <Row label="Cliente" value={state.customer.name} />
          <Row
            label="Serviço"
            value={`${service.name} · ${service.durationMinutes} min · ${formatCentsToBrl(service.priceCents)}`}
          />
          <Row label="Profissional" value={professional.displayName ?? professional.name} />
          <Row label="Quando" value={`${dateLabel} às ${timeLabel}`} />
        </CardContent>
      </Card>

      <textarea
        placeholder="Observações (opcional)"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        rows={3}
        maxLength={500}
      />

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          Voltar
        </Button>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? 'Criando…' : 'Criar agendamento'}
        </Button>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="font-medium text-fg">{value}</span>
    </div>
  )
}
```

### Task 2.9: Smoke test (wizard manual)

- [ ] **Step 1: Editar `docs/smoke-test-pilot.md`**

Adicionar seção:

```markdown
## 5b. Wizard de criação manual de agendamento (revamp 2026-04-26)

Acessar `/admin/dashboard/agenda/novo` autenticado como staff.

- [ ] Step 1 — escolher cliente existente da lista busca por nome funciona; selecionar avança state.
- [ ] Step 1 — alternar pra "Novo cliente"; preencher nome obrigatório; telefone/e-mail opcionais; "Continuar" só habilita com nome preenchido.
- [ ] Step 2 — lista só serviços com `is_active=true`; selecionar muda card pra estado selecionado.
- [ ] Step 3 — lista só profissionais vinculados ao serviço (via `professional_services`); empty state quando vínculo não existe.
- [ ] Step 4 — date picker default = hoje no TZ do tenant; slots calculados client-side; slots em conflito ficam riscados/desabilitados.
- [ ] Step 4 — bloquear horário tenant-wide (`availability_blocks` com `professional_id NULL`) faz aquele horário sumir.
- [ ] Step 5 — resumo bate com escolhas; observações opcionais (max 500 chars).
- [ ] Submit → cria appointment com `status=CONFIRMED`, redireciona pra `/admin/dashboard/agenda/[id]`.
- [ ] Cliente novo apareceu em `/admin/dashboard/clientes`.
- [ ] Tentar criar segundo agendamento mesmo profissional + mesmo horário → erro "Horário não disponível".
```

### Task 2.10: Smoke run + commit C3

- [ ] **Step 1: Rodar smoke do wizard manualmente**

Subir `pnpm dev` (se não estiver rodando), abrir `http://barbearia-teste.lvh.me:3008/admin/dashboard/agenda/novo` autenticado, executar checklist da Task 2.9.

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(authenticated\)/dashboard/agenda/novo/ src/app/admin/\(authenticated\)/actions/manual-appointment.ts src/components/dashboard/manual-booking/ docs/smoke-test-pilot.md
git commit -m "feat(admin/agenda): wizard de criação manual client-side

- Rota /admin/dashboard/agenda/novo carrega contexto único via getBookingContext
- 5 steps: cliente (existente ou novo) → serviço → profissional → data/hora → confirmar
- Slot calc client-side a partir do payload pré-fetched (snappy entre steps)
- Server action createManualAppointment cria customer on-the-fly se necessário
- Re-check de conflito server-side antes do insert (defesa)
- Cria appointment status=CONFIRMED (staff cria já confirmado)
- Smoke: seção 5b adicionada"
```

---

## Phase 3 — Revamp Tab Bar (C4)

**Goal:** 4 telas top-level revisadas: Home (cards do dia + ações + atenção), Agenda (filtros + resumo + lista revisada + empty state), Equipe (cards com derivações), Serviços (busca + visibilidade rotulada).

**Files:**
- Modify: `src/app/admin/(authenticated)/dashboard/(home)/page.tsx`
- Create: `src/components/home/quick-actions.tsx`
- Create: `src/components/home/attention-section.tsx`
- Modify: `src/app/admin/(authenticated)/dashboard/agenda/page.tsx`
- Create: `src/components/agenda/agenda-filters.tsx`
- Create: `src/components/agenda/day-summary.tsx`
- Create: `src/components/agenda/empty-state.tsx`
- Modify: `src/app/admin/(authenticated)/dashboard/profissionais/page.tsx`
- Modify: `src/components/dashboard/professionals-manager.tsx`
- Modify: `src/app/admin/(authenticated)/dashboard/servicos/page.tsx`
- Modify: `src/components/dashboard/services-manager.tsx`

### Task 3.1: Home — cards do dia + ações + atenção

- [ ] **Step 1: Ler `src/app/admin/(authenticated)/dashboard/(home)/page.tsx` completo**

Já tem next-appointment + StatCard duplo (Agenda hoje, Previsto) + QuickActions + PendingConfirmations + RealtimeAgendaRefresh.

- [ ] **Step 2: Adicionar 2 cards faltantes (4 ao todo: Agenda hoje, Próximo, Previsto, Status)**

O card "Próximo atendimento" hoje fica acima dos stat cards. Spec quer 4 cards no grid. Reorganizar:

- Manter "Próximo atendimento" como card destacado (full-width).
- Grid 2x2 com: Agenda hoje, Previsto, Status do dia, Atrasados.

Status do dia conta `livres + em andamento + atraso`. Como não temos `IN_PROGRESS`, simplificar: contar "ativos pendentes" (SCHEDULED+CONFIRMED no futuro) e "atrasados" (computado via `isLate`).

Substituir o bloco `<div className="grid grid-cols-2 gap-3">` (linha ~101) por:

```typescript
const lateCount = active.filter((a) => isLate({ status: a.status, startAt: a.startAt }, new Date(now))).length

return (
  // ... antes dos stat cards
  <div className="grid grid-cols-2 gap-3">
    <StatCard
      icon={<Calendar className="h-4 w-4" />}
      label="Agenda hoje"
      value={String(active.length)}
      hint={`${completed} concluídos`}
    />
    <StatCard
      icon={<TrendingUp className="h-4 w-4" />}
      label="Previsto"
      value={formatCentsToBrl(todayRevenueCents)}
      hint={`${formatCentsToBrl(completedRevenueCents)} já feito`}
    />
    <StatCard
      icon={<Clock className="h-4 w-4" />}
      label="Pendentes"
      value={String(active.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length)}
      hint={lateCount > 0 ? `${lateCount} atrasados` : 'no horário'}
    />
    <StatCard
      icon={<CheckCircle2 className="h-4 w-4" />}
      label="Concluídos"
      value={String(completed)}
      hint={`${active.filter((a) => a.status === 'CANCELED' || a.status === 'NO_SHOW').length} cancelados/faltas`}
    />
  </div>
)
```

Adicionar imports: `Clock`, `CheckCircle2` (lucide-react), `isLate` (de `@/lib/admin/derivations`).

- [ ] **Step 3: Calcular `completedRevenueCents`**

Logo após `todayRevenueCents`:

```typescript
const completedRevenueCents = active
  .filter((a) => a.status === 'COMPLETED')
  .reduce((sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0), 0)
```

- [ ] **Step 4: Criar `src/components/home/quick-actions.tsx`**

Substituir o `<QuickActions />` interno que existe no page.tsx por componente externo com 4 ações (Novo agendamento, Abrir agenda, Copiar link, Bloquear horário):

```typescript
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, CalendarDays, Link2, Ban } from 'lucide-react'

export function QuickActions({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Link
        href="/admin/dashboard/agenda/novo"
        className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle"
      >
        <Plus className="h-4 w-4" />
        Novo agendamento
      </Link>
      <Link
        href="/admin/dashboard/agenda"
        className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle"
      >
        <CalendarDays className="h-4 w-4" />
        Abrir agenda
      </Link>
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle"
      >
        <Link2 className="h-4 w-4" />
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
      <Link
        href="/admin/dashboard/bloqueios?new=1"
        className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle"
      >
        <Ban className="h-4 w-4" />
        Bloquear horário
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Criar `src/components/home/attention-section.tsx`**

```typescript
import Link from 'next/link'
import { AlertTriangle, CalendarOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export type AttentionItem =
  | { kind: 'late'; appointmentId: string; customerName: string; minutes: number }
  | { kind: 'no-schedule'; professionalId: string; professionalName: string }

export function AttentionSection({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="my-4">
        <CardContent className="py-3 text-sm text-fg-muted">
          Tudo certo por enquanto. Nenhuma pendência importante hoje.
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="my-4">
      <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        Atenção
      </h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            {item.kind === 'late' ? (
              <Link href={`/admin/dashboard/agenda/${item.appointmentId}`}>
                <Card className="shadow-xs transition-colors hover:bg-warning-bg/40">
                  <CardContent className="flex items-center gap-3 py-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    <p className="text-sm text-fg">
                      <span className="font-medium">{item.customerName}</span> está atrasado
                      há {item.minutes} min.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Link href={`/admin/dashboard/profissionais/${item.professionalId}`}>
                <Card className="shadow-xs transition-colors hover:bg-warning-bg/40">
                  <CardContent className="flex items-center gap-3 py-3">
                    <CalendarOff className="h-4 w-4 shrink-0 text-warning" />
                    <p className="text-sm text-fg">
                      <span className="font-medium">{item.professionalName}</span> está sem
                      horário configurado.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 6: Wirar Home com QuickActions + AttentionSection**

Em `src/app/admin/(authenticated)/dashboard/(home)/page.tsx`:

- Importar `QuickActions` e `AttentionSection`.
- Buscar `professional_availability` em paralelo com os outros queries:

```typescript
const [today, pending, svcRes, profsRes, availRes] = await Promise.all([
  getAgendaForDay(tenant.id, dateISO, tenant.timezone),
  getPendingConfirmations(tenant.id, nowISO),
  supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
  supabase.from('professionals').select('id, name').eq('tenant_id', tenant.id).eq('is_active', true),
  supabase.from('professional_availability').select('professional_id, weekday, start_time, end_time').eq('tenant_id', tenant.id),
])
```

- Computar attention items:

```typescript
import { hasNoSchedule, isLate, lateMinutes } from '@/lib/admin/derivations'

const lateItems: AttentionItem[] = active
  .filter((a) => isLate({ status: a.status, startAt: a.startAt }, new Date(now)))
  .map((a) => ({
    kind: 'late',
    appointmentId: a.id,
    customerName: a.customerName ?? 'Cliente',
    minutes: lateMinutes({ status: a.status, startAt: a.startAt }, new Date(now)),
  }))

const noScheduleItems: AttentionItem[] = (profsRes.data ?? [])
  .filter((p) => hasNoSchedule((availRes.data ?? []).map((a) => ({ professionalId: a.professional_id })), p.id))
  .map((p) => ({ kind: 'no-schedule', professionalId: p.id, professionalName: p.name }))

const attentionItems = [...lateItems, ...noScheduleItems]
```

- Computar publicUrl pro QuickActions:

```typescript
const publicUrl = `https://${tenant.subdomain}.aralabs.com.br`
```

- Render `<QuickActions publicUrl={publicUrl} />` antes do PendingConfirmations e `<AttentionSection items={attentionItems} />` depois.

- [ ] **Step 7: Smoke da Home**

Acessar `http://barbearia-teste.lvh.me:3008/admin/dashboard`:
- 4 cards aparecem em grid 2x2.
- Quick actions com 4 botões; copiar link copia `https://barbearia-teste.aralabs.com.br`.
- Atenção mostra "Tudo certo" se não há atrasos/sem-horário; senão lista os itens.

### Task 3.2: Agenda — filtros + resumo + empty state

- [ ] **Step 1: Criar `src/components/agenda/agenda-filters.tsx`**

```typescript
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function AgendaFilters({
  professionals,
}: {
  professionals: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const profFilter = sp.get('professional') ?? ''
  const statusFilter = sp.get('status') ?? ''

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp)
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="my-3 flex gap-2 overflow-x-auto">
      <select
        value={profFilter}
        onChange={(e) => update('professional', e.target.value)}
        className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm"
      >
        <option value="">Todos os profissionais</option>
        {professionals.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm"
      >
        <option value="">Todos os status</option>
        <option value="SCHEDULED">Agendados</option>
        <option value="CONFIRMED">Confirmados</option>
        <option value="COMPLETED">Concluídos</option>
        <option value="CANCELED">Cancelados</option>
        <option value="NO_SHOW">Faltou</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/components/agenda/day-summary.tsx`**

```typescript
import { formatCentsToBrl } from '@/lib/money'
import { isLate } from '@/lib/admin/derivations'

export function DaySummary({
  appointments,
  priceById,
}: {
  appointments: Array<{
    id: string
    status: string
    startAt: string
    serviceId: string
    priceCentsSnapshot: number | null
  }>
  priceById: Map<string, number>
}) {
  const active = appointments.filter((a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW')
  const revenue = active.reduce(
    (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
    0,
  )
  const now = new Date()
  const late = active.filter((a) => isLate({ status: a.status, startAt: a.startAt }, now)).length

  if (active.length === 0) {
    return null
  }

  return (
    <p className="my-2 text-sm text-fg-muted">
      {active.length} agendamentos · {formatCentsToBrl(revenue)} previsto
      {late > 0 ? ` · ${late} ${late === 1 ? 'atraso' : 'atrasos'}` : ''}
    </p>
  )
}
```

- [ ] **Step 3: Criar `src/components/agenda/empty-state.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function AgendaEmptyState({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-6 rounded-xl border border-border bg-bg-subtle px-5 py-8 text-center">
      <p className="font-display text-lg font-semibold text-fg">Nenhum agendamento hoje.</p>
      <p className="mt-2 text-sm text-fg-muted">
        Você pode adicionar um horário manualmente ou compartilhar seu link para seus clientes
        agendarem sozinhos.
      </p>
      <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link href="/admin/dashboard/agenda/novo">
          <Button>Adicionar agendamento</Button>
        </Link>
        <Button variant="outline" onClick={copy}>
          {copied ? 'Copiado!' : 'Copiar link de agendamento'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wirar Agenda page**

Em `src/app/admin/(authenticated)/dashboard/agenda/page.tsx`:

- Buscar professionals + services em paralelo:

```typescript
const supabase = await createClient()
const [appointments, profsRes, svcRes] = await Promise.all([
  getAgendaForDay(tenant.id, dateISO, tenant.timezone),
  supabase.from('professionals').select('id, name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
  supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
])
const priceById = new Map((svcRes.data ?? []).map((s) => [s.id, s.price_cents]))
```

- Aplicar filtros via searchParams:

```typescript
const profFilter = typeof sp.professional === 'string' ? sp.professional : null
const statusFilter = typeof sp.status === 'string' ? sp.status : null
const filtered = appointments.filter((a) => {
  if (profFilter && a.professionalId !== profFilter) return false
  if (statusFilter && a.status !== statusFilter) return false
  return true
})
```

- Render `<AgendaFilters professionals={profsRes.data ?? []} />` e `<DaySummary appointments={filtered} priceById={priceById} />` antes da lista.
- Quando `filtered.length === 0`, render `<AgendaEmptyState publicUrl={...} />` em vez do `Nenhum agendamento` atual.

- [ ] **Step 5: Smoke da Agenda**

- Filtros mudam URL e re-renderizam.
- Resumo do dia aparece quando há agendamentos.
- Empty state com CTAs aparece quando não há.

### Task 3.3: Equipe — card revisado

- [ ] **Step 1: Inspecionar `src/components/dashboard/professionals-manager.tsx`**

Ler arquivo. Identificar onde o card de profissional é renderizado.

- [ ] **Step 2: Buscar dados extra na page**

Em `src/app/admin/(authenticated)/dashboard/profissionais/page.tsx`, carregar em paralelo:
- `professional_availability` pra detectar `hasNoSchedule` e `worksToday`.
- `professional_services` pra contagem de serviços vinculados.
- `appointments` de hoje pra contagem por profissional.

```typescript
const today = todayISO(tenant.timezone)
const [profs, availability, services, profServices, todayAppts] = await Promise.all([
  supabase.from('professionals').select('id, name, display_name, phone, is_active, user_id').eq('tenant_id', tenant.id),
  supabase.from('professional_availability').select('professional_id, weekday, start_time, end_time').eq('tenant_id', tenant.id),
  supabase.from('services').select('id, price_cents').eq('tenant_id', tenant.id),
  supabase.from('professional_services').select('professional_id, service_id').eq('tenant_id', tenant.id),
  getAgendaForDay(tenant.id, today, tenant.timezone),
])
```

- [ ] **Step 3: Refator `professionals-manager.tsx` pra receber as derivações**

Adicionar props ao component:

```typescript
type ProfessionalCardData = {
  id: string
  name: string
  displayName: string | null
  phone: string | null
  isActive: boolean
  worksToday: { startTime: string; endTime: string } | null
  appointmentsToday: number
  revenueToday: number
  servicesCount: number
  hasNoSchedule: boolean
  hasUserAccess: boolean
}
```

No render, mostrar:

```jsx
<Card>
  <CardContent>
    <p className="font-medium">{professional.displayName ?? professional.name}</p>
    <p className="text-sm text-fg-muted">
      {professional.isActive ? 'Ativo' : 'Inativo'}
      {professional.worksToday
        ? ` · Trabalha hoje ${professional.worksToday.startTime}–${professional.worksToday.endTime}`
        : professional.hasNoSchedule
          ? ' · Sem horário configurado'
          : ' · De folga hoje'}
    </p>
    <p className="text-sm text-fg-muted">
      {professional.appointmentsToday} agendamentos hoje · {formatCentsToBrl(professional.revenueToday)} previsto
    </p>
    <p className="text-sm text-fg-muted">
      {professional.servicesCount} serviços vinculados
      {professional.hasUserAccess ? ' · Acesso ao painel' : ' · Sem acesso ao painel'}
    </p>
  </CardContent>
</Card>
```

- [ ] **Step 4: Computar dados do card no page.tsx**

```typescript
import { worksToday, hasNoSchedule, countAppointmentsForProfessional } from '@/lib/admin/derivations'

const priceById = new Map((services.data ?? []).map((s) => [s.id, s.price_cents]))
const weekday = new Date().getDay() // ajustar pro TZ se necessário
const profServicesByPro = new Map<string, number>()
for (const ps of profServices.data ?? []) {
  profServicesByPro.set(ps.professional_id, (profServicesByPro.get(ps.professional_id) ?? 0) + 1)
}

const cards: ProfessionalCardData[] = (profs.data ?? []).map((p) => {
  const apptsToday = todayAppts.filter((a) => a.professionalId === p.id && a.status !== 'CANCELED' && a.status !== 'NO_SHOW')
  return {
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    phone: p.phone,
    isActive: p.is_active,
    worksToday: worksToday(
      (availability.data ?? []).map((a) => ({
        professionalId: a.professional_id, weekday: a.weekday, startTime: a.start_time, endTime: a.end_time,
      })),
      p.id,
      weekday,
    ),
    appointmentsToday: apptsToday.length,
    revenueToday: apptsToday.reduce((s, a) => s + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0), 0),
    servicesCount: profServicesByPro.get(p.id) ?? 0,
    hasNoSchedule: hasNoSchedule(
      (availability.data ?? []).map((a) => ({ professionalId: a.professional_id })),
      p.id,
    ),
    hasUserAccess: p.user_id !== null,
  }
})
```

- [ ] **Step 5: Header com resumo agregado**

Acima da lista, adicionar:

```typescript
const workingToday = cards.filter((c) => c.worksToday !== null).length
const withoutSchedule = cards.filter((c) => c.hasNoSchedule).length
```

```jsx
<p className="mb-3 text-sm text-fg-muted">
  {workingToday} trabalhando hoje
  {withoutSchedule > 0 ? ` · ${withoutSchedule} sem horário configurado` : ''}
</p>
```

### Task 3.4: Serviços — busca + visibilidade rotulada

- [ ] **Step 1: Inspecionar `src/components/dashboard/services-manager.tsx`**

Identificar como cards são renderizados hoje.

- [ ] **Step 2: Adicionar busca client-side**

Adicionar `useState` pra `search` e filtrar lista:

```typescript
const [search, setSearch] = useState('')
const filtered = services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
```

Render:

```jsx
<Input
  type="search"
  placeholder="Buscar serviço…"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="my-3"
/>
```

- [ ] **Step 3: Adicionar profissionais vinculados ao card**

Em `src/app/admin/(authenticated)/dashboard/servicos/page.tsx`, buscar `professional_services` em paralelo:

```typescript
const [services, profServices, professionals] = await Promise.all([
  supabase.from('services').select('*').eq('tenant_id', tenant.id).order('name'),
  supabase.from('professional_services').select('professional_id, service_id').eq('tenant_id', tenant.id),
  supabase.from('professionals').select('id, name, display_name').eq('tenant_id', tenant.id).eq('is_active', true),
])

const profById = new Map(professionals.data?.map((p) => [p.id, p.display_name ?? p.name]) ?? [])
const servicesWithPros = (services.data ?? []).map((s) => ({
  ...s,
  professionalNames: (profServices.data ?? [])
    .filter((ps) => ps.service_id === s.id)
    .map((ps) => profById.get(ps.professional_id) ?? '?'),
}))
```

- [ ] **Step 4: Card render com visibilidade rotulada**

```jsx
<Card>
  <CardContent>
    <p className="font-medium">{service.name}</p>
    <p className="text-sm text-fg-muted">
      {service.duration_minutes} min · {formatCentsToBrl(service.price_cents)}
    </p>
    {service.professionalNames.length > 0 ? (
      <p className="text-sm text-fg-muted">
        Profissionais: {service.professionalNames.join(', ')}
      </p>
    ) : (
      <p className="text-sm text-warning">Nenhum profissional vinculado</p>
    )}
    <p className="mt-1 text-xs">
      <span
        className={
          service.is_active
            ? 'rounded bg-success-bg px-2 py-0.5 text-success'
            : 'rounded bg-bg-subtle px-2 py-0.5 text-fg-subtle'
        }
      >
        {service.is_active ? 'Visível para clientes' : 'Oculto'}
      </span>
    </p>
  </CardContent>
</Card>
```

- [ ] **Step 5: Empty state acionável**

Quando `services.length === 0`:

```jsx
<div className="my-6 rounded-xl border border-border bg-bg-subtle px-5 py-8 text-center">
  <p className="font-display text-lg font-semibold">Cadastre seus primeiros serviços.</p>
  <p className="mt-2 text-sm text-fg-muted">
    Eles aparecerão na página pública para seus clientes escolherem ao agendar.
  </p>
  <Link href="/admin/dashboard/servicos/novo" className="mt-4 inline-block">
    <Button>Adicionar serviço</Button>
  </Link>
</div>
```

(Se rota `/servicos/novo` não existe ainda, usar form inline ou adaptar pra `services-manager` componente.)

### Task 3.5: Smoke + commit C4

- [ ] **Step 1: Editar `docs/smoke-test-pilot.md`**

Atualizar seções "Home" e "Agenda staff" com checks dos novos cards/filtros/empty state. Adicionar seções pra Equipe revisada e Serviços revisado.

- [ ] **Step 2: Smoke manual**

Rodar checks visualmente em cada uma das 4 telas.

- [ ] **Step 3: Typecheck + lint + build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(authenticated\)/dashboard/\(home\)/page.tsx src/components/home/ src/app/admin/\(authenticated\)/dashboard/agenda/page.tsx src/components/agenda/agenda-filters.tsx src/components/agenda/day-summary.tsx src/components/agenda/empty-state.tsx src/app/admin/\(authenticated\)/dashboard/profissionais/page.tsx src/components/dashboard/professionals-manager.tsx src/app/admin/\(authenticated\)/dashboard/servicos/page.tsx src/components/dashboard/services-manager.tsx docs/smoke-test-pilot.md
git commit -m "feat(admin): revamp tab bar (Home + Agenda + Equipe + Serviços)

- Home: 4 stat cards (Agenda hoje, Previsto, Pendentes, Concluídos), quick actions (4 botões), seção Atenção (atrasados + sem horário)
- Agenda: filtros profissional/status, resumo do dia (contagem + previsto + atrasos), empty state acionável
- Equipe: card com worksToday, agendamentos hoje, previsto, serviços vinculados, sem horário, acesso painel
- Serviços: busca por nome, visibilidade rotulada, profissionais vinculados, empty state acionável"
```

---

## Phase 4 — Mais reorg + Meu negócio (C5-1)

**Goal:** Reorganizar `/admin/dashboard/mais` em 5 seções estruturais. Implementar 3 sub-telas da seção Meu negócio: Perfil público (revisão da rota existente), Link de agendamento (nova), Marca e aparência (nova).

**Files:**
- Modify: `src/app/admin/(authenticated)/dashboard/mais/page.tsx` (estrutura nova)
- Modify: `src/app/admin/(authenticated)/dashboard/perfil/page.tsx` (revisão)
- Create: `src/app/admin/(authenticated)/dashboard/link/page.tsx` (nova)
- Create: `src/components/dashboard/qr-code.tsx` (gerador QR)
- Create: `src/app/admin/(authenticated)/dashboard/marca/page.tsx` (nova)
- Create: `src/components/dashboard/brand-editor.tsx`
- Create: `src/app/admin/(authenticated)/actions/tenant-profile.ts` (server actions update perfil/marca)

### Task 4.1: Mais reorg em 5 seções

- [ ] **Step 1: Reescrever `src/app/admin/(authenticated)/dashboard/mais/page.tsx`**

```typescript
import Link from 'next/link'
import {
  Building2,
  Link2,
  Palette,
  Clock,
  Settings2,
  CalendarOff,
  Users2,
  TrendingUp,
  BarChart3,
  Mail,
  MessageCircle,
  BellRing,
  UserCog,
  CreditCard,
  Shield,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Item = { href: string; icon: LucideIcon; label: string; hint: string }

const SECTIONS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Meu negócio',
    items: [
      { href: '/admin/dashboard/perfil', icon: Building2, label: 'Perfil público', hint: 'Logo, nome, endereço, contato' },
      { href: '/admin/dashboard/link', icon: Link2, label: 'Link de agendamento', hint: 'Copiar, QR Code, compartilhar' },
      { href: '/admin/dashboard/marca', icon: Palette, label: 'Marca e aparência', hint: 'Cores, logo, headline' },
    ],
  },
  {
    title: 'Agenda',
    items: [
      { href: '/admin/dashboard/configuracoes/horarios', icon: Clock, label: 'Horários de funcionamento', hint: 'Quando o negócio abre/fecha' },
      { href: '/admin/dashboard/regras', icon: Settings2, label: 'Regras de agendamento', hint: 'Antecedência, intervalo, cancelamento' },
      { href: '/admin/dashboard/bloqueios', icon: CalendarOff, label: 'Bloqueios, folgas e feriados', hint: 'Bloquear dias e horários' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/admin/dashboard/clientes', icon: Users2, label: 'Clientes', hint: 'Quem já agendou no seu negócio' },
      { href: '/admin/dashboard/financeiro', icon: TrendingUp, label: 'Financeiro', hint: 'Previsto, realizado, perdido' },
      { href: '/admin/dashboard/relatorios', icon: BarChart3, label: 'Relatórios', hint: 'Resumo operacional' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { href: '/admin/dashboard/comunicacao/emails', icon: Mail, label: 'E-mails automáticos', hint: 'Confirmação, cancelamento, lembrete' },
      { href: '/admin/dashboard/comunicacao/whatsapp', icon: MessageCircle, label: 'WhatsApp', hint: 'Mensagens prontas e link de compartilhar' },
      { href: '/admin/dashboard/comunicacao/notificacoes', icon: BellRing, label: 'Notificações da equipe', hint: 'Avisos no celular do staff' },
    ],
  },
  {
    title: 'Conta',
    items: [
      { href: '/admin/dashboard/conta/usuarios', icon: UserCog, label: 'Usuários e permissões', hint: 'Quem acessa o painel' },
      { href: '/admin/dashboard/conta/plano', icon: CreditCard, label: 'Plano e cobrança', hint: 'Trial, plano e cobranças da AraLabs' },
      { href: '/admin/dashboard/conta/seguranca', icon: Shield, label: 'Segurança', hint: 'Alterar senha e sessões' },
    ],
  },
]

export default function MaisPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Configurações e gestão
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Mais
        </h1>
      </header>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              {section.title}
            </h2>
            <Card className="shadow-xs">
              <ul className="divide-y divide-border">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-fg">{item.label}</p>
                          <p className="truncate text-[0.8125rem] text-fg-muted">{item.hint}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </section>
        ))}

        <Card className="shadow-xs">
          <CardContent className="p-0">
            <form action="/auth/logout?next=/admin/login" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-error transition-colors hover:bg-error-bg"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error-bg">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-medium">Sair</span>
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

**Importante:** essa estrutura referencia 14 rotas. Algumas ainda não existem nesta fase (regras, bloqueios, financeiro novo, etc). C5-1 só implementa as 3 de Meu negócio. As demais ficam linkando pra rotas que existem mas estão em estado "antigo" (financeiro stubado, etc) ou rotas inexistentes (404).

**Mitigação:** garantir que cada rota do menu abre algo, mesmo que seja um placeholder mínimo. Pra rotas que ainda não existem nesta fase, criar `page.tsx` retornando `<OutOfPilotStub section="X" title="Em construção" description="..." />`. Esses placeholders são substituídos nas fases seguintes (C5-2/3/4).

- [ ] **Step 2: Criar placeholders pras rotas pendentes**

Pra cada rota nova que será implementada em C5-2/C5-3/C5-4, criar `page.tsx` mínimo. Apenas as 3 de Meu negócio recebem implementação real nesta fase.

Lista de placeholders (usar `OutOfPilotStub`):

```typescript
// src/app/admin/(authenticated)/dashboard/regras/page.tsx
import { OutOfPilotStub } from '@/components/dashboard/out-of-pilot-stub'
export default function Page() {
  return <OutOfPilotStub section="Regras" title="Em construção" description="Em breve nesta tela." />
}
```

Repetir para:
- `regras/page.tsx`
- `bloqueios/page.tsx`
- `comunicacao/emails/page.tsx`
- `comunicacao/whatsapp/page.tsx`
- `comunicacao/notificacoes/page.tsx`
- `conta/usuarios/page.tsx`
- `conta/plano/page.tsx`
- `conta/seguranca/page.tsx`

(Rotas existentes que serão revampadas em C5-2 — financeiro, relatorios, clientes — mantêm seu estado atual e são revisadas naquele commit.)

### Task 4.2: Server actions de update do perfil/marca

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/tenant-profile.ts`**

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'

const ProfileInput = z.object({
  name: z.string().min(1).max(120),
  contact_phone: z.string().max(40).optional().or(z.literal('')),
  whatsapp: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address_line1: z.string().max(200).optional().or(z.literal('')),
  address_line2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(40).optional().or(z.literal('')),
  postal_code: z.string().max(20).optional().or(z.literal('')),
})

export async function updateTenantProfile(
  raw: z.infer<typeof ProfileInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = ProfileInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const update = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  )

  const { error } = await supabase.from('tenants').update(update).eq('id', tenant.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/dashboard/perfil')
  revalidatePath('/')
  return { ok: true }
}

const BrandInput = z.object({
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
  logo_url: z.string().url().optional().or(z.literal('')),
  favicon_url: z.string().url().optional().or(z.literal('')),
  home_headline_top: z.string().max(120).optional().or(z.literal('')),
  home_headline_accent: z.string().max(120).optional().or(z.literal('')),
})

export async function updateTenantBrand(
  raw: z.infer<typeof BrandInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = BrandInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const update = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  )

  const { error } = await supabase.from('tenants').update(update).eq('id', tenant.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/dashboard/marca')
  revalidatePath('/')
  return { ok: true }
}
```

### Task 4.3: Perfil público — revisão

- [ ] **Step 1: Reescrever `src/app/admin/(authenticated)/dashboard/perfil/page.tsx`**

Form completo com os campos da tabela `tenants` (nome, contato, endereço). Usar `updateTenantProfile`.

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ProfileForm } from '@/components/dashboard/profile-form'

export default async function PerfilPage() {
  const tenant = await getCurrentTenantOrNotFound()
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Perfil público
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Essas informações aparecem na sua página pública.
        </p>
      </header>
      <ProfileForm
        initial={{
          name: tenant.name,
          contact_phone: tenant.contact_phone ?? '',
          whatsapp: tenant.whatsapp ?? '',
          email: tenant.email ?? '',
          address_line1: tenant.address_line1 ?? '',
          address_line2: tenant.address_line2 ?? '',
          city: tenant.city ?? '',
          state: tenant.state ?? '',
          postal_code: tenant.postal_code ?? '',
        }}
      />
    </main>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/profile-form.tsx`**

Client component com `useFormState`/`useTransition`, inputs labeled. Submete pra `updateTenantProfile`. Mostra mensagens success/error inline.

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateTenantProfile } from '@/app/admin/(authenticated)/actions/tenant-profile'

type Initial = {
  name: string
  contact_phone: string
  whatsapp: string
  email: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateTenantProfile(data)
      if (result.error) setMsg({ kind: 'error', text: result.error })
      else setMsg({ kind: 'success', text: 'Salvo!' })
    })
  }

  function bind(key: keyof Initial) {
    return {
      value: data[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setData((d) => ({ ...d, [key]: e.target.value })),
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nome do negócio">
        <Input {...bind('name')} required />
      </Field>
      <Field label="Telefone de contato">
        <Input type="tel" {...bind('contact_phone')} />
      </Field>
      <Field label="WhatsApp">
        <Input type="tel" {...bind('whatsapp')} />
      </Field>
      <Field label="E-mail">
        <Input type="email" {...bind('email')} />
      </Field>
      <Field label="Endereço linha 1">
        <Input {...bind('address_line1')} />
      </Field>
      <Field label="Endereço linha 2">
        <Input {...bind('address_line2')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Cidade">
          <Input {...bind('city')} />
        </Field>
        <Field label="UF">
          <Input {...bind('state')} maxLength={2} />
        </Field>
      </div>
      <Field label="CEP">
        <Input {...bind('postal_code')} />
      </Field>

      {msg ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
          }`}
        >
          {msg.text}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
      {children}
    </label>
  )
}
```

### Task 4.4: Link de agendamento + QR Code

- [ ] **Step 1: Verificar lib de QR**

```bash
grep "qrcode" package.json
```

Se não tiver, instalar uma lib leve: `pnpm add qrcode.react` (server-rendered SVG via React, sem deps de DOM).

- [ ] **Step 2: Criar `src/app/admin/(authenticated)/dashboard/link/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { LinkSharePanel } from '@/components/dashboard/link-share-panel'

export default async function LinkPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const publicUrl = `https://${tenant.subdomain}.aralabs.com.br`
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Link de agendamento
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Compartilhe este link nas suas redes, WhatsApp ou cartão.
        </p>
      </header>
      <LinkSharePanel publicUrl={publicUrl} tenantName={tenant.name} />
    </main>
  )
}
```

- [ ] **Step 3: Criar `src/components/dashboard/link-share-panel.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { buildWhatsappFromTemplate } from '@/lib/contact/whatsapp'

export function LinkSharePanel({
  publicUrl,
  tenantName,
}: {
  publicUrl: string
  tenantName: string
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadQR() {
    const svg = document.getElementById('qr-svg') as SVGSVGElement | null
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${tenantName.toLowerCase().replace(/\s+/g, '-')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // template default — em fase posterior (C5-3) puxa do tenant_message_templates
  const whatsappShareLink = buildWhatsappFromTemplate(
    '',
    'Oi! Agora você pode agendar comigo direto por aqui: {link}',
    { link: publicUrl },
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="rounded-lg bg-bg-subtle px-3 py-2 font-mono text-sm break-all">
            {publicUrl}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy}>{copied ? 'Copiado!' : 'Copiar link'}</Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">Abrir página pública</Button>
            </a>
            <a href={whatsappShareLink} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">Compartilhar no WhatsApp</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <QRCodeSVG id="qr-svg" value={publicUrl} size={192} level="M" />
          <Button variant="outline" onClick={downloadQR}>
            Baixar QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Task 4.5: Marca e aparência

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/marca/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { BrandEditor } from '@/components/dashboard/brand-editor'

export default async function MarcaPage() {
  const tenant = await getCurrentTenantOrNotFound()
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Marca e aparência
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Personalize cores, logo e mensagens da sua página pública.
        </p>
      </header>
      <BrandEditor
        initial={{
          primary_color: tenant.primary_color ?? '',
          secondary_color: tenant.secondary_color ?? '',
          accent_color: tenant.accent_color ?? '',
          logo_url: tenant.logo_url ?? '',
          favicon_url: tenant.favicon_url ?? '',
          home_headline_top: tenant.home_headline_top ?? '',
          home_headline_accent: tenant.home_headline_accent ?? '',
        }}
      />
    </main>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/brand-editor.tsx`**

Mesma forma que ProfileForm, mas com:
- Color pickers (input type=color) pra primary/secondary/accent
- URL inputs pra logo/favicon (upload a Storage fica fora deste revamp — só URL por enquanto)
- Text inputs pra headlines

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateTenantBrand } from '@/app/admin/(authenticated)/actions/tenant-profile'

type Initial = {
  primary_color: string
  secondary_color: string
  accent_color: string
  logo_url: string
  favicon_url: string
  home_headline_top: string
  home_headline_accent: string
}

export function BrandEditor({ initial }: { initial: Initial }) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateTenantBrand(data)
      if (result.error) setMsg({ kind: 'error', text: result.error })
      else setMsg({ kind: 'success', text: 'Salvo!' })
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-fg">Cores</legend>
        <ColorRow label="Primária" value={data.primary_color} onChange={(v) => setData((d) => ({ ...d, primary_color: v }))} />
        <ColorRow label="Secundária" value={data.secondary_color} onChange={(v) => setData((d) => ({ ...d, secondary_color: v }))} />
        <ColorRow label="Destaque" value={data.accent_color} onChange={(v) => setData((d) => ({ ...d, accent_color: v }))} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-fg">Imagens (URL)</legend>
        <Field label="Logo (URL)">
          <Input type="url" value={data.logo_url} onChange={(e) => setData((d) => ({ ...d, logo_url: e.target.value }))} placeholder="https://..." />
        </Field>
        <Field label="Favicon (URL)">
          <Input type="url" value={data.favicon_url} onChange={(e) => setData((d) => ({ ...d, favicon_url: e.target.value }))} placeholder="https://..." />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-fg">Headline da home pública</legend>
        <Field label="Linha de cima">
          <Input value={data.home_headline_top} onChange={(e) => setData((d) => ({ ...d, home_headline_top: e.target.value }))} maxLength={120} />
        </Field>
        <Field label="Destaque">
          <Input value={data.home_headline_accent} onChange={(e) => setData((d) => ({ ...d, home_headline_accent: e.target.value }))} maxLength={120} />
        </Field>
      </fieldset>

      {msg ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
          {msg.text}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 rounded border border-border"
      />
      <span className="flex-1 text-sm">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" maxLength={7} className="w-32" />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
      {children}
    </label>
  )
}
```

### Task 4.6: Smoke + commit C5-1

- [ ] **Step 1: Editar `docs/smoke-test-pilot.md`**

Adicionar seção "Mais reorg + Meu negócio":

```markdown
## 8. Mais — reorganização (revamp 2026-04-26)

- [ ] `/admin/dashboard/mais` exibe 5 seções (Meu negócio, Agenda, Gestão, Comunicação, Conta) + Sair.
- [ ] Cada item linka pra rota correta. Itens não-implementados nesta fase abrem placeholder "Em construção".
- [ ] Perfil público (`/admin/dashboard/perfil`): editar nome → salvar → confirmar persistido.
- [ ] Link de agendamento (`/admin/dashboard/link`): copiar funciona, QR aparece, baixar QR baixa SVG.
- [ ] Compartilhar no WhatsApp abre wa.me com mensagem default contendo o link.
- [ ] Marca e aparência (`/admin/dashboard/marca`): trocar cor primária → salvar → verificar `--brand-primary` no CSS da home pública mudou.
```

- [ ] **Step 2: Smoke manual em todas as 3 telas + Mais reorg**

- [ ] **Step 3: Typecheck + lint + build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(authenticated\)/dashboard/mais/page.tsx src/app/admin/\(authenticated\)/dashboard/perfil/page.tsx src/app/admin/\(authenticated\)/dashboard/link/ src/app/admin/\(authenticated\)/dashboard/marca/ src/app/admin/\(authenticated\)/dashboard/regras/page.tsx src/app/admin/\(authenticated\)/dashboard/bloqueios/page.tsx src/app/admin/\(authenticated\)/dashboard/comunicacao/ src/app/admin/\(authenticated\)/dashboard/conta/ src/app/admin/\(authenticated\)/actions/tenant-profile.ts src/components/dashboard/profile-form.tsx src/components/dashboard/link-share-panel.tsx src/components/dashboard/brand-editor.tsx package.json pnpm-lock.yaml docs/smoke-test-pilot.md
git commit -m "feat(admin/mais): reorg base + Meu negócio (perfil + link + marca)

- Mais reorganizada em 5 seções (Meu negócio, Agenda, Gestão, Comunicação, Conta)
- Perfil público: form completo (nome, contato, WhatsApp, e-mail, endereço, cidade, UF, CEP)
- Link de agendamento: copiar, abrir, QR Code SVG, compartilhar no WhatsApp
- Marca e aparência: editar cores, logo URL, favicon URL, headlines
- Placeholders 'Em construção' nas rotas que serão implementadas em C5-2/C5-3/C5-4
- qrcode.react adicionado"
```

---

## Phase 5 — Agenda + Gestão da Mais (C5-2)

**Goal:** Implementar 5 sub-telas: Regras de agendamento, Bloqueios central, Clientes revamp, Financeiro revamp, Relatórios revamp.

**Files:**
- Modify: `src/app/admin/(authenticated)/dashboard/regras/page.tsx`
- Create: `src/components/dashboard/booking-rules-form.tsx`
- Create: `src/app/admin/(authenticated)/actions/booking-rules.ts`
- Modify: `src/app/admin/(authenticated)/dashboard/bloqueios/page.tsx`
- Create: `src/components/dashboard/blocks-manager.tsx`
- Create: `src/app/admin/(authenticated)/actions/blocks.ts`
- Modify: `src/app/admin/(authenticated)/dashboard/disponibilidade/page.tsx` (redirect → bloqueios)
- Modify: `src/components/dashboard/professional-detail.tsx` (remove block manager local)
- Modify: `src/app/admin/(authenticated)/dashboard/clientes/page.tsx`
- Create: `src/app/admin/(authenticated)/dashboard/clientes/[id]/page.tsx`
- Modify: `src/app/admin/(authenticated)/dashboard/financeiro/page.tsx` (rewrite from stub)
- Create: `src/components/dashboard/financial-summary.tsx`
- Modify: `src/app/admin/(authenticated)/dashboard/relatorios/page.tsx`

### Task 5.1: Regras de agendamento

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/booking-rules.ts`**

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'

const Input = z.object({
  min_advance_hours: z.number().int().min(0).max(168),
  slot_interval_minutes: z.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v)),
  cancellation_window_hours: z.number().int().min(0).max(168),
  customer_can_cancel: z.boolean(),
})

export async function updateBookingRules(
  raw: z.infer<typeof Input>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('tenants').update(parsed.data).eq('id', tenant.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/dashboard/regras')
  return { ok: true }
}
```

- [ ] **Step 2: Reescrever `src/app/admin/(authenticated)/dashboard/regras/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { BookingRulesForm } from '@/components/dashboard/booking-rules-form'

export default async function RegrasPage() {
  const tenant = await getCurrentTenantOrNotFound()
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Regras de agendamento
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Como seus clientes podem agendar e cancelar.
        </p>
      </header>
      <BookingRulesForm
        initial={{
          min_advance_hours: tenant.min_advance_hours ?? 0,
          slot_interval_minutes: tenant.slot_interval_minutes ?? 15,
          cancellation_window_hours: tenant.cancellation_window_hours ?? 2,
          customer_can_cancel: tenant.customer_can_cancel ?? true,
        }}
      />
    </main>
  )
}
```

- [ ] **Step 3: Criar `src/components/dashboard/booking-rules-form.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateBookingRules } from '@/app/admin/(authenticated)/actions/booking-rules'

type Rules = {
  min_advance_hours: number
  slot_interval_minutes: number
  cancellation_window_hours: number
  customer_can_cancel: boolean
}

export function BookingRulesForm({ initial }: { initial: Rules }) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateBookingRules(data)
      if (result.error) setMsg({ kind: 'error', text: result.error })
      else setMsg({ kind: 'success', text: 'Salvo!' })
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Antecedência mínima para agendar (horas)" hint="Cliente só consegue agendar após esse tempo a partir de agora.">
        <input
          type="number"
          min={0}
          max={168}
          value={data.min_advance_hours}
          onChange={(e) => setData((d) => ({ ...d, min_advance_hours: parseInt(e.target.value || '0', 10) }))}
          className="w-32 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Intervalo entre horários (minutos)" hint="Granularidade dos slots na agenda pública.">
        <select
          value={data.slot_interval_minutes}
          onChange={(e) => setData((d) => ({ ...d, slot_interval_minutes: parseInt(e.target.value, 10) }))}
          className="w-32 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        >
          {[5, 10, 15, 20, 30, 60].map((v) => (
            <option key={v} value={v}>
              {v} min
            </option>
          ))}
        </select>
      </Field>

      <Field label="Janela mínima para cancelamento (horas)" hint="Quantas horas antes do horário o cliente ainda pode cancelar.">
        <input
          type="number"
          min={0}
          max={168}
          value={data.cancellation_window_hours}
          onChange={(e) => setData((d) => ({ ...d, cancellation_window_hours: parseInt(e.target.value || '0', 10) }))}
          className="w-32 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
      </Field>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={data.customer_can_cancel}
          onChange={(e) => setData((d) => ({ ...d, customer_can_cancel: e.target.checked }))}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="block font-medium text-fg">Permitir cancelamento pelo cliente</span>
          <span className="block text-sm text-fg-muted">
            Se desligado, só staff cancela.
          </span>
        </span>
      </label>

      {msg ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
          {msg.text}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-fg">{label}</label>
      {hint ? <p className="mb-2 text-xs text-fg-muted">{hint}</p> : null}
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Aplicar regras no fluxo público**

Em `src/lib/booking/slots.ts` (ou na queries pública), filtrar slots respeitando `min_advance_hours`:

```typescript
// dentro de computeSlots, antes de marcar slot.available=true:
const earliestAllowed = new Date(input.now.getTime() + (input.tenantMinAdvanceHours ?? 0) * 3600 * 1000)
if (slotStart < earliestAllowed) {
  // marcar available=false
}
```

E `slot_interval_minutes`: se hoje há um `stepMinutes` no input, passar `tenant.slot_interval_minutes` como default. Garantir que o caller (page de booking) passa o tenant carregado.

`customer_can_cancel`: em `cancelCustomerAppointment` action (em `src/lib/appointments/server-actions.ts`), checar `tenant.customer_can_cancel` antes de permitir. Se false, retornar erro.

`cancellation_window_hours` já é checado hoje — manter.

### Task 5.2: Bloqueios central

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/blocks.ts`**

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'

const CreateInput = z.object({
  scope: z.enum(['TENANT', 'PROFESSIONAL']),
  professionalId: z.string().uuid().optional(),
  startAtISO: z.string().datetime(),
  endAtISO: z.string().datetime(),
  reason: z.string().max(200).optional().or(z.literal('')),
})

export async function createBlock(
  raw: z.infer<typeof CreateInput>,
): Promise<{ id?: string; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = CreateInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }
  const data = parsed.data

  if (data.scope === 'PROFESSIONAL' && !data.professionalId) {
    return { error: 'Profissional obrigatório quando escopo é específico' }
  }
  if (new Date(data.endAtISO) <= new Date(data.startAtISO)) {
    return { error: 'Fim deve ser depois do início' }
  }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('availability_blocks')
    .insert({
      tenant_id: tenant.id,
      professional_id: data.scope === 'TENANT' ? null : data.professionalId,
      start_at: data.startAtISO,
      end_at: data.endAtISO,
      reason: data.reason || null,
    })
    .select('id')
    .single()
  if (error || !created) return { error: error?.message ?? 'Falha' }

  revalidatePath('/admin/dashboard/bloqueios')
  return { id: created.id }
}

const DeleteInput = z.object({ id: z.string().uuid() })

export async function deleteBlock(raw: z.infer<typeof DeleteInput>): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = DeleteInput.safeParse(raw)
  if (!parsed.success) return { error: 'Input inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('availability_blocks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenant.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/dashboard/bloqueios')
  return { ok: true }
}
```

- [ ] **Step 2: Reescrever `src/app/admin/(authenticated)/dashboard/bloqueios/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { BlocksManager } from '@/components/dashboard/blocks-manager'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BloqueiosPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const initialNew = sp.new === '1'
  const initialProfessional = typeof sp.professional === 'string' ? sp.professional : null

  const supabase = await createClient()
  const [blocks, professionals] = await Promise.all([
    supabase
      .from('availability_blocks')
      .select('id, professional_id, start_at, end_at, reason')
      .eq('tenant_id', tenant.id)
      .gte('end_at', new Date().toISOString())
      .order('start_at'),
    supabase
      .from('professionals')
      .select('id, name, display_name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Bloqueios, folgas e feriados
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Bloqueie horários do negócio inteiro ou de um profissional específico.
        </p>
      </header>
      <BlocksManager
        blocks={(blocks.data ?? []).map((b) => ({
          id: b.id,
          professionalId: b.professional_id,
          startAt: b.start_at,
          endAt: b.end_at,
          reason: b.reason,
        }))}
        professionals={(professionals.data ?? []).map((p) => ({
          id: p.id,
          name: p.display_name ?? p.name,
        }))}
        tenantTimezone={tenant.timezone}
        initialNew={initialNew}
        initialProfessional={initialProfessional}
      />
    </main>
  )
}
```

- [ ] **Step 3: Criar `src/components/dashboard/blocks-manager.tsx`**

Client component com lista + form (toggle entre tenant/professional, datetime-local inputs, reason). Render lista existing + botão "Novo bloqueio" que abre form. Cada item tem botão "Excluir".

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createBlock, deleteBlock } from '@/app/admin/(authenticated)/actions/blocks'

type Block = {
  id: string
  professionalId: string | null
  startAt: string
  endAt: string
  reason: string | null
}

type Professional = { id: string; name: string }

export function BlocksManager({
  blocks,
  professionals,
  tenantTimezone,
  initialNew,
  initialProfessional,
}: {
  blocks: Block[]
  professionals: Professional[]
  tenantTimezone: string
  initialNew: boolean
  initialProfessional: string | null
}) {
  const [showForm, setShowForm] = useState(initialNew)
  const [scope, setScope] = useState<'TENANT' | 'PROFESSIONAL'>(initialProfessional ? 'PROFESSIONAL' : 'TENANT')
  const [professionalId, setProfessionalId] = useState<string>(initialProfessional ?? '')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function localToISO(local: string): string {
    // input datetime-local devolve "YYYY-MM-DDTHH:mm" sem TZ. Trata como TZ do tenant.
    return new Date(local).toISOString()
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createBlock({
        scope,
        professionalId: scope === 'PROFESSIONAL' ? professionalId : undefined,
        startAtISO: localToISO(startLocal),
        endAtISO: localToISO(endLocal),
        reason: reason || undefined,
      })
      if (result.error) setError(result.error)
      else {
        setShowForm(false)
        setStartLocal('')
        setEndLocal('')
        setReason('')
      }
    })
  }

  function remove(id: string) {
    if (!confirm('Excluir este bloqueio?')) return
    startTransition(async () => {
      await deleteBlock({ id })
    })
  }

  function fmtRange(b: Block): string {
    const fmtDateTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tenantTimezone,
      dateStyle: 'short',
      timeStyle: 'short',
    })
    return `${fmtDateTime.format(new Date(b.startAt))} → ${fmtDateTime.format(new Date(b.endAt))}`
  }

  function profLabel(id: string | null): string {
    if (id === null) return 'Negócio inteiro'
    return professionals.find((p) => p.id === id)?.name ?? '?'
  }

  return (
    <div className="space-y-4">
      {showForm ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scope === 'TENANT' ? 'default' : 'outline'}
                onClick={() => setScope('TENANT')}
              >
                Negócio inteiro
              </Button>
              <Button
                type="button"
                variant={scope === 'PROFESSIONAL' ? 'default' : 'outline'}
                onClick={() => setScope('PROFESSIONAL')}
              >
                Profissional específico
              </Button>
            </div>

            {scope === 'PROFESSIONAL' ? (
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-sm">Início</span>
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Fim</span>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                />
              </label>
            </div>

            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (opcional): feriado, férias…"
              maxLength={200}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={submit} disabled={pending || !startLocal || !endLocal || (scope === 'PROFESSIONAL' && !professionalId)}>
                {pending ? 'Salvando…' : 'Criar bloqueio'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button type="button" onClick={() => setShowForm(true)}>
          Novo bloqueio
        </Button>
      )}

      {blocks.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Nenhum bloqueio futuro.
        </p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-fg">{profLabel(b.professionalId)}</p>
                    <p className="text-sm text-fg-muted">{fmtRange(b)}</p>
                    {b.reason ? <p className="text-sm text-fg-muted italic">{b.reason}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    className="rounded-lg p-2 text-fg-muted hover:bg-error-bg hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Atualizar `src/app/admin/(authenticated)/dashboard/disponibilidade/page.tsx`**

Mudar redirect de `/profissionais` pra `/bloqueios`:

```typescript
import { redirect } from 'next/navigation'
export default function DisponibilidadePage() {
  redirect('/admin/dashboard/bloqueios')
}
```

- [ ] **Step 5: Remover availability-manager do detalhe do profissional**

Em `src/components/dashboard/professional-detail.tsx`, identificar onde `<AvailabilityManager />` é renderizado. Substituir por um link discreto:

```jsx
<Link href={`/admin/dashboard/bloqueios?professional=${professional.id}`}>
  <Button variant="outline">Ver bloqueios deste profissional</Button>
</Link>
```

(Manter `availability-manager.tsx` como módulo, mas não consumido neste detalhe — pode ser removido em fase futura se não houver outro caller. Verificar com grep.)

### Task 5.3: Clientes revamp

- [ ] **Step 1: Reescrever `src/app/admin/(authenticated)/dashboard/clientes/page.tsx`**

Adicionar busca client-side, total concluído por cliente, ação "Novo agendamento", linkar pra detalhe `/clientes/[id]`.

```typescript
import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { ClientsList } from '@/components/dashboard/clients-list'

export default async function ClientesPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [customers, appts] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, email, phone, created_at')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('appointments')
      .select('customer_id, status, price_cents_snapshot, start_at')
      .eq('tenant_id', tenant.id),
  ])

  // agregação por cliente
  const stats = new Map<string, { count: number; lastAt: string | null; totalCents: number }>()
  for (const a of appts.data ?? []) {
    if (!a.customer_id) continue
    const cur = stats.get(a.customer_id) ?? { count: 0, lastAt: null, totalCents: 0 }
    cur.count += 1
    if (!cur.lastAt || a.start_at > cur.lastAt) cur.lastAt = a.start_at
    if (a.status === 'COMPLETED') cur.totalCents += a.price_cents_snapshot ?? 0
    stats.set(a.customer_id, cur)
  }

  const list = (customers.data ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? '(sem nome)',
    email: c.email,
    phone: c.phone,
    createdAt: c.created_at,
    appointmentsCount: stats.get(c.id)?.count ?? 0,
    lastAt: stats.get(c.id)?.lastAt ?? null,
    totalCents: stats.get(c.id)?.totalCents ?? 0,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-4">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-fg-muted">Quem já agendou no seu negócio.</p>
      </header>
      <Link href="/admin/dashboard/agenda/novo">
        <button className="mb-3 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white">
          + Novo agendamento
        </button>
      </Link>
      <ClientsList items={list} tenantTimezone={tenant.timezone} />
    </main>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/clients-list.tsx`**

```typescript
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCentsToBrl } from '@/lib/money'

type Item = {
  id: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
  appointmentsCount: number
  lastAt: string | null
  totalCents: number
}

export function ClientsList({ items, tenantTimezone }: { items: Item[]; tenantTimezone: string }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.phone ?? '').toLowerCase().includes(q) ||
        (i.email ?? '').toLowerCase().includes(q),
    )
  }, [search, items])

  function fmtDate(iso: string | null): string | null {
    if (!iso) return null
    return new Intl.DateTimeFormat('pt-BR', { timeZone: tenantTimezone, dateStyle: 'short' }).format(new Date(iso))
  }

  return (
    <div>
      <Input
        type="search"
        placeholder="Buscar por nome, telefone ou e-mail"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
      />
      {filtered.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/dashboard/clientes/${c.id}`}>
                <Card className="shadow-xs transition-colors hover:bg-bg-subtle">
                  <CardContent className="py-3">
                    <p className="font-medium text-fg">{c.name}</p>
                    <p className="text-sm text-fg-muted">{c.phone ?? c.email ?? '(sem contato)'}</p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {c.appointmentsCount} agendamento{c.appointmentsCount === 1 ? '' : 's'}
                      {c.lastAt ? ` · último em ${fmtDate(c.lastAt)}` : ''}
                      {c.totalCents > 0 ? ` · ${formatCentsToBrl(c.totalCents)} concluído` : ''}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/app/admin/(authenticated)/dashboard/clientes/[id]/page.tsx`**

Detalhe de cliente com histórico de agendamentos, dados de contato, ação "Novo agendamento" pré-preenchido com esse cliente.

```typescript
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_LABELS } from '@/lib/appointments/labels'
import { formatCentsToBrl } from '@/lib/money'

type PageProps = { params: Promise<{ id: string }> }

export default async function ClienteDetailPage({ params }: PageProps) {
  const { id } = await params
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const [{ data: customer }, { data: appts }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, email, phone, created_at, notes')
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .single(),
    supabase
      .from('appointments')
      .select('id, start_at, status, price_cents_snapshot, service_name_snapshot')
      .eq('tenant_id', tenant.id)
      .eq('customer_id', id)
      .order('start_at', { ascending: false }),
  ])

  if (!customer) notFound()

  const completed = (appts ?? []).filter((a) => a.status === 'COMPLETED')
  const totalCents = completed.reduce((s, a) => s + (a.price_cents_snapshot ?? 0), 0)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link href="/admin/dashboard/clientes" className="mb-3 inline-block text-sm text-fg-muted">
        ← Voltar
      </Link>
      <header className="mb-4">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {customer.name ?? '(sem nome)'}
        </h1>
        <p className="text-sm text-fg-muted">
          {customer.phone ?? customer.email ?? '(sem contato)'}
        </p>
      </header>

      <div className="my-3 grid grid-cols-3 gap-2">
        <Card><CardContent className="py-3"><p className="text-xs text-fg-muted">Agendamentos</p><p className="font-display text-lg font-semibold">{appts?.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-fg-muted">Concluídos</p><p className="font-display text-lg font-semibold">{completed.length}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-fg-muted">Total</p><p className="font-display text-lg font-semibold">{formatCentsToBrl(totalCents)}</p></CardContent></Card>
      </div>

      <Link href={`/admin/dashboard/agenda/novo?customer=${customer.id}`}>
        <button className="my-3 w-full rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white">
          + Novo agendamento
        </button>
      </Link>

      <h2 className="mb-2 mt-4 text-sm font-medium uppercase tracking-wider text-fg-subtle">
        Histórico
      </h2>
      <ul className="space-y-2">
        {(appts ?? []).map((a) => (
          <li key={a.id}>
            <Link href={`/admin/dashboard/agenda/${a.id}`}>
              <Card className="shadow-xs hover:bg-bg-subtle">
                <CardContent className="flex justify-between py-3">
                  <div>
                    <p className="font-medium">{a.service_name_snapshot ?? 'Serviço'}</p>
                    <p className="text-sm text-fg-muted">
                      {new Intl.DateTimeFormat('pt-BR', {
                        timeZone: tenant.timezone,
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(a.start_at))}
                    </p>
                  </div>
                  <span className="text-xs">{STATUS_LABELS[a.status]}</span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 4: Wizard manual aceita `?customer=<id>` em pré-preenchimento**

Em `src/app/admin/(authenticated)/dashboard/agenda/novo/page.tsx`, ler `searchParams.customer` e passar `initialCustomerId` pro wizard. No wizard, se vier preenchido, setar `state.customer = { kind: 'existing', ... }` e pular pra step 2.

### Task 5.4: Financeiro revamp

- [ ] **Step 1: Reescrever `src/app/admin/(authenticated)/dashboard/financeiro/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { FinancialSummary } from '@/components/dashboard/financial-summary'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function rangeFromPreset(preset: string, timezone: string): { from: string; to: string } {
  const today = new Date()
  const tzNow = new Date(today.toLocaleString('en-US', { timeZone: timezone }))
  const startOfDay = new Date(tzNow); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(tzNow); endOfDay.setHours(23, 59, 59, 999)

  if (preset === 'today') return { from: startOfDay.toISOString(), to: endOfDay.toISOString() }
  if (preset === 'week') {
    const d = new Date(startOfDay); d.setDate(d.getDate() - d.getDay())
    return { from: d.toISOString(), to: endOfDay.toISOString() }
  }
  if (preset === 'month') {
    const d = new Date(startOfDay); d.setDate(1)
    return { from: d.toISOString(), to: endOfDay.toISOString() }
  }
  return { from: startOfDay.toISOString(), to: endOfDay.toISOString() }
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const preset = (typeof sp.preset === 'string' ? sp.preset : 'today') as 'today' | 'week' | 'month'
  const range = rangeFromPreset(preset, tenant.timezone)

  const supabase = await createClient()
  const [{ data: appts }, { data: services }, { data: profs }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, status, start_at, price_cents_snapshot, service_id, professional_id, service_name_snapshot, customer_name_snapshot')
      .eq('tenant_id', tenant.id)
      .gte('start_at', range.from)
      .lte('start_at', range.to)
      .order('start_at', { ascending: false }),
    supabase.from('services').select('id, name, price_cents').eq('tenant_id', tenant.id),
    supabase.from('professionals').select('id, name, display_name').eq('tenant_id', tenant.id),
  ])

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-4">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Resumo dos valores baseado em agendamentos e status. Não representa pagamento real.
        </p>
      </header>
      <FinancialSummary
        appointments={appts ?? []}
        services={services ?? []}
        professionals={profs ?? []}
        currentPreset={preset}
        tenantTimezone={tenant.timezone}
      />
    </main>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/financial-summary.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'
import { STATUS_LABELS } from '@/lib/appointments/labels'

type Appt = {
  id: string
  status: string
  start_at: string
  price_cents_snapshot: number | null
  service_id: string
  professional_id: string
  service_name_snapshot: string | null
  customer_name_snapshot: string | null
}

type Service = { id: string; name: string; price_cents: number }
type Professional = { id: string; name: string; display_name: string | null }

export function FinancialSummary({
  appointments,
  services,
  professionals,
  currentPreset,
  tenantTimezone,
}: {
  appointments: Appt[]
  services: Service[]
  professionals: Professional[]
  currentPreset: 'today' | 'week' | 'month'
  tenantTimezone: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const priceById = new Map(services.map((s) => [s.id, s.price_cents]))
  const profById = new Map(professionals.map((p) => [p.id, p.display_name ?? p.name]))
  const svcById = new Map(services.map((s) => [s.id, s.name]))

  const totals = useMemo(() => {
    let scheduled = 0, completed = 0, lost = 0
    let countCompleted = 0
    for (const a of appointments) {
      const cents = a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      if (a.status === 'COMPLETED') { completed += cents; countCompleted++ }
      else if (a.status === 'CANCELED' || a.status === 'NO_SHOW') lost += cents
      else scheduled += cents
    }
    const ticket = countCompleted > 0 ? completed / countCompleted : 0
    return { scheduled, completed, lost, ticket }
  }, [appointments, priceById])

  const byService = useMemo(() => {
    const m = new Map<string, { name: string; count: number; cents: number }>()
    for (const a of appointments) {
      if (a.status !== 'COMPLETED') continue
      const cur = m.get(a.service_id) ?? { name: svcById.get(a.service_id) ?? a.service_name_snapshot ?? '?', count: 0, cents: 0 }
      cur.count++
      cur.cents += a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      m.set(a.service_id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.cents - a.cents)
  }, [appointments, svcById, priceById])

  const byProfessional = useMemo(() => {
    const m = new Map<string, { name: string; count: number; cents: number }>()
    for (const a of appointments) {
      if (a.status !== 'COMPLETED') continue
      const cur = m.get(a.professional_id) ?? { name: profById.get(a.professional_id) ?? '?', count: 0, cents: 0 }
      cur.count++
      cur.cents += a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
      m.set(a.professional_id, cur)
    }
    return Array.from(m.values()).sort((a, b) => b.cents - a.cents)
  }, [appointments, profById, priceById])

  function setPreset(p: string) {
    router.push(`${pathname}?preset=${p}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { k: 'today', label: 'Hoje' },
          { k: 'week', label: 'Semana' },
          { k: 'month', label: 'Mês' },
        ].map((opt) => (
          <button
            key={opt.k}
            type="button"
            onClick={() => setPreset(opt.k)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              currentPreset === opt.k ? 'border-brand-primary bg-brand-primary text-white' : 'border-border'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Previsto" value={formatCentsToBrl(totals.scheduled + totals.completed)} hint="Marcados + concluídos" />
        <StatBox label="Realizado" value={formatCentsToBrl(totals.completed)} hint="Atendimentos concluídos" />
        <StatBox label="Perdido" value={formatCentsToBrl(totals.lost)} hint="Cancelados ou faltaram" />
        <StatBox label="Ticket médio" value={formatCentsToBrl(totals.ticket)} hint="Por atendimento" />
      </div>

      <Section title="Por serviço">
        {byService.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {byService.slice(0, 10).map((s) => (
              <li key={s.name} className="flex justify-between py-2 text-sm">
                <span>{s.name} <span className="text-fg-muted">· {s.count}</span></span>
                <span className="font-medium">{formatCentsToBrl(s.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Por profissional">
        {byProfessional.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {byProfessional.slice(0, 10).map((p) => (
              <li key={p.name} className="flex justify-between py-2 text-sm">
                <span>{p.name} <span className="text-fg-muted">· {p.count}</span></span>
                <span className="font-medium">{formatCentsToBrl(p.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Movimentos recentes">
        <ul className="divide-y divide-border">
          {appointments.slice(0, 20).map((a) => {
            const cents = a.price_cents_snapshot ?? priceById.get(a.service_id) ?? 0
            return (
              <li key={a.id} className="py-2">
                <Link href={`/admin/dashboard/agenda/${a.id}`} className="flex justify-between text-sm hover:text-brand-primary">
                  <span>
                    <span className="font-medium">{a.service_name_snapshot ?? svcById.get(a.service_id) ?? '?'}</span>
                    <span className="text-fg-muted"> · {a.customer_name_snapshot ?? '?'}</span>
                    <br />
                    <span className="text-xs text-fg-muted">
                      {new Intl.DateTimeFormat('pt-BR', { timeZone: tenantTimezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(a.start_at))} · {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS]}
                    </span>
                  </span>
                  <span className="font-medium">{formatCentsToBrl(cents)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

function StatBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs text-fg-muted">{label}</p>
        <p className="font-display text-xl font-semibold text-fg">{value}</p>
        <p className="text-xs text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-fg-subtle">{title}</h2>
      <Card><CardContent className="py-2">{children}</CardContent></Card>
    </section>
  )
}

function Empty() {
  return <p className="py-2 text-sm text-fg-muted">Sem dados no período.</p>
}
```

### Task 5.5: Relatórios revamp

- [ ] **Step 1: Reescrever `src/app/admin/(authenticated)/dashboard/relatorios/page.tsx`**

Resumo operacional simples por período: contagem de agendamentos por status, top serviços, top profissionais. Reaproveitar `FinancialSummary` (parte das tabelas).

Pra Fase 1, manter a tela leve — pode até reusar componentes da Financeiro com title diferente, mostrando contagens em vez de valores:

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const tenant = await getCurrentTenantOrNotFound()
  const sp = await searchParams
  const preset = typeof sp.preset === 'string' ? sp.preset : 'month'

  // Reuse rangeFromPreset (importar do financeiro/page.tsx ou extrair pra util compartilhada)
  // ... (similar a Financeiro)

  const supabase = await createClient()
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, status, service_id, professional_id, service_name_snapshot')
    .eq('tenant_id', tenant.id)
  // ... filtros + agregações por status, serviço, profissional

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-4">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-fg-muted">Resumo operacional do período.</p>
      </header>
      {/* contagens por status, top serviços, top profissionais */}
    </main>
  )
}
```

(Detalhe de UI fica a critério do executor — manter padrão visual + StatusBadge.)

### Task 5.6: Smoke + commit C5-2

- [ ] **Step 1: Atualizar `docs/smoke-test-pilot.md`**

Adicionar:
- Regras: alterar antecedência mínima → confirmar persistido + slot fica desabilitado conforme nova regra.
- Bloqueios: criar tenant-wide → slot some pra todos os profs; criar específico → some só pra ele; excluir.
- Clientes: busca, total concluído, link pra detalhe, "novo agendamento" pré-preenche cliente no wizard.
- Financeiro: filtro de período, 4 cards corretos, top serviços/profs, movimentos.
- Relatórios: contagens por status.

- [ ] **Step 2: Smoke manual**

- [ ] **Step 3: Typecheck + lint + build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(authenticated\)/dashboard/regras/ src/app/admin/\(authenticated\)/dashboard/bloqueios/ src/app/admin/\(authenticated\)/dashboard/clientes/ src/app/admin/\(authenticated\)/dashboard/financeiro/page.tsx src/app/admin/\(authenticated\)/dashboard/relatorios/page.tsx src/app/admin/\(authenticated\)/dashboard/disponibilidade/page.tsx src/app/admin/\(authenticated\)/actions/booking-rules.ts src/app/admin/\(authenticated\)/actions/blocks.ts src/components/dashboard/booking-rules-form.tsx src/components/dashboard/blocks-manager.tsx src/components/dashboard/clients-list.tsx src/components/dashboard/financial-summary.tsx src/components/dashboard/professional-detail.tsx docs/smoke-test-pilot.md
git commit -m "feat(admin/mais): Agenda + Gestão (regras + bloqueios + clientes + financeiro + relatórios)

- Regras: form com 4 campos (antecedência, intervalo, janela cancel, cancel cliente); slot calc respeita
- Bloqueios: tela central tenant-wide ou por profissional; remove availability-manager do detalhe do prof
- Clientes: busca, agregação (count + total concluído + última visita), detalhe com histórico, ação novo agendamento
- Financeiro: 4 cards (Previsto/Realizado/Perdido/Ticket médio), filtro período, top serviços/profs, movimentos
- Relatórios: contagens por status, top serviços e profissionais
- /disponibilidade redireciona pra /bloqueios"
```

---

## Phase 6 — Comunicação da Mais (C5-3)

**Goal:** Implementar 3 sub-telas: E-mails automáticos (editor de templates EMAIL), WhatsApp (editor de templates WHATSAPP + integração nos cards de agendamento), Notificações da equipe (refator do StaffPushToggle).

**Files:**
- Create: `src/app/admin/(authenticated)/dashboard/comunicacao/emails/page.tsx`
- Create: `src/app/admin/(authenticated)/dashboard/comunicacao/whatsapp/page.tsx`
- Create: `src/app/admin/(authenticated)/dashboard/comunicacao/notificacoes/page.tsx`
- Create: `src/components/dashboard/templates-editor.tsx`
- Create: `src/app/admin/(authenticated)/actions/templates.ts`
- Create: `src/components/dashboard/whatsapp-button.tsx` (botão pra usar nos cards de agendamento)
- Modify: `src/app/admin/(authenticated)/dashboard/agenda/[id]/page.tsx` (adicionar WhatsAppButton)

### Task 6.1: Server actions de templates

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/templates.ts`**

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'

const Channel = z.enum(['EMAIL', 'WHATSAPP'])
const Event = z.enum([
  'BOOKING_CONFIRMATION',
  'BOOKING_CANCELLATION',
  'BOOKING_REMINDER',
  'BOOKING_THANKS',
  'SHARE_LINK',
  'CUSTOM',
])

const UpsertInput = z.object({
  channel: Channel,
  event: Event,
  enabled: z.boolean(),
  subject: z.string().max(200).optional().or(z.literal('')),
  body: z.string().min(1).max(2000),
})

export async function upsertTemplate(
  raw: z.infer<typeof UpsertInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = UpsertInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const data = parsed.data

  const { error } = await supabase.from('tenant_message_templates').upsert(
    {
      tenant_id: tenant.id,
      channel: data.channel,
      event: data.event,
      enabled: data.enabled,
      subject: data.channel === 'EMAIL' ? data.subject || null : null,
      body: data.body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,channel,event' },
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/dashboard/comunicacao/${data.channel === 'EMAIL' ? 'emails' : 'whatsapp'}`)
  return { ok: true }
}
```

### Task 6.2: Templates editor (componente compartilhado EMAIL/WHATSAPP)

- [ ] **Step 1: Criar `src/components/dashboard/templates-editor.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { upsertTemplate } from '@/app/admin/(authenticated)/actions/templates'

export type TemplateRow = {
  channel: 'EMAIL' | 'WHATSAPP'
  event: string
  enabled: boolean
  subject: string | null
  body: string
}

const EVENT_LABELS: Record<string, string> = {
  BOOKING_CONFIRMATION: 'Confirmação de agendamento',
  BOOKING_CANCELLATION: 'Cancelamento de agendamento',
  BOOKING_REMINDER: 'Lembrete antes do horário',
  BOOKING_THANKS: 'Agradecimento pós-atendimento',
  SHARE_LINK: 'Compartilhar link de agendamento',
  CUSTOM: 'Personalizado',
}

const PLACEHOLDERS = ['{nome}', '{servico}', '{horario}', '{profissional}', '{link}']

export function TemplatesEditor({
  channel,
  templates,
}: {
  channel: 'EMAIL' | 'WHATSAPP'
  templates: TemplateRow[]
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        Placeholders disponíveis: {PLACEHOLDERS.map((p) => <code key={p} className="mx-1 rounded bg-bg-subtle px-1">{p}</code>)}
      </p>
      {templates.map((t) => (
        <TemplateCard key={t.event} channel={channel} initial={t} />
      ))}
    </div>
  )
}

function TemplateCard({ channel, initial }: { channel: 'EMAIL' | 'WHATSAPP'; initial: TemplateRow }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [body, setBody] = useState(initial.body)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const result = await upsertTemplate({
        channel,
        event: initial.event as 'BOOKING_CONFIRMATION',
        enabled,
        subject,
        body,
      })
      if (result.error) setMsg(`Erro: ${result.error}`)
      else setMsg('Salvo!')
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-fg">{EVENT_LABELS[initial.event] ?? initial.event}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span>{enabled ? 'Ativo' : 'Desativado'}</span>
          </label>
        </div>

        {channel === 'EMAIL' ? (
          <Input
            placeholder="Assunto do e-mail"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
        ) : null}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === 'EMAIL' ? 6 : 3}
          maxLength={2000}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono"
        />

        <div className="flex items-center justify-between">
          {msg ? <span className="text-sm text-fg-muted">{msg}</span> : <span />}
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Task 6.3: Tela E-mails automáticos

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/comunicacao/emails/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { TemplatesEditor, type TemplateRow } from '@/components/dashboard/templates-editor'

const EMAIL_EVENTS = ['BOOKING_CONFIRMATION', 'BOOKING_CANCELLATION', 'BOOKING_REMINDER', 'BOOKING_THANKS']

export default async function EmailsPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_message_templates')
    .select('event, enabled, subject, body')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'EMAIL')

  const byEvent = new Map((data ?? []).map((t) => [t.event, t]))
  const templates: TemplateRow[] = EMAIL_EVENTS.map((event) => {
    const existing = byEvent.get(event)
    return {
      channel: 'EMAIL',
      event,
      enabled: existing?.enabled ?? true,
      subject: existing?.subject ?? '',
      body: existing?.body ?? '',
    }
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          E-mails automáticos
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Mensagens que vão por e-mail pros seus clientes. Edite o conteúdo ou desligue o envio.
        </p>
      </header>
      <TemplatesEditor channel="EMAIL" templates={templates} />
    </main>
  )
}
```

### Task 6.4: Tela WhatsApp

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/comunicacao/whatsapp/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { TemplatesEditor, type TemplateRow } from '@/components/dashboard/templates-editor'

const WHATSAPP_EVENTS = ['BOOKING_CONFIRMATION', 'BOOKING_REMINDER', 'BOOKING_CANCELLATION', 'SHARE_LINK', 'CUSTOM']

export default async function WhatsappPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_message_templates')
    .select('event, enabled, subject, body')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'WHATSAPP')

  const byEvent = new Map((data ?? []).map((t) => [t.event, t]))
  const templates: TemplateRow[] = WHATSAPP_EVENTS.map((event) => {
    const existing = byEvent.get(event)
    return {
      channel: 'WHATSAPP',
      event,
      enabled: existing?.enabled ?? true,
      subject: null,
      body: existing?.body ?? '',
    }
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          WhatsApp
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Mensagens prontas pra você enviar pelo seu WhatsApp pessoal.
          Não enviamos automaticamente — você revisa antes.
        </p>
      </header>
      <TemplatesEditor channel="WHATSAPP" templates={templates} />
    </main>
  )
}
```

### Task 6.5: Botão WhatsApp nos cards de agendamento

- [ ] **Step 1: Criar `src/components/dashboard/whatsapp-button.tsx`**

```typescript
'use client'

import { MessageCircle } from 'lucide-react'
import { applyTemplate, buildWhatsappUrl } from '@/lib/contact/whatsapp'

export function WhatsappButton({
  phone,
  template,
  vars,
  label = 'Enviar pelo WhatsApp',
}: {
  phone: string | null
  template: string
  vars: Record<string, string | undefined | null>
  label?: string
}) {
  if (!phone) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-fg-subtle"
        title="Cliente sem telefone cadastrado"
      >
        <MessageCircle className="h-4 w-4" />
        {label}
      </button>
    )
  }
  const body = applyTemplate(template, vars)
  const url = buildWhatsappUrl(phone, body)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg transition-colors hover:bg-bg-subtle"
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  )
}
```

- [ ] **Step 2: Integrar no detalhe do appointment**

Em `src/app/admin/(authenticated)/dashboard/agenda/[id]/page.tsx`, carregar o template `WHATSAPP/BOOKING_CONFIRMATION` do tenant e renderizar o botão:

```typescript
const { data: tpl } = await supabase
  .from('tenant_message_templates')
  .select('body, enabled')
  .eq('tenant_id', tenant.id)
  .eq('channel', 'WHATSAPP')
  .eq('event', 'BOOKING_CONFIRMATION')
  .single()

// ...
{tpl?.enabled ? (
  <WhatsappButton
    phone={customer.phone}
    template={tpl.body}
    vars={{
      nome: customer.name,
      servico: appointment.serviceName,
      horario: timeLabel,
      profissional: appointment.professionalName,
      link: publicUrl,
    }}
  />
) : null}
```

### Task 6.6: Notificações da equipe (refator)

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/comunicacao/notificacoes/page.tsx`**

```typescript
import { StaffPushToggle } from '@/components/push/staff-push-toggle'
import { Card, CardContent } from '@/components/ui/card'

export default function NotificacoesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Notificações da equipe
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Receba avisos de novos agendamentos neste dispositivo.
          Funciona quando o navegador estiver fechado (PWA instalado recomendado).
        </p>
      </header>
      <Card>
        <CardContent className="py-4">
          <StaffPushToggle />
        </CardContent>
      </Card>
    </main>
  )
}
```

(O toggle existente já tem a lógica de `Notification.requestPermission()`, subscribe em `push_subscriptions`, validação de subscription real. Apenas reenquadra na nova rota.)

### Task 6.7: Smoke + commit C5-3

- [ ] **Step 1: Atualizar `docs/smoke-test-pilot.md`**

```markdown
## 9. Comunicação (revamp 2026-04-26)

### 9a. E-mails automáticos
- [ ] `/admin/dashboard/comunicacao/emails` lista 4 templates (Confirmação, Cancelamento, Lembrete, Agradecimento).
- [ ] Editar body + subject + salvar; refresh confirma persistido.
- [ ] Toggle "Desativado" persiste (validar em fase posterior se edge function respeita — vai em C6).

### 9b. WhatsApp
- [ ] `/admin/dashboard/comunicacao/whatsapp` lista 5 templates (Confirmação, Lembrete, Cancelamento, Compartilhar, Custom).
- [ ] Editar + salvar.
- [ ] No detalhe de um appointment (`/admin/dashboard/agenda/[id]`), botão "Enviar pelo WhatsApp" aparece.
- [ ] Click abre wa.me com mensagem renderizada (placeholders substituídos).
- [ ] Cliente sem telefone → botão desabilitado com tooltip.

### 9c. Notificações
- [ ] `/admin/dashboard/comunicacao/notificacoes` mostra StaffPushToggle.
- [ ] Toggle ativa/desativa permission + cria/remove push_subscription.
```

- [ ] **Step 2: Smoke manual**

- [ ] **Step 3: Typecheck + lint + build**

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(authenticated\)/dashboard/comunicacao/ src/app/admin/\(authenticated\)/actions/templates.ts src/components/dashboard/templates-editor.tsx src/components/dashboard/whatsapp-button.tsx src/app/admin/\(authenticated\)/dashboard/agenda/\[id\]/page.tsx docs/smoke-test-pilot.md
git commit -m "feat(admin/mais): Comunicação (e-mails + WhatsApp + notificações)

- E-mails automáticos: editor 4 templates (confirmação, cancelamento, lembrete, agradecimento) com toggle enabled
- WhatsApp: editor 5 templates + botão 'Enviar pelo WhatsApp' no detalhe do appointment
- Notificações: StaffPushToggle reenquadrado em rota dedicada com copy melhor"
```

---

## Phase 7 — Conta da Mais (C5-4)

**Goal:** Implementar 3 sub-telas: Usuários e permissões, Plano e cobrança (info-only), Segurança (mudar senha + sessões).

**Files:**
- Create: `src/app/admin/(authenticated)/dashboard/conta/usuarios/page.tsx`
- Create: `src/components/dashboard/users-manager.tsx`
- Create: `src/app/admin/(authenticated)/actions/users.ts`
- Create: `src/app/admin/(authenticated)/dashboard/conta/plano/page.tsx`
- Create: `src/app/admin/(authenticated)/dashboard/conta/seguranca/page.tsx`
- Create: `src/components/dashboard/security-panel.tsx`
- Create: `src/app/admin/(authenticated)/actions/security.ts`

### Task 7.1: Server actions de usuários

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/users.ts`**

```typescript
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { assertStaff } from '@/lib/auth/guards'

const Role = z.enum(['BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'])

const InviteInput = z.object({
  email: z.string().email(),
  role: Role,
})

export async function inviteStaff(
  raw: z.infer<typeof InviteInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff() // só staff (idealmente só BUSINESS_OWNER, mas leave a guarda mais granular pra futuro)
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = InviteInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const admin = createSecretClient()
  // Convidar usuário via Supabase Admin API (envia e-mail de convite com link)
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `https://${tenant.subdomain}.aralabs.com.br/auth/callback`,
    data: { tenant_id: tenant.id, tenant_name: tenant.name },
  })
  if (error || !invited?.user) return { error: error?.message ?? 'Falha ao convidar' }

  // Criar user_profile com a role no tenant
  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: invited.user.id,
    tenant_id: tenant.id,
    role: parsed.data.role,
  })
  if (profileError) return { error: profileError.message }

  revalidatePath('/admin/dashboard/conta/usuarios')
  return { ok: true }
}

const UpdateRoleInput = z.object({
  userProfileId: z.string().uuid(),
  role: Role,
})

export async function updateStaffRole(
  raw: z.infer<typeof UpdateRoleInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = UpdateRoleInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Input inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userProfileId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/dashboard/conta/usuarios')
  return { ok: true }
}

const DeactivateInput = z.object({ userProfileId: z.string().uuid() })

export async function deactivateStaff(
  raw: z.infer<typeof DeactivateInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const parsed = DeactivateInput.safeParse(raw)
  if (!parsed.success) return { error: 'Input inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', parsed.data.userProfileId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/dashboard/conta/usuarios')
  return { ok: true }
}
```

**Pré-checagem necessária:** confirmar que `user_profiles` tem coluna `role` e que enum `user_role` aceita os 3 valores. Se a UI já só lista `BUSINESS_OWNER`, restringir o select abaixo.

### Task 7.2: Tela Usuários e permissões

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/conta/usuarios/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createSecretClient } from '@/lib/supabase/secret'
import { UsersManager } from '@/components/dashboard/users-manager'

export default async function UsuariosPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const admin = createSecretClient()

  // Buscar profiles + emails do auth.users
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, user_id, role, created_at')
    .eq('tenant_id', tenant.id)

  const userIds = (profiles ?? []).map((p) => p.user_id)
  const { data: users } = userIds.length > 0
    ? await admin.auth.admin.listUsers({ perPage: 200 })
    : { data: { users: [] } }

  const emailById = new Map(
    (users?.users ?? []).filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.email ?? '']),
  )

  const rows = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.user_id) ?? '?',
    role: p.role,
    createdAt: p.created_at,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Usuários e permissões
        </h1>
        <p className="mt-1 text-sm text-fg-muted">Quem acessa o painel do seu negócio.</p>
      </header>
      <UsersManager users={rows} />
    </main>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/users-manager.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { inviteStaff, updateStaffRole, deactivateStaff } from '@/app/admin/(authenticated)/actions/users'

type User = { id: string; email: string; role: string; createdAt: string }

const ROLE_LABELS: Record<string, string> = {
  BUSINESS_OWNER: 'Dono',
  RECEPTIONIST: 'Recepção',
  PROFESSIONAL: 'Profissional',
}

export function UsersManager({ users }: { users: User[] }) {
  const [pending, startTransition] = useTransition()
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'BUSINESS_OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL'>('RECEPTIONIST')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function invite() {
    setMsg(null)
    startTransition(async () => {
      const result = await inviteStaff({ email: inviteEmail, role: inviteRole })
      if (result.error) setMsg({ kind: 'error', text: result.error })
      else {
        setMsg({ kind: 'success', text: 'Convite enviado!' })
        setInviteEmail('')
        setInviting(false)
      }
    })
  }

  function changeRole(id: string, role: string) {
    startTransition(async () => {
      await updateStaffRole({ userProfileId: id, role: role as 'BUSINESS_OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL' })
    })
  }

  function deactivate(id: string) {
    if (!confirm('Remover este usuário do painel?')) return
    startTransition(async () => {
      await deactivateStaff({ userProfileId: id })
    })
  }

  return (
    <div className="space-y-4">
      {inviting ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <Input
              type="email"
              placeholder="E-mail do convidado"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'BUSINESS_OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL')}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="BUSINESS_OWNER">Dono</option>
              <option value="RECEPTIONIST">Recepção</option>
              <option value="PROFESSIONAL">Profissional</option>
            </select>

            {msg ? (
              <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>{msg.text}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInviting(false)}>Cancelar</Button>
              <Button onClick={invite} disabled={pending || !inviteEmail}>{pending ? 'Enviando…' : 'Enviar convite'}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setInviting(true)}>Convidar usuário</Button>
      )}

      {users.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Nenhum usuário cadastrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-fg">{u.email}</p>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="mt-1 rounded border border-border bg-bg px-2 py-0.5 text-sm"
                      disabled={pending}
                    >
                      <option value="BUSINESS_OWNER">{ROLE_LABELS.BUSINESS_OWNER}</option>
                      <option value="RECEPTIONIST">{ROLE_LABELS.RECEPTIONIST}</option>
                      <option value="PROFESSIONAL">{ROLE_LABELS.PROFESSIONAL}</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => deactivate(u.id)}
                    className="rounded-lg p-2 text-fg-muted hover:bg-error-bg hover:text-error"
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Task 7.3: Tela Plano e cobrança (info-only)

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/conta/plano/page.tsx`**

```typescript
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

const STATUS_LABELS: Record<string, string> = {
  TRIALING: 'Em trial',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Em atraso',
  CANCELED: 'Cancelado',
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export default async function PlanoPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const { data: plan } = tenant.current_plan_id
    ? await supabase.from('plans').select('id, name, monthly_price_cents').eq('id', tenant.current_plan_id).single()
    : { data: null }

  const trialDays = daysUntil(tenant.trial_ends_at)
  const subDays = daysUntil(tenant.subscription_ends_at)

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Plano e cobrança
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Sua conta com a AraLabs. Para mudanças de plano ou faturamento, fale com o suporte.
        </p>
      </header>

      <div className="space-y-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-fg-muted">Status</p>
            <p className="font-display text-xl font-semibold">{STATUS_LABELS[tenant.billing_status] ?? tenant.billing_status}</p>
            {trialDays !== null && tenant.billing_status === 'TRIALING' ? (
              <p className="text-sm text-fg-muted">
                {trialDays > 0 ? `${trialDays} dias restantes no trial` : 'Trial expirou'}
              </p>
            ) : null}
            {subDays !== null && tenant.billing_status === 'ACTIVE' ? (
              <p className="text-sm text-fg-muted">Próxima renovação em {subDays} dias</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-fg-muted">Plano</p>
            <p className="font-display text-xl font-semibold">{plan?.name ?? 'Sem plano'}</p>
            <p className="text-sm text-fg-muted">
              {plan ? formatCentsToBrl(plan.monthly_price_cents) : '—'} / mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-sm">
              Para alterar plano, atualizar forma de pagamento ou ver histórico de cobranças,
              entre em contato com o suporte da AraLabs.
            </p>
            <a
              href="https://wa.me/5543999999999?text=Olá, preciso ajuda com plano e cobrança"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white"
            >
              Falar com o suporte
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

(Se número do suporte for variável, mover pra env var `NEXT_PUBLIC_SUPPORT_PHONE` e ler aqui.)

### Task 7.4: Server actions de segurança

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/actions/security.ts`**

```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'

const ChangePasswordInput = z.object({
  newPassword: z.string().min(8).max(72),
})

export async function changeMyPassword(
  raw: z.infer<typeof ChangePasswordInput>,
): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const parsed = ChangePasswordInput.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Senha inválida' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function signOutAllSessions(): Promise<{ ok?: true; error?: string }> {
  await assertStaff()
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) return { error: error.message }
  return { ok: true }
}
```

### Task 7.5: Tela Segurança

- [ ] **Step 1: Criar `src/app/admin/(authenticated)/dashboard/conta/seguranca/page.tsx`**

```typescript
import { SecurityPanel } from '@/components/dashboard/security-panel'

export default function SegurancaPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Segurança
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Sua senha e suas sessões.
        </p>
      </header>
      <SecurityPanel />
    </main>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/security-panel.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { changeMyPassword, signOutAllSessions } from '@/app/admin/(authenticated)/actions/security'

export function SecurityPanel() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pwd, setPwd] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function changePassword() {
    setMsg(null)
    if (pwd.length < 8) return setMsg({ kind: 'error', text: 'Mínimo 8 caracteres' })
    if (pwd !== pwdConfirm) return setMsg({ kind: 'error', text: 'Senhas não conferem' })
    startTransition(async () => {
      const result = await changeMyPassword({ newPassword: pwd })
      if (result.error) setMsg({ kind: 'error', text: result.error })
      else {
        setMsg({ kind: 'success', text: 'Senha alterada!' })
        setPwd('')
        setPwdConfirm('')
      }
    })
  }

  function signOutAll() {
    if (!confirm('Encerrar todas as sessões? Você precisará fazer login novamente em todos os dispositivos.')) return
    startTransition(async () => {
      const result = await signOutAllSessions()
      if (result.error) setMsg({ kind: 'error', text: result.error })
      else router.push('/admin/login')
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="font-medium">Alterar senha</h2>
          <Input
            type="password"
            placeholder="Nova senha (mín. 8 caracteres)"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirmar nova senha"
            value={pwdConfirm}
            onChange={(e) => setPwdConfirm(e.target.value)}
          />
          {msg ? (
            <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>{msg.text}</p>
          ) : null}
          <Button onClick={changePassword} disabled={pending || !pwd || !pwdConfirm}>
            {pending ? 'Alterando…' : 'Salvar nova senha'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="font-medium">Sessões</h2>
          <p className="text-sm text-fg-muted">
            Encerre todas as sessões ativas (em todos os dispositivos onde você está logado).
            Útil se perdeu acesso a algum aparelho.
          </p>
          <Button variant="outline" onClick={signOutAll} disabled={pending}>
            Encerrar todas as sessões
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Task 7.6: Smoke + commit C5-4

- [ ] **Step 1: Atualizar `docs/smoke-test-pilot.md`**

```markdown
## 10. Conta (revamp 2026-04-26)

### 10a. Usuários e permissões
- [ ] `/admin/dashboard/conta/usuarios` lista staff existentes do tenant.
- [ ] Convidar novo: e-mail + role → recebe convite (verificar caixa de email do convidado).
- [ ] Mudar role do dropdown persiste imediatamente.
- [ ] Remover usuário (Trash) tira do user_profiles do tenant.

### 10b. Plano e cobrança
- [ ] `/admin/dashboard/conta/plano` mostra status (TRIALING/ACTIVE), nome do plano, valor/mês, dias restantes.
- [ ] Botão "Falar com o suporte" abre wa.me com mensagem default.

### 10c. Segurança
- [ ] Alterar senha: nova senha + confirmação iguais → sucesso.
- [ ] Senha curta (<8) → erro inline.
- [ ] "Encerrar todas as sessões" → confirmação → redireciona pra /admin/login.
```

- [ ] **Step 2: Smoke manual**

- [ ] **Step 3: Typecheck + lint + build**

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(authenticated\)/dashboard/conta/ src/app/admin/\(authenticated\)/actions/users.ts src/app/admin/\(authenticated\)/actions/security.ts src/components/dashboard/users-manager.tsx src/components/dashboard/security-panel.tsx docs/smoke-test-pilot.md
git commit -m "feat(admin/mais): Conta (usuários + plano + segurança)

- Usuários: lista, convidar (e-mail + role), mudar role inline, remover
- Plano e cobrança: info-only (status, plano, valor, dias restantes, link suporte WhatsApp)
- Segurança: alterar senha + encerrar todas as sessões"
```

---

## Phase 8 — Integração + docs (C6)

**Goal:** Edge function `on-appointment-event` passa a ler templates do DB com fallback. Smoke test consolidado. Épico 10 atualizado com itens #31 e #32.

**Files:**
- Modify: `supabase/functions/on-appointment-event/index.ts`
- Deploy via MCP: `mcp__supabase__deploy_edge_function`
- Modify: `docs/smoke-test-pilot.md` (consolidação final)
- Modify: `docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md` (adicionar #31 e #32)

### Task 8.1: Edge function lê tenant_message_templates

- [ ] **Step 1: Inspecionar `supabase/functions/on-appointment-event/index.ts`**

```bash
ls supabase/functions/on-appointment-event/
cat supabase/functions/on-appointment-event/index.ts | head -80
```

Identificar onde os templates de e-mail são definidos hoje (provável: constantes hard-coded por evento).

- [ ] **Step 2: Adicionar lookup do template no DB com fallback**

Refatorar pra função helper:

```typescript
// supabase/functions/on-appointment-event/index.ts (trecho)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const FALLBACK_TEMPLATES: Record<string, { subject: string; body: string }> = {
  EMAIL_BOOKING_CONFIRMATION: {
    subject: 'Seu agendamento foi confirmado',
    body: 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.',
  },
  EMAIL_BOOKING_CANCELLATION: {
    subject: 'Seu agendamento foi cancelado',
    body: 'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.',
  },
  EMAIL_BOOKING_REMINDER: {
    subject: 'Lembrete do seu agendamento',
    body: 'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.',
  },
}

async function loadTemplate(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  channel: 'EMAIL' | 'WHATSAPP',
  event: string,
): Promise<{ enabled: boolean; subject: string; body: string }> {
  const fallback = FALLBACK_TEMPLATES[`${channel}_${event}`]
  if (!fallback) throw new Error(`No fallback for ${channel}/${event}`)

  const { data } = await supabase
    .from('tenant_message_templates')
    .select('enabled, subject, body')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .eq('event', event)
    .maybeSingle()

  if (!data) return { enabled: true, ...fallback }
  return {
    enabled: data.enabled,
    subject: data.subject ?? fallback.subject,
    body: data.body || fallback.body,
  }
}

function applyTemplate(body: string, vars: Record<string, string | undefined | null>): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key]
    return v == null || v === '' ? match : v
  })
}
```

Onde a função enviava o e-mail antes (provavelmente algo tipo `await resend.emails.send({ subject: '...', html: '...' })`), agora:

```typescript
const tpl = await loadTemplate(supabase, tenantId, 'EMAIL', 'BOOKING_CONFIRMATION')
if (!tpl.enabled) {
  console.log(`Template EMAIL/BOOKING_CONFIRMATION desativado pro tenant ${tenantId}`)
  return
}
const subject = applyTemplate(tpl.subject, vars)
const body = applyTemplate(tpl.body, vars)
await resend.emails.send({ from, to, subject, html: bodyToHtml(body) })
```

- [ ] **Step 3: Deploy via MCP**

Usar `mcp__supabase__deploy_edge_function`:

```
name: on-appointment-event
files:
  - path: index.ts
    content: <conteúdo atualizado>
```

- [ ] **Step 4: Testar deploy**

Verificar logs com `mcp__supabase__get_logs({service: 'edge-function'})` após criar/cancelar um appointment de teste.

Smoke completo:
1. Criar appointment via wizard manual com e-mail de cliente real (próprio).
2. Verificar e-mail recebido com subject + body do template default.
3. Editar template EMAIL/BOOKING_CONFIRMATION no `/admin/dashboard/comunicacao/emails` (mudar texto).
4. Criar outro appointment.
5. Verificar e-mail recebido com texto novo.
6. Desativar template (toggle).
7. Criar outro appointment.
8. Verificar que e-mail NÃO foi enviado; log da edge function mostra "desativado".

### Task 8.2: Adicionar itens #31 e #32 no Épico 10

- [ ] **Step 1: Editar `docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md`**

Adicionar no índice (após linha do item #30):

```markdown
| 31 | Status enum operacional + modo recepção (ARRIVED, IN_PROGRESS) | Sessão 2026-04-26 admin revamp / decisão #2 | Média |
| 32 | Categoria de serviço (agrupamento na tela Serviços e booking público) | Sessão 2026-04-26 admin revamp / decisão #4 | Baixa |
```

E ao final do arquivo, adicionar as 2 seções novas:

```markdown
## Task 31: Status enum operacional + modo recepção

**Origem:** Decisão #2 do revamp 2026-04-26.

Adicionar `ARRIVED` e `IN_PROGRESS` ao `appointment_status` enum. Permite distinguir "cliente chegou na recepção" de "atendimento em andamento" e habilita o "Modo recepção/painel" descrito na seção 6.7 do spec funcional do revamp.

**Steps:**
- [ ] Migration: `ALTER TYPE appointment_status ADD VALUE 'ARRIVED'`; mesma pra `'IN_PROGRESS'`. Aplicar via MCP.
- [ ] Regenerar types TS.
- [ ] Em `src/lib/appointments/labels.ts`: adicionar `ARRIVED: 'Chegou'` e `IN_PROGRESS: 'Em atendimento'` em `STATUS_LABELS` + tones em `STATUS_TONE`.
- [ ] Em `src/lib/appointments/queries.ts` (e similares): atualizar filtros `status NOT IN (CANCELED, NO_SHOW)` que excluem cancelados — agora ARRIVED/IN_PROGRESS devem entrar como ativos.
- [ ] No detalhe do appointment (`/admin/dashboard/agenda/[id]`): adicionar botões "Marcar como chegou" (CONFIRMED → ARRIVED), "Iniciar atendimento" (ARRIVED → IN_PROGRESS), "Concluir" (IN_PROGRESS → COMPLETED).
- [ ] Modo recepção: nova rota `/admin/dashboard/painel` com layout maximizado (Agora/Próximos/Livres) pra exibição em tablet/PC durante expediente.

## Task 32: Categoria de serviço

**Origem:** Decisão #4 do revamp 2026-04-26.

Permitir agrupar serviços por categoria (Cabelo, Barba, Unhas, Estética, Pacotes, etc) na tela Serviços e no booking público.

**Steps:**
- [ ] Migration: `ALTER TABLE services ADD COLUMN category text` (free-text, sem FK).
- [ ] Regenerar types.
- [ ] No editor de serviço (em `services-manager.tsx`): adicionar input com autocomplete a partir das categorias já existentes do tenant.
- [ ] Na tela Serviços (`/admin/dashboard/servicos`): agrupar cards por categoria com header dobrável; categoria vazia/null → grupo "Outros".
- [ ] No booking público (`/book`): mesmo agrupamento.
```

### Task 8.3: Smoke test consolidado

- [ ] **Step 1: Editar `docs/smoke-test-pilot.md`**

Pasada final: garantir que toda nova rota implementada no revamp tem entrada no roteiro. Checar especificamente:
- Atualizar credenciais se mudaram.
- Roteiro de criação manual menciona pré-fill via `?customer=`.
- Seção "Notificações" referencia a nova rota `/admin/dashboard/comunicacao/notificacoes`.
- Seção "E-mails" cobre o fluxo de edição + desativação + verificação no envio real.

Adicionar nota no topo:

```markdown
> **Atualizado em 2026-04-26 (admin revamp):** roteiro cobre Home revisada, Agenda com filtros, wizard de criação manual, Mais reorganizada em 5 seções com 14 sub-telas, e integração das edge functions com `tenant_message_templates`.
```

### Task 8.4: Commit C6

- [ ] **Step 1: Status**

```bash
git status
```

Esperado: modificados `supabase/functions/on-appointment-event/index.ts`, `docs/smoke-test-pilot.md`, `docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md`.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/on-appointment-event/ docs/smoke-test-pilot.md docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md
git commit -m "chore: edge-fn lê message templates + smoke consolidado + Épico 10 #31 #32

- on-appointment-event: loadTemplate(tenantId, channel, event) com fallback hard-coded; respeita enabled=false
- Deploy via MCP
- Smoke test: pasada final cobrindo todas as rotas do revamp
- Épico 10: adicionados #31 (status enum operacional + modo recepção) e #32 (categoria de serviço)"
```

---

## Final verification

Antes de declarar revamp completo:

- [ ] **Step 1: Build limpo**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 2: Smoke test ponta-a-ponta**

Rodar o `docs/smoke-test-pilot.md` inteiro do início ao fim em `barbearia-teste.lvh.me:3008`. Marcar todos os checkboxes; corrigir qualquer divergência antes de PR.

- [ ] **Step 3: Advisors do Supabase**

```
mcp__supabase__get_advisors({type: 'security'})
mcp__supabase__get_advisors({type: 'performance'})
```

Resolver qualquer warning novo introduzido pelo revamp (especialmente RLS na nova tabela `tenant_message_templates`).

- [ ] **Step 4: Verificar histórico de commits**

```bash
git log --oneline main..HEAD
```

Esperado: 9 commits (C1, C2, C3, C4, C5-1, C5-2, C5-3, C5-4, C6) na ordem do plano.

- [ ] **Step 5: Push + abrir PR**

```bash
git push -u origin claude/nifty-pascal-489446
gh pr create --title "Admin revamp: 5 telas top-level + 14 sub-telas da Mais" --body "$(cat <<'EOF'
## Summary

Revamp completo do admin do negócio conforme `docs/superpowers/specs/2026-04-26-admin-revamp-design.md`. Cobre Fase 1A + 1B do spec funcional original em 9 commits agrupados por layer:

- **Schema (C1):** regras de agendamento, bloqueios tenant-wide, message templates editáveis.
- **Foundation (C2):** slot calculator tenant-wide-aware, server action `getBookingContext`, derivações (atrasado, trabalha hoje, sem horário), helper de template WhatsApp.
- **Wizard manual (C3):** rota `/admin/dashboard/agenda/novo` client-side com 5 steps.
- **Tab bar (C4):** Home + Agenda + Equipe + Serviços revisados.
- **Mais (C5-1 a C5-4):** reorganização em 5 seções com 14 sub-telas (Meu negócio, Agenda, Gestão, Comunicação, Conta).
- **Integração (C6):** edge function lê templates do DB com fallback; smoke test consolidado; Épico 10 atualizado com #31 e #32.

## Test plan
- [ ] Rodar smoke test inteiro em `barbearia-teste.lvh.me:3008` (`docs/smoke-test-pilot.md`)
- [ ] Verificar advisors Supabase (security + performance) sem warnings novos
- [ ] Confirmar `pnpm typecheck && pnpm lint && pnpm build` limpo
- [ ] Verificar e-mail de confirmação real recebido com template editado
- [ ] Confirmar wizard manual cria appointment + cliente novo on-the-fly
EOF
)"
```

---

## Tracking & references

- **Spec original:** `docs/superpowers/specs/2026-04-26-admin-revamp-design.md`
- **Spec funcional do usuário:** capturado no chat de brainstorming desta sessão (linhas 1-1000+ do prompt inicial). Referência para microcopy, conteúdo de telas e empty states.
- **Tech debt gerado:** itens #31 (status enum + modo recepção) e #32 (categoria de serviço) no `2026-04-19-epic-10-tech-debt.md`.
- **Convenção do repo:** `AGENTS.md` (smoke test atualizado em todo PR que muda fluxo visível).









