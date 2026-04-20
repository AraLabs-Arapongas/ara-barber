# Spec 1 — Operação da Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o que falta pra um salão operar a agenda de ponta a ponta: disponibilidade/blocks, agenda live com realtime, status transitions (confirmar/cancelar/no-show/completar), cancelamento pelo cliente e LGPD (export + delete).

**Architecture:** Status machine via server actions server-side com Postgres function central (`validate_appointment_conflict`). Agenda live em client component com Supabase Realtime + polling fallback. Schema mudanças mínimas; nenhum walk-in no escopo deste plano.

**Tech Stack:** Next.js 16 (App Router + Server Actions), Supabase (Postgres + Auth + Realtime), `@supabase/ssr`, Zod, Vitest, TailwindCSS 4, react-modal-sheet (BottomSheet já existe).

**Referência:** [Spec 1 design](../specs/2026-04-19-spec-01-operacao-agenda-design.md).

---

## File structure

### Novos arquivos

```
src/app/salon/(authenticated)/actions/
  appointment-status.ts                # server actions: confirm/cancel/no-show/complete
src/app/meus-agendamentos/
  actions.ts                           # server action: cancelCustomerAppointment
src/app/perfil/dados/
  route.ts                             # GET → JSON download
src/app/perfil/apagar-conta/
  actions.ts                           # server action: soft-delete
src/app/salon/(authenticated)/dashboard/agenda/
  agenda-view.tsx                      # client component: Realtime + renderização
  appointment-sheet.tsx                # client component: detalhe + ações
src/lib/appointments/
  status-rules.ts                      # predicado: canTransition(from, to, ctx)
  queries.ts                           # helpers de leitura (agenda do dia, etc.)
scripts/
  seed-pilot-availability.ts           # seed business_hours + professional_availability
```

### Arquivos modificados

```
src/app/salon/(authenticated)/dashboard/agenda/page.tsx
  → server component; delega render pro <AgendaView>
src/app/salon/(authenticated)/dashboard/disponibilidade/page.tsx
  → adiciona tab "Bloqueios" se ainda não existe
src/app/meus-agendamentos/page.tsx
  → botão "Cancelar" nos cards elegíveis
src/app/perfil/page.tsx
  → itens "Baixar meus dados" + "Apagar minha conta"
src/app/book/confirmar/page.tsx (ou a server action que cria appointment)
  → chamar validate_appointment_conflict antes de INSERT
src/lib/tenant/context.ts
  → expor cancellation_window_hours e consent_given_at onde fizer sentido
src/lib/supabase/types.ts
  → regenerar via MCP após migrations
```

---

## Task 1: Schema migrations + types

**Files:**
- Apply: migration `add_cancellation_and_lgpd_columns` via MCP
- Modify: `src/lib/supabase/types.ts` (regenerated)

- [ ] **Step 1: Aplicar migration via MCP**

Usar `mcp__supabase__apply_migration` com nome `add_cancellation_and_lgpd_columns`:

```sql
-- Janela de cancelamento (horas antes do start_at)
ALTER TABLE tenants ADD COLUMN cancellation_window_hours integer NOT NULL DEFAULT 2;

-- Momento do consentimento LGPD
ALTER TABLE customers ADD COLUMN consent_given_at timestamptz;
ALTER TABLE customers ADD COLUMN deleted_at timestamptz;

-- Auditoria de cancelamento
ALTER TABLE appointments ADD COLUMN canceled_at timestamptz;
ALTER TABLE appointments ADD COLUMN canceled_by uuid REFERENCES auth.users(id);
ALTER TABLE appointments ADD COLUMN cancel_reason text;

-- Snapshot do nome do cliente no momento do appointment
-- (pra sobreviver a anonimização via LGPD delete)
ALTER TABLE appointments ADD COLUMN customer_name_snapshot text;

-- Backfill do snapshot pros appointments existentes
UPDATE appointments a
   SET customer_name_snapshot = c.name
  FROM customers c
 WHERE a.customer_id = c.id
   AND a.customer_name_snapshot IS NULL;

COMMENT ON COLUMN tenants.cancellation_window_hours IS 'Horas antes do start_at que o cliente ainda pode cancelar. Staff ignora a janela.';
COMMENT ON COLUMN customers.consent_given_at IS 'Quando o cliente primeiro passou pelo OTP (consentimento LGPD).';
COMMENT ON COLUMN customers.deleted_at IS 'Soft-delete LGPD. Row fica, mas PII é anonimizada.';
COMMENT ON COLUMN appointments.customer_name_snapshot IS 'Nome do cliente gravado na criação do appointment. Sobrevive a soft-delete do cliente.';
```

- [ ] **Step 2: Regenerar types TypeScript**

Usar `mcp__supabase__generate_typescript_types` e substituir `src/lib/supabase/types.ts` com o resultado.

- [ ] **Step 3: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations src/lib/supabase/types.ts
git commit -m "feat(db): colunas de cancelamento + LGPD + customer_name_snapshot"
```

---

## Task 2: Função validate_appointment_conflict

**Files:**
- Apply: migration `validate_appointment_conflict_fn`

- [ ] **Step 1: Aplicar function via MCP**

Usar `mcp__supabase__apply_migration` com nome `validate_appointment_conflict_fn`:

```sql
CREATE OR REPLACE FUNCTION public.validate_appointment_conflict(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT NOT EXISTS (
    -- Conflito com appointment existente (mesmo profissional, status ativo)
    SELECT 1 FROM public.appointments
     WHERE tenant_id = p_tenant_id
       AND professional_id = p_professional_id
       AND status NOT IN ('CANCELED', 'NO_SHOW')
       AND (p_exclude_id IS NULL OR id <> p_exclude_id)
       AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at)
  ) AND NOT EXISTS (
    -- Conflito com bloqueio ativo
    SELECT 1 FROM public.availability_blocks
     WHERE tenant_id = p_tenant_id
       AND professional_id = p_professional_id
       AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at)
  );
$$;

COMMENT ON FUNCTION public.validate_appointment_conflict IS
  'Retorna true se o slot está livre (sem appointment ativo nem bloqueio). '
  'Não valida business_hours/professional_availability (fica na view-layer).';

-- Grant execute pra authenticated (staff + customer via service role contornam RLS normalmente)
GRANT EXECUTE ON FUNCTION public.validate_appointment_conflict TO authenticated, anon;
```

- [ ] **Step 2: Testar manualmente via SQL**

Usar `mcp__supabase__execute_sql` com queries de sanidade:

```sql
-- Caso 1: slot livre retorna true
SELECT public.validate_appointment_conflict(
  (SELECT id FROM tenants WHERE slug='barbearia-teste'),
  (SELECT id FROM professionals WHERE tenant_id=(SELECT id FROM tenants WHERE slug='barbearia-teste') LIMIT 1),
  now() + interval '2 days',
  now() + interval '2 days 30 minutes'
);
-- Expected: true

-- Caso 2: slot ocupado por appointment ativo retorna false
-- (cria um appointment de teste, testa, remove)
-- Opcional nesse momento; fica coberto pelo pgTAP do debt #15.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): função validate_appointment_conflict"
```

---

## Task 3: Regras da status machine (helper puro)

**Files:**
- Create: `src/lib/appointments/status-rules.ts`
- Create: `src/lib/appointments/status-rules.test.ts`

- [ ] **Step 1: Criar helper com os predicados de transição**

Criar `src/lib/appointments/status-rules.ts`:

```ts
import type { Database } from '@/lib/supabase/types'

export type AppointmentStatus = Database['public']['Enums']['appointment_status']

export type TransitionActor = 'staff' | 'customer'

export type TransitionContext = {
  actor: TransitionActor
  now: Date
  startAt: Date
  endAt: Date
  cancellationWindowHours: number
}

type Rule = (ctx: TransitionContext) => { ok: true } | { ok: false; reason: string }

const REQUIRE_STAFF: Rule = (ctx) =>
  ctx.actor === 'staff' ? { ok: true } : { ok: false, reason: 'Apenas staff pode fazer essa transição.' }

const REQUIRE_PAST_START: Rule = (ctx) =>
  ctx.now.getTime() >= ctx.startAt.getTime()
    ? { ok: true }
    : { ok: false, reason: 'Só é possível depois do horário passar.' }

const REQUIRE_PAST_END: Rule = (ctx) =>
  ctx.now.getTime() >= ctx.endAt.getTime()
    ? { ok: true }
    : { ok: false, reason: 'Só é possível depois do serviço terminar.' }

const REQUIRE_WITHIN_CANCEL_WINDOW: Rule = (ctx) => {
  if (ctx.actor === 'staff') return { ok: true }
  const cutoff = ctx.startAt.getTime() - ctx.cancellationWindowHours * 60 * 60 * 1000
  return ctx.now.getTime() <= cutoff
    ? { ok: true }
    : { ok: false, reason: `Cancelamento só até ${ctx.cancellationWindowHours}h antes.` }
}

const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, Rule[]>>> = {
  SCHEDULED: {
    CONFIRMED: [REQUIRE_STAFF],
    CANCELED: [REQUIRE_WITHIN_CANCEL_WINDOW],
    NO_SHOW: [REQUIRE_STAFF, REQUIRE_PAST_START],
  },
  CONFIRMED: {
    CANCELED: [REQUIRE_WITHIN_CANCEL_WINDOW],
    NO_SHOW: [REQUIRE_STAFF, REQUIRE_PAST_START],
    COMPLETED: [REQUIRE_STAFF, REQUIRE_PAST_END],
  },
  COMPLETED: {},
  CANCELED: {},
  NO_SHOW: {},
}

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  ctx: TransitionContext,
): { ok: true } | { ok: false; reason: string } {
  const rules = TRANSITIONS[from]?.[to]
  if (!rules) return { ok: false, reason: `Transição ${from} → ${to} não é permitida.` }
  for (const rule of rules) {
    const result = rule(ctx)
    if (!result.ok) return result
  }
  return { ok: true }
}
```

- [ ] **Step 2: Escrever testes unitários**

Criar `src/lib/appointments/status-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canTransition } from './status-rules'

const baseCtx = {
  actor: 'staff' as const,
  now: new Date('2026-05-01T10:00:00Z'),
  startAt: new Date('2026-05-01T14:00:00Z'),
  endAt: new Date('2026-05-01T14:30:00Z'),
  cancellationWindowHours: 2,
}

describe('canTransition', () => {
  it('staff confirma SCHEDULED → CONFIRMED', () => {
    expect(canTransition('SCHEDULED', 'CONFIRMED', baseCtx)).toEqual({ ok: true })
  })

  it('customer não pode confirmar', () => {
    expect(canTransition('SCHEDULED', 'CONFIRMED', { ...baseCtx, actor: 'customer' })).toEqual({
      ok: false,
      reason: expect.stringContaining('staff'),
    })
  })

  it('cliente cancela dentro da janela', () => {
    const ctx = { ...baseCtx, actor: 'customer' as const, now: new Date('2026-05-01T11:00:00Z') }
    expect(canTransition('CONFIRMED', 'CANCELED', ctx)).toEqual({ ok: true })
  })

  it('cliente não cancela depois da janela', () => {
    const ctx = { ...baseCtx, actor: 'customer' as const, now: new Date('2026-05-01T13:30:00Z') }
    expect(canTransition('CONFIRMED', 'CANCELED', ctx)).toEqual({
      ok: false,
      reason: expect.stringContaining('2h antes'),
    })
  })

  it('staff cancela ignorando janela', () => {
    const ctx = { ...baseCtx, now: new Date('2026-05-01T13:55:00Z') }
    expect(canTransition('CONFIRMED', 'CANCELED', ctx)).toEqual({ ok: true })
  })

  it('NO_SHOW só depois do start_at', () => {
    expect(canTransition('CONFIRMED', 'NO_SHOW', baseCtx)).toEqual({
      ok: false,
      reason: expect.stringContaining('horário passar'),
    })
    const after = { ...baseCtx, now: new Date('2026-05-01T14:05:00Z') }
    expect(canTransition('CONFIRMED', 'NO_SHOW', after)).toEqual({ ok: true })
  })

  it('COMPLETED só depois de end_at', () => {
    const mid = { ...baseCtx, now: new Date('2026-05-01T14:15:00Z') }
    expect(canTransition('CONFIRMED', 'COMPLETED', mid)).toEqual({
      ok: false,
      reason: expect.stringContaining('serviço terminar'),
    })
    const after = { ...baseCtx, now: new Date('2026-05-01T14:35:00Z') }
    expect(canTransition('CONFIRMED', 'COMPLETED', after)).toEqual({ ok: true })
  })

  it('COMPLETED/CANCELED/NO_SHOW não transicionam de volta', () => {
    expect(canTransition('COMPLETED', 'CONFIRMED', baseCtx).ok).toBe(false)
    expect(canTransition('CANCELED', 'SCHEDULED', baseCtx).ok).toBe(false)
    expect(canTransition('NO_SHOW', 'CONFIRMED', baseCtx).ok).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar testes**

```bash
pnpm test src/lib/appointments/status-rules.test.ts
```

Expected: todos passam.

- [ ] **Step 4: Commit**

```bash
git add src/lib/appointments
git commit -m "feat(appointments): helper puro canTransition com rules"
```

---

## Task 4: Server actions de status (staff)

**Files:**
- Create: `src/app/salon/(authenticated)/actions/appointment-status.ts`

- [ ] **Step 1: Criar as server actions**

Criar `src/app/salon/(authenticated)/actions/appointment-status.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { canTransition } from '@/lib/appointments/status-rules'

const StatusEnum = z.enum(['CONFIRMED', 'CANCELED', 'NO_SHOW', 'COMPLETED'])

const Input = z.object({
  appointmentId: z.string().uuid(),
  nextStatus: StatusEnum,
  reason: z.string().max(500).optional(),
})

type Result = { ok: true } | { ok: false; error: string }

export async function transitionAppointmentStatus(
  raw: z.infer<typeof Input>,
): Promise<Result> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Input inválido.' }
  const { appointmentId, nextStatus, reason } = parsed.data

  const user = await assertStaff()

  const supabase = await createClient()
  const { data: appt, error: readErr } = await supabase
    .from('appointments')
    .select('id, tenant_id, status, start_at, end_at')
    .eq('id', appointmentId)
    .maybeSingle()

  if (readErr || !appt) return { ok: false, error: 'Agendamento não encontrado.' }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('cancellation_window_hours')
    .eq('id', appt.tenant_id)
    .maybeSingle()

  const check = canTransition(appt.status, nextStatus, {
    actor: 'staff',
    now: new Date(),
    startAt: new Date(appt.start_at),
    endAt: new Date(appt.end_at),
    cancellationWindowHours: tenant?.cancellation_window_hours ?? 2,
  })
  if (!check.ok) return { ok: false, error: check.reason }

  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === 'CANCELED') {
    update.canceled_at = new Date().toISOString()
    update.canceled_by = user.id
    update.cancel_reason = reason ?? null
  }

  const { error: updateErr } = await supabase
    .from('appointments')
    .update(update)
    .eq('id', appointmentId)

  if (updateErr) return { ok: false, error: 'Falha ao atualizar. Tente novamente.' }

  revalidatePath('/salon/dashboard/agenda')
  return { ok: true }
}
```

- [ ] **Step 2: Confirmar que `assertStaff` existe**

```bash
grep -rn "export.*assertStaff" src/lib
```

Se não existir, usar o guard equivalente que o projeto usa em outros server actions do `/salon/(authenticated)`. Verifique em `src/lib/auth/` ou em imports de arquivos vizinhos.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/app/salon/\(authenticated\)/actions
git commit -m "feat(appointments): server action transitionAppointmentStatus"
```

---

## Task 5: Server action de cancelamento pelo cliente

**Files:**
- Create: `src/app/meus-agendamentos/actions.ts`

- [ ] **Step 1: Criar action**

Criar `src/app/meus-agendamentos/actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canTransition } from '@/lib/appointments/status-rules'

const Input = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

type Result = { ok: true } | { ok: false; error: string }

export async function cancelCustomerAppointment(
  raw: z.infer<typeof Input>,
): Promise<Result> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Input inválido.' }
  const { appointmentId, reason } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  // RLS filtra pra customer só ver o próprio. A query retorna null se não for dele.
  const { data: appt, error: readErr } = await supabase
    .from('appointments')
    .select('id, tenant_id, status, start_at, end_at, customer_id')
    .eq('id', appointmentId)
    .maybeSingle()

  if (readErr || !appt) return { ok: false, error: 'Agendamento não encontrado.' }

  // Dupla verificação: o customer_id pertence ao user
  const { data: me } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', appt.tenant_id)
    .maybeSingle()
  if (!me || me.id !== appt.customer_id) {
    return { ok: false, error: 'Agendamento não é seu.' }
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('cancellation_window_hours')
    .eq('id', appt.tenant_id)
    .maybeSingle()

  const check = canTransition(appt.status, 'CANCELED', {
    actor: 'customer',
    now: new Date(),
    startAt: new Date(appt.start_at),
    endAt: new Date(appt.end_at),
    cancellationWindowHours: tenant?.cancellation_window_hours ?? 2,
  })
  if (!check.ok) return { ok: false, error: check.reason }

  const { error: updateErr } = await supabase
    .from('appointments')
    .update({
      status: 'CANCELED',
      canceled_at: new Date().toISOString(),
      canceled_by: user.id,
      cancel_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)

  if (updateErr) return { ok: false, error: 'Falha ao cancelar. Tente novamente.' }

  revalidatePath('/meus-agendamentos')
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/meus-agendamentos/actions.ts
git commit -m "feat(customer): action cancelCustomerAppointment com janela"
```

---

## Task 6: Botão "Cancelar" em /meus-agendamentos

**Files:**
- Modify: `src/app/meus-agendamentos/page.tsx`

- [ ] **Step 1: Ler o arquivo atual pra entender a estrutura**

```bash
cat src/app/meus-agendamentos/page.tsx
```

- [ ] **Step 2: Adicionar botão "Cancelar" em cada card elegível**

No componente que renderiza cada appointment card, antes do `</div>` do card, adicionar (respeitando a estrutura atual):

```tsx
{appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED' ? (
  <CancelAppointmentButton
    appointmentId={appointment.id}
    startAt={appointment.startAt}
    cancellationWindowHours={cancellationWindowHours}
  />
) : null}
```

Criar componente cliente `src/app/meus-agendamentos/cancel-button.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Alert } from '@/components/ui/alert'
import { cancelCustomerAppointment } from './actions'

export function CancelAppointmentButton({
  appointmentId,
  startAt,
  cancellationWindowHours,
}: {
  appointmentId: string
  startAt: string
  cancellationWindowHours: number
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cutoffMs = new Date(startAt).getTime() - cancellationWindowHours * 60 * 60 * 1000
  const canStillCancel = Date.now() <= cutoffMs
  if (!canStillCancel) return null

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await cancelCustomerAppointment({ appointmentId })
      if (result.ok) {
        setOpen(false)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[0.8125rem] text-fg-muted underline-offset-4 hover:text-error hover:underline"
      >
        Cancelar
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Cancelar agendamento?"
        description="Essa ação não pode ser desfeita."
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            fullWidth
            loading={pending}
            onClick={handleConfirm}
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}
```

- [ ] **Step 3: Incluir `cancellation_window_hours` no tenant context**

Modificar `src/lib/tenant/context.ts`:
- Adicionar `cancellationWindowHours: number` no type `TenantContext`
- No select: `..., cancellation_window_hours`
- No return: `cancellationWindowHours: data.cancellation_window_hours`

- [ ] **Step 4: Passar a janela do tenant pro componente**

Na page.tsx de `/meus-agendamentos`, ler `cancellationWindowHours` do tenant (via `getCurrentTenantOrNotFound()` se já não é server component) e passar como prop.

- [ ] **Step 5: Testar manualmente**

```bash
pnpm dev
```

Abrir `http://barbearia-teste.lvh.me:3008/meus-agendamentos` logado como cliente com appointment futuro. Botão "Cancelar" deve aparecer. Clicar abre sheet. Confirmar cancela e atualiza a lista.

- [ ] **Step 6: Commit**

```bash
git add src/app/meus-agendamentos src/lib/tenant/context.ts
git commit -m "feat(customer): botão cancelar em /meus-agendamentos com janela"
```

---

## Task 7: Agenda live — dados e navegação de data

**Files:**
- Modify: `src/app/salon/(authenticated)/dashboard/agenda/page.tsx` (server)
- Create: `src/app/salon/(authenticated)/dashboard/agenda/agenda-view.tsx` (client)
- Create: `src/lib/appointments/queries.ts`

- [ ] **Step 1: Ler agenda/page.tsx atual**

```bash
cat src/app/salon/\(authenticated\)/dashboard/agenda/page.tsx
```

Identificar como ele resolve `tenant_id`, faz o fetch inicial e renderiza. Reaproveitar padrões.

- [ ] **Step 2: Criar helper de query**

Criar `src/lib/appointments/queries.ts`:

```ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type AgendaAppointment = {
  id: string
  startAt: string
  endAt: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW'
  customerName: string | null
  serviceName: string | null
  professionalName: string | null
  customerId: string | null
  professionalId: string | null
}

export async function getAgendaForDay(
  tenantId: string,
  dateISO: string, // 'YYYY-MM-DD' no tz do tenant
  tenantTimezone: string,
): Promise<AgendaAppointment[]> {
  // Constrói janela [dateISO 00:00 tz tenant, dateISO+1 00:00)
  const dayStart = new Date(`${dateISO}T00:00:00`).toLocaleString('sv-SE', { timeZone: tenantTimezone })
  const dayEnd = new Date(`${dateISO}T23:59:59`).toLocaleString('sv-SE', { timeZone: tenantTimezone })

  const supabase = await createClient()
  const { data } = await supabase
    .from('appointments')
    .select(`
      id, start_at, end_at, status, customer_id, professional_id,
      customer_name_snapshot,
      customer:customers(name),
      service:services(name),
      professional:professionals(name)
    `)
    .eq('tenant_id', tenantId)
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd)
    .order('start_at', { ascending: true })

  return (data ?? []).map((a) => ({
    id: a.id,
    startAt: a.start_at,
    endAt: a.end_at,
    status: a.status,
    customerName: a.customer?.name ?? a.customer_name_snapshot ?? null,
    serviceName: a.service?.name ?? null,
    professionalName: a.professional?.name ?? null,
    customerId: a.customer_id,
    professionalId: a.professional_id,
  }))
}
```

- [ ] **Step 3: Atualizar agenda/page.tsx (server component)**

Substituir conteúdo por server component que lê `?date=YYYY-MM-DD` (default hoje no tz do tenant), busca dados e delega pro client:

```tsx
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getAgendaForDay } from '@/lib/appointments/queries'
import { AgendaView } from './agenda-view'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const tenant = await getCurrentTenantOrNotFound()
  const params = await searchParams
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: tenant.timezone })
  const date = params.date ?? today
  const appointments = await getAgendaForDay(tenant.id, date, tenant.timezone)

  return (
    <AgendaView
      tenantId={tenant.id}
      timezone={tenant.timezone}
      initialDate={date}
      initialAppointments={appointments}
    />
  )
}
```

- [ ] **Step 4: Criar AgendaView (client) com navegação**

Criar `src/app/salon/(authenticated)/dashboard/agenda/agenda-view.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { AgendaAppointment } from '@/lib/appointments/queries'

type Props = {
  tenantId: string
  timezone: string
  initialDate: string // YYYY-MM-DD
  initialAppointments: AgendaAppointment[]
}

export function AgendaView({ tenantId, timezone, initialDate, initialAppointments }: Props) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initialAppointments)

  function shiftDay(delta: number) {
    const d = new Date(`${initialDate}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + delta)
    const next = d.toISOString().slice(0, 10)
    router.push(`/salon/dashboard/agenda?date=${next}`)
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-2 pb-4">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          aria-label="Dia anterior"
          className="rounded-md p-2 text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-fg-subtle">Agenda</p>
          <h1 className="font-display text-[1.25rem] font-semibold tracking-tight text-fg">
            {new Date(`${initialDate}T12:00:00Z`).toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: 'long',
              timeZone: 'UTC',
            })}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => shiftDay(1)}
          aria-label="Próximo dia"
          className="rounded-md p-2 text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </header>

      <ul className="space-y-2">
        {appointments.length === 0 ? (
          <p className="py-16 text-center text-[0.9375rem] text-fg-muted">
            Nenhum agendamento nesse dia.
          </p>
        ) : (
          appointments.map((a) => <AppointmentRow key={a.id} appointment={a} timezone={timezone} />)
        )}
      </ul>
    </main>
  )
}

function AppointmentRow({
  appointment: a,
  timezone,
}: {
  appointment: AgendaAppointment
  timezone: string
}) {
  const time = new Date(a.startAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
  const color = statusColor(a.status)
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 ${color}`}
    >
      <time className="w-14 shrink-0 text-[0.9375rem] font-semibold tabular-nums text-fg">
        {time}
      </time>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-medium text-fg">
          {a.customerName ?? 'Cliente removido'}
        </p>
        <p className="truncate text-[0.8125rem] text-fg-muted">
          {a.serviceName} · {a.professionalName}
        </p>
      </div>
      <StatusBadge status={a.status} />
    </li>
  )
}

function StatusBadge({ status }: { status: AgendaAppointment['status'] }) {
  const label = {
    SCHEDULED: 'Agendado',
    CONFIRMED: 'Confirmado',
    COMPLETED: 'Concluído',
    CANCELED: 'Cancelado',
    NO_SHOW: 'Não compareceu',
  }[status]
  return (
    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[0.6875rem] font-medium text-fg-muted">
      {label}
    </span>
  )
}

function statusColor(status: AgendaAppointment['status']): string {
  switch (status) {
    case 'CONFIRMED':
      return 'border-l-4 border-l-success'
    case 'SCHEDULED':
      return 'border-l-4 border-l-warning'
    case 'COMPLETED':
      return 'border-l-4 border-l-brand-primary opacity-70'
    case 'CANCELED':
      return 'border-l-4 border-l-fg-subtle opacity-60'
    case 'NO_SHOW':
      return 'border-l-4 border-l-error'
  }
}
```

- [ ] **Step 5: Rodar typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: Testar manualmente**

```bash
pnpm dev
```

Acessar `http://barbearia-teste.lvh.me:3008/salon/dashboard/agenda` logado como staff. Navegação ‹ › muda a data via URL param. Appointments aparecem. Estados sem dados mostram mensagem vazia.

- [ ] **Step 7: Commit**

```bash
git add src/app/salon/\(authenticated\)/dashboard/agenda src/lib/appointments/queries.ts
git commit -m "feat(agenda): day-navigation + query helpers"
```

---

## Task 8: Bottom sheet de detalhes + ações de status

**Files:**
- Create: `src/app/salon/(authenticated)/dashboard/agenda/appointment-sheet.tsx`
- Modify: `src/app/salon/(authenticated)/dashboard/agenda/agenda-view.tsx`

- [ ] **Step 1: Criar AppointmentSheet**

Criar `src/app/salon/(authenticated)/dashboard/agenda/appointment-sheet.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Check, CheckCircle, LogOut, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Alert } from '@/components/ui/alert'
import { transitionAppointmentStatus } from '@/app/salon/(authenticated)/actions/appointment-status'
import type { AgendaAppointment } from '@/lib/appointments/queries'

type Action = { label: string; nextStatus: AgendaAppointment['status']; icon: JSX.Element; variant?: 'primary' | 'secondary' | 'destructive' }

export function AppointmentSheet({
  appointment,
  open,
  onClose,
  timezone,
}: {
  appointment: AgendaAppointment | null
  open: boolean
  onClose: () => void
  timezone: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!appointment) return null

  const actions = availableActions(appointment)
  const start = new Date(appointment.startAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  })

  function handleAction(nextStatus: AgendaAppointment['status']) {
    if (!appointment) return
    setError(null)
    startTransition(async () => {
      const result = await transitionAppointmentStatus({ appointmentId: appointment.id, nextStatus })
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Detalhes do agendamento" description={start}>
      <dl className="space-y-3 text-[0.9375rem] text-fg">
        <Row label="Cliente" value={appointment.customerName ?? 'Cliente removido'} />
        <Row label="Serviço" value={appointment.serviceName ?? '—'} />
        <Row label="Profissional" value={appointment.professionalName ?? '—'} />
      </dl>

      {error ? (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-6 grid gap-2">
          {actions.map((a) => (
            <Button
              key={a.nextStatus}
              type="button"
              variant={a.variant ?? 'primary'}
              size="lg"
              fullWidth
              loading={pending}
              onClick={() => handleAction(a.nextStatus)}
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </BottomSheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="truncate font-medium text-fg">{value}</dd>
    </div>
  )
}

function availableActions(a: AgendaAppointment): Action[] {
  const now = Date.now()
  const started = now >= new Date(a.startAt).getTime()
  const ended = now >= new Date(a.endAt).getTime()

  if (a.status === 'SCHEDULED') {
    const xs: Action[] = [
      { label: 'Confirmar', nextStatus: 'CONFIRMED', icon: <Check className="h-4 w-4" /> },
    ]
    if (started) xs.push({ label: 'Marcar não compareceu', nextStatus: 'NO_SHOW', icon: <X className="h-4 w-4" />, variant: 'destructive' })
    xs.push({ label: 'Cancelar', nextStatus: 'CANCELED', icon: <LogOut className="h-4 w-4" />, variant: 'secondary' })
    return xs
  }
  if (a.status === 'CONFIRMED') {
    const xs: Action[] = []
    if (ended) xs.push({ label: 'Marcar como concluído', nextStatus: 'COMPLETED', icon: <CheckCircle className="h-4 w-4" /> })
    if (started) xs.push({ label: 'Marcar não compareceu', nextStatus: 'NO_SHOW', icon: <X className="h-4 w-4" />, variant: 'destructive' })
    xs.push({ label: 'Cancelar', nextStatus: 'CANCELED', icon: <LogOut className="h-4 w-4" />, variant: 'secondary' })
    return xs
  }
  return []
}
```

- [ ] **Step 2: Integrar sheet na AgendaView**

Em `agenda-view.tsx`, adicionar estado do selecionado + integração:

```tsx
// no topo do arquivo
import { AppointmentSheet } from './appointment-sheet'

// dentro de AgendaView, adicionar state
const [selected, setSelected] = useState<AgendaAppointment | null>(null)

// no map de appointments, substituir AppointmentRow por button clicável:
<li key={a.id}>
  <button
    type="button"
    onClick={() => setSelected(a)}
    className="block w-full text-left"
  >
    <AppointmentRow appointment={a} timezone={timezone} />
  </button>
</li>

// antes de fechar </main>
<AppointmentSheet
  appointment={selected}
  open={Boolean(selected)}
  onClose={() => setSelected(null)}
  timezone={timezone}
/>
```

- [ ] **Step 3: Testar manualmente**

Abrir agenda, clicar num appointment → abre sheet. Clicar "Confirmar" → status muda → sheet fecha → lista atualiza (via revalidatePath).

- [ ] **Step 4: Commit**

```bash
git add src/app/salon/\(authenticated\)/dashboard/agenda
git commit -m "feat(agenda): bottom sheet com ações de status"
```

---

## Task 9: Supabase Realtime na agenda

**Files:**
- Modify: `src/app/salon/(authenticated)/dashboard/agenda/agenda-view.tsx`

- [ ] **Step 1: Subscribir em postgres_changes**

Adicionar em `agenda-view.tsx` um `useEffect` que assina Realtime e reconcilia o state local com mutações vindas do canal:

```tsx
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/browser'

// dentro de AgendaView
useEffect(() => {
  const supabase = createClient()
  const channel = supabase
    .channel(`agenda-${tenantId}-${initialDate}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `tenant_id=eq.${tenantId}`,
      },
      () => {
        // Simples: refaz o route (server re-busca)
        router.refresh()
      },
    )
    .subscribe()

  // Fallback polling: se Realtime falhar, refresca a cada 30s
  const interval = setInterval(() => {
    if (channel.state !== 'joined') router.refresh()
  }, 30_000)

  return () => {
    clearInterval(interval)
    supabase.removeChannel(channel)
  }
}, [tenantId, initialDate, router])
```

- [ ] **Step 2: Garantir que Realtime está habilitado na tabela**

Usar `mcp__supabase__execute_sql`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
```

(Se já estiver, o comando vai dar erro "already in publication" — seguro ignorar.)

- [ ] **Step 3: Testar com 2 janelas**

Abrir agenda em 1 janela. Em outra janela, criar/alterar appointment via SQL. Ver atualização automática na primeira.

- [ ] **Step 4: Commit**

```bash
git add src/app/salon/\(authenticated\)/dashboard/agenda/agenda-view.tsx
git commit -m "feat(agenda): realtime via postgres_changes + polling fallback"
```

---

## Task 10: UI de Bloqueios em /disponibilidade

**Files:**
- Modify: `src/app/salon/(authenticated)/dashboard/disponibilidade/page.tsx`
- Potentially: `src/app/salon/(authenticated)/dashboard/disponibilidade/actions.ts`

- [ ] **Step 1: Ler estado atual**

```bash
cat src/app/salon/\(authenticated\)/dashboard/disponibilidade/page.tsx
```

Confirmar se já tem tab de bloqueios. Se não tem, adicionar.

- [ ] **Step 2: Criar action createAvailabilityBlock**

Se ainda não existe, criar `src/app/salon/(authenticated)/dashboard/disponibilidade/actions.ts`:

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'

const Input = z.object({
  professionalId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(200).optional(),
})

export async function createAvailabilityBlock(raw: z.infer<typeof Input>) {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Input inválido.' }

  const user = await assertStaff()
  const supabase = await createClient()

  const { data: prof } = await supabase
    .from('professionals')
    .select('tenant_id')
    .eq('id', parsed.data.professionalId)
    .maybeSingle()
  if (!prof) return { ok: false as const, error: 'Profissional inválido.' }

  const { error } = await supabase.from('availability_blocks').insert({
    tenant_id: prof.tenant_id,
    professional_id: parsed.data.professionalId,
    start_at: parsed.data.startAt,
    end_at: parsed.data.endAt,
    reason: parsed.data.reason ?? null,
  })
  if (error) return { ok: false as const, error: 'Falha ao criar bloqueio.' }

  revalidatePath('/salon/dashboard/disponibilidade')
  return { ok: true as const }
}

export async function deleteAvailabilityBlock(blockId: string) {
  await assertStaff()
  const supabase = await createClient()
  const { error } = await supabase.from('availability_blocks').delete().eq('id', blockId)
  if (error) return { ok: false as const, error: 'Falha ao remover.' }
  revalidatePath('/salon/dashboard/disponibilidade')
  return { ok: true as const }
}
```

- [ ] **Step 3: Adicionar tab "Bloqueios" com lista + form**

Seguir o padrão das tabs existentes em `disponibilidade/page.tsx`. Lista os blocks (query `availability_blocks` do tenant, filtrando `start_at >= now() - interval '30 days'`), e um botão "+ Novo bloqueio" que abre sheet com form (profissional select, date+time início/fim, motivo opcional). Submit chama `createAvailabilityBlock`.

- [ ] **Step 4: Testar manualmente**

Criar um bloqueio. Ver aparecer na lista. Deletar. Ver sumir.

- [ ] **Step 5: Commit**

```bash
git add src/app/salon/\(authenticated\)/dashboard/disponibilidade
git commit -m "feat(disponibilidade): UI de availability_blocks"
```

---

## Task 11: Hardening do booking público (validação server-side)

**Files:**
- Modify: a server action que cria appointments (provavelmente em `src/app/book/confirmar/...` ou `src/lib/booking/...`)

- [ ] **Step 1: Localizar o action**

```bash
grep -rn "insert.*appointments\|from('appointments').insert" src/ --include='*.ts' --include='*.tsx'
```

- [ ] **Step 2: Chamar `validate_appointment_conflict` antes do INSERT**

No action, antes do insert, chamar:

```ts
const { data: ok } = await supabase.rpc('validate_appointment_conflict', {
  p_tenant_id: tenantId,
  p_professional_id: professionalId,
  p_start_at: startAt,
  p_end_at: endAt,
  p_exclude_id: null,
})
if (!ok) {
  return { ok: false, error: 'Esse horário não está mais disponível. Escolha outro.' }
}
```

Também gravar o snapshot do nome do cliente:

```ts
.insert({
  ...,
  customer_name_snapshot: customerName,
})
```

- [ ] **Step 3: Testar manualmente — conflito real**

Criar 2 agendamentos sobrepostos via fluxos paralelos (2 abas do navegador, mesmo horário) — o segundo deve receber erro amigável.

- [ ] **Step 4: Commit**

```bash
git add src/app/book src/lib
git commit -m "feat(book): validate_appointment_conflict no servidor + snapshot do nome"
```

---

## Task 12: LGPD — export e delete

**Files:**
- Create: `src/app/perfil/dados/route.ts`
- Create: `src/app/perfil/apagar-conta/actions.ts`
- Modify: `src/app/perfil/page.tsx`

- [ ] **Step 1: Route de export**

Criar `src/app/perfil/dados/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, phone, consent_given_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, start_at, end_at, status, service:services(name), professional:professionals(name)')
    .eq('customer_id', customer?.id ?? '')
    .order('start_at', { ascending: false })

  const payload = {
    exportedAt: new Date().toISOString(),
    customer,
    appointments: appointments ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
```

- [ ] **Step 2: Action de delete**

Criar `src/app/perfil/apagar-conta/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function deleteMyAccount() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Não autenticado.' }

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (customer) {
    await supabase
      .from('customers')
      .update({
        name: 'Cliente removido',
        email: null,
        phone: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', customer.id)

    await supabase
      .from('appointments')
      .update({ customer_name_snapshot: 'Cliente removido' })
      .eq('customer_id', customer.id)
  }

  await supabase.auth.signOut()
  redirect('/')
}
```

- [ ] **Step 3: Integrar na tela /perfil**

Em `src/app/perfil/page.tsx`, adicionar dois itens na área logada:

```tsx
import { deleteMyAccount } from './apagar-conta/actions'

// dentro do JSX logado:
<section className="mt-8 space-y-2">
  <a href="/perfil/dados" download>
    <Button variant="secondary" size="lg" fullWidth>
      <Download className="h-4 w-4" />
      Baixar meus dados
    </Button>
  </a>

  <DeleteAccountButton />
</section>
```

Criar componente client `src/app/perfil/delete-account-button.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { deleteMyAccount } from './apagar-conta/actions'

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handle() {
    setError(null)
    startTransition(async () => {
      const result = await deleteMyAccount()
      if (result && !result.ok) setError(result.error)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        fullWidth
        onClick={() => setOpen(true)}
        className="text-error hover:bg-error-bg hover:text-error"
      >
        <AlertTriangle className="h-4 w-4" />
        Apagar minha conta
      </Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Apagar minha conta?"
        description="Essa ação é irreversível. Seus dados pessoais serão anonimizados. Seus agendamentos continuam no histórico do salão, porém sem seu nome."
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="mt-2 space-y-3">
          <Input
            label='Digite "APAGAR" pra confirmar'
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              fullWidth
              disabled={confirm !== 'APAGAR'}
              loading={pending}
              onClick={handle}
            >
              Apagar
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
```

- [ ] **Step 4: Testar manualmente**

Logar como cliente. Baixar JSON → conteúdo correto. Apagar conta → redireciona pra `/` → logar de novo com mesmo email não recupera o nome.

- [ ] **Step 5: Commit**

```bash
git add src/app/perfil
git commit -m "feat(lgpd): export de dados + apagar conta com anonimização"
```

---

## Task 13: Consentimento LGPD + link de política

**Files:**
- Modify: `src/components/auth/customer-login-form.tsx`
- Create: `src/app/politica-de-privacidade/page.tsx` (placeholder)
- Modify: ação de `verifyCustomerOtp` ou quem trata o SIGNED_IN pra gravar `consent_given_at`

- [ ] **Step 1: Página placeholder de política**

Criar `src/app/politica-de-privacidade/page.tsx`:

```tsx
export default function PoliticaPrivacidade() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6">
      <h1 className="font-display text-[1.5rem] font-semibold tracking-tight text-fg">
        Política de Privacidade
      </h1>
      <p className="mt-4 text-[0.9375rem] text-fg-muted">
        Conteúdo em revisão. Em resumo: coletamos apenas os dados necessários pra
        gerenciar seus agendamentos. Você pode baixar ou apagar seus dados a
        qualquer momento em <a className="underline" href="/perfil">seu perfil</a>.
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Texto de consentimento no form de login**

Em `src/components/auth/customer-login-form.tsx`, adicionar abaixo do input de e-mail (antes do botão):

```tsx
<p className="text-[0.75rem] text-fg-subtle">
  Ao entrar, você concorda com nossa{' '}
  <a href="/politica-de-privacidade" className="underline">política de privacidade</a>.
</p>
```

- [ ] **Step 3: Registrar consent_given_at**

No `CustomerSessionSync`, quando um customer é criado/atualizado via SIGNED_IN:

```ts
// dentro do handle existing case após setSession
if (existing && !existing.consent_given_at) {
  await supabase.from('customers').update({ consent_given_at: new Date().toISOString() }).eq('id', existing.id)
}
// e no new case
.insert({ ..., consent_given_at: new Date().toISOString() })
```

(Adaptar pros campos reais do CustomerSessionSync — pode precisar de ajuste mínimo de schema.)

- [ ] **Step 4: Testar manualmente**

Logar com email novo → checar no banco: `select consent_given_at from customers where email='...';` — deve ter timestamp.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth src/app/politica-de-privacidade src/components/mock/customer-session-sync.tsx
git commit -m "feat(lgpd): consent timestamp + link da política"
```

---

## Task 14: Seed de availability pros tenants piloto

**Files:**
- Create: `scripts/seed-pilot-availability.ts`

- [ ] **Step 1: Script idempotente**

Criar `scripts/seed-pilot-availability.ts`:

```ts
/**
 * Seed idempotente de business_hours pros tenants piloto.
 * Roda: `pnpm tsx scripts/seed-pilot-availability.ts`
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('Faltando SUPABASE_URL ou SECRET_KEY')

const supabase = createClient<Database>(url, key)

const PILOT_SLUGS = ['barbearia-teste', 'bela-imagem']

const DEFAULT_HOURS = [
  { weekday: 0, isOpen: false }, // domingo
  { weekday: 1, isOpen: true, startTime: '09:00', endTime: '19:00' },
  { weekday: 2, isOpen: true, startTime: '09:00', endTime: '19:00' },
  { weekday: 3, isOpen: true, startTime: '09:00', endTime: '19:00' },
  { weekday: 4, isOpen: true, startTime: '09:00', endTime: '19:00' },
  { weekday: 5, isOpen: true, startTime: '09:00', endTime: '19:00' },
  { weekday: 6, isOpen: true, startTime: '08:00', endTime: '17:00' },
]

async function main() {
  for (const slug of PILOT_SLUGS) {
    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!tenant) {
      console.warn(`tenant ${slug} não encontrado, pulando`)
      continue
    }
    for (const h of DEFAULT_HOURS) {
      await supabase
        .from('business_hours')
        .upsert(
          {
            tenant_id: tenant.id,
            weekday: h.weekday,
            is_open: h.isOpen,
            start_time: h.isOpen ? h.startTime : '00:00',
            end_time: h.isOpen ? h.endTime : '00:00',
          },
          { onConflict: 'tenant_id,weekday' },
        )
    }
    console.log(`✓ seed de business_hours aplicado em ${slug}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Rodar**

```bash
pnpm tsx scripts/seed-pilot-availability.ts
```

- [ ] **Step 3: Confirmar via SQL**

Via MCP `execute_sql`:
```sql
SELECT tenant_id, weekday, is_open, start_time, end_time
  FROM business_hours
 WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('barbearia-teste','bela-imagem'))
 ORDER BY tenant_id, weekday;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-pilot-availability.ts
git commit -m "feat(seed): business_hours default pros tenants piloto"
```

---

## Task 15: Smoke test manual documentado

**Files:**
- Create: `docs/smoke-test-pilot.md`

- [ ] **Step 1: Escrever o checklist**

Criar `docs/smoke-test-pilot.md`:

```markdown
# Smoke test — Pilot Spec 1

Antes de liberar pilot real, rodar esse checklist em `bela-imagem.lvh.me:3008` (ou domínio de staging).

## Setup
- [ ] Tenant piloto existe e tem `business_hours` seed aplicado
- [ ] Ao menos 1 profissional ativo com `professional_availability` configurada
- [ ] Ao menos 1 serviço ativo ligado ao profissional (`professional_services`)

## Fluxo feliz
- [ ] Cliente agenda via wizard `/book` → cai em SCHEDULED
- [ ] Staff abre `/salon/dashboard/agenda` em outro browser → appointment aparece sem F5 (realtime)
- [ ] Staff clica no appointment → sheet abre → "Confirmar" → status vira CONFIRMED
- [ ] Cliente em `/meus-agendamentos` vê o status atualizado
- [ ] Cliente clica "Cancelar" (se dentro da janela) → confirma → status CANCELED
- [ ] Staff vê CANCELED em realtime

## Casos de borda
- [ ] Cliente tenta cancelar fora da janela → erro amigável
- [ ] Staff marca NO_SHOW antes do horário passar → erro
- [ ] Staff marca NO_SHOW depois do horário → sucesso
- [ ] Staff marca COMPLETED antes de end_at → erro
- [ ] Dois clientes tentam agendar o mesmo slot em paralelo → segundo recebe erro de conflito

## LGPD
- [ ] Cliente baixa JSON → arquivo válido com os próprios dados
- [ ] Cliente apaga conta → redireciona pra `/`
- [ ] Staff vê nome "Cliente removido" no histórico do cliente apagado
- [ ] Appointment não desaparece (histórico preservado)

## Agenda UX
- [ ] Navegar ‹ › muda o dia e re-busca
- [ ] Dia sem appointments mostra mensagem vazia
- [ ] Estados coloridos (amarelo/verde/cinza/vermelho) funcionam conforme status
```

- [ ] **Step 2: Commit**

```bash
git add docs/smoke-test-pilot.md
git commit -m "docs: smoke test pilot Spec 1"
```

---

## Self-review notes

Cobertura do spec:
- ✅ Schema changes → Task 1
- ✅ `validate_appointment_conflict` → Task 2
- ✅ Status machine rules → Task 3
- ✅ Server action staff transitions → Task 4
- ✅ Cancel cliente → Tasks 5, 6
- ✅ Agenda live + realtime → Tasks 7, 8, 9
- ✅ Availability blocks UI → Task 10 (business_hours e professional_availability já existem; confirmar completo manualmente)
- ✅ Booking hardening → Task 11
- ✅ LGPD (export + delete) → Task 12
- ✅ Consent + política → Task 13
- ✅ Seed piloto → Task 14
- ✅ Smoke test → Task 15

Assumptions a validar durante execução:
- `business_hours`, `professional_availability`, `professional_services` e parts de `disponibilidade/page.tsx` já funcionam — confirmar em Task 10 antes de adicionar bloqueios
- `assertStaff` é o helper padrão — se o nome exato diferir, adaptar
- RLS em `appointments` cobre UPDATE pra staff do próprio tenant — se não, acrescentar policy no Task 4 (detectar com erro no teste manual)
