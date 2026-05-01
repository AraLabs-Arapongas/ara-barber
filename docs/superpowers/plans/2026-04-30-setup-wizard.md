# Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wizard guiado de setup pós-criação de tenant cobrindo o mínimo viável pra agenda funcionar (horários, serviços, profissionais, vínculos), bloqueante na 1ª sessão e com banner persistente após "saída" até concluir.

**Architecture:** Migration adiciona `tenants.onboarding_completed_at` + `onboarding_step`. Route group novo `src/app/admin/setup/*` com layout próprio (sem sidebar do dashboard). Cada step é uma rota com server action (Zod + delete-then-insert + advance step). Layout `(authenticated)/layout.tsx` ganha gate que redireciona pra `/admin/setup` quando incompleto + cookie `ara_setup_dismissed` ausente. Banner persistente quando dismissed. Conclusão dispara redirect pra `/admin/dashboard?welcome=1` com toast "Compartilhe link".

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Zod, Supabase (`@supabase/ssr`), Vitest. UI components em `@/components/ui/*`. Audit via `recordAudit()` de `@/lib/audit/log`.

**Working directory:** `/Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard` (worktree, branch `feat/setup-wizard`).

**Spec base:** `docs/superpowers/specs/2026-04-30-setup-wizard-design.md`.

---

## File Structure

```
supabase/migrations/0032_tenant_onboarding.sql                     [NEW]

src/app/admin/setup/                                                [NEW route group]
  layout.tsx                                                        [NEW — full-screen, sem sidebar]
  page.tsx                                                          [NEW — server: lê step e redirect]
  horarios/page.tsx                                                 [NEW]
  horarios/form.tsx                                                 [NEW client]
  servicos/page.tsx                                                 [NEW]
  servicos/form.tsx                                                 [NEW client]
  profissionais/page.tsx                                            [NEW]
  profissionais/form.tsx                                            [NEW client]
  vinculos/page.tsx                                                 [NEW]
  vinculos/form.tsx                                                 [NEW client]
  _components/
    progress-indicator.tsx                                          [NEW]
    wizard-footer.tsx                                               [NEW client]

src/app/admin/(authenticated)/layout.tsx                            [MODIFY — gate + banner]
src/app/admin/(authenticated)/dashboard/(home)/page.tsx             [MODIFY — welcome toast]

src/lib/onboarding/
  derivations.ts                                                    [NEW puro]
  queries.ts                                                        [NEW server-only]
  actions.ts                                                        [NEW 5 server actions]

src/components/dashboard/onboarding-banner.tsx                      [NEW]
src/components/dashboard/welcome-toast.tsx                          [NEW client]

src/lib/supabase/types.ts                                           [REGENERAR após migration]

tests/unit/lib/onboarding/derivations.test.ts                       [NEW]
tests/unit/lib/onboarding/actions-schemas.test.ts                   [NEW]

docs/smoke-test-pilot.md                                            [MODIFY — seção wizard]
```

---

## Task 1: Migration — schema + backfill

**Files:**
- Create: `supabase/migrations/0032_tenant_onboarding.sql`

- [ ] **Step 1: Criar migration SQL**

```sql
-- supabase/migrations/0032_tenant_onboarding.sql

-- Adiciona colunas pra rastrear progresso do setup wizard pós-criação de tenant.
alter table public.tenants
  add column onboarding_completed_at timestamptz null,
  add column onboarding_step text null
    check (
      onboarding_step is null
      or onboarding_step in ('hours','services','professionals','links')
    );

comment on column public.tenants.onboarding_completed_at is
  'Quando o setup wizard foi concluído. Null = ainda não completou.';
comment on column public.tenants.onboarding_step is
  'Próximo step pendente do wizard. Null = não iniciado ou já completou.';

-- Backfill: tenants existentes (já operacionais) NÃO devem cair no wizard.
-- Marca como concluído com data = created_at pra não disparar redirect/banner.
update public.tenants
set onboarding_completed_at = created_at
where created_at < now();
```

- [ ] **Step 2: Aplicar migration via Supabase MCP**

Use o tool `mcp__supabase__apply_migration` com nome `tenant_onboarding` e o SQL acima.

Expected: sucesso, sem erros. Confirma:

```sql
select id, slug, onboarding_completed_at from public.tenants order by created_at;
```

Todos os tenants existentes devem ter `onboarding_completed_at` preenchido.

- [ ] **Step 3: Regenerar tipos TS**

Use o tool `mcp__supabase__generate_typescript_types` e cole o output em `src/lib/supabase/types.ts` (sobrescreve o arquivo).

Validar:

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
grep -A2 "onboarding_completed_at\|onboarding_step" src/lib/supabase/types.ts | head -10
```

Expected: campos aparecem no Row/Insert/Update do tipo `tenants`.

- [ ] **Step 4: Verify**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck
```

Expected: PASS (a migration adicionou campos opcionais, código existente segue compilando).

- [ ] **Step 5: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add supabase/migrations/0032_tenant_onboarding.sql src/lib/supabase/types.ts
git commit -m "feat(onboarding): schema pra rastrear setup wizard

Adiciona tenants.onboarding_completed_at + onboarding_step.
Backfill tenants existentes com onboarding_completed_at=created_at
(eles NÃO devem cair no wizard). Tenants novos nascem com null
e passam pelo wizard na primeira sessão do owner."
```

---

## Task 2: Derivations puras (TDD)

**Files:**
- Create: `src/lib/onboarding/derivations.ts`
- Create: `tests/unit/lib/onboarding/derivations.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/lib/onboarding/derivations.test.ts
import { describe, expect, it } from 'vitest'
import {
  resolveOnboardingState,
  nextStepPath,
  STEP_ORDER,
  type OnboardingTenantSnapshot,
} from '@/lib/onboarding/derivations'

const completed: OnboardingTenantSnapshot = {
  onboarding_completed_at: '2026-04-30T10:00:00Z',
  onboarding_step: null,
}
const fresh: OnboardingTenantSnapshot = {
  onboarding_completed_at: null,
  onboarding_step: null,
}
const midServices: OnboardingTenantSnapshot = {
  onboarding_completed_at: null,
  onboarding_step: 'services',
}

describe('resolveOnboardingState', () => {
  it('completed quando completed_at é não-null', () => {
    expect(resolveOnboardingState(completed)).toEqual({
      completed: true,
      currentStep: null,
      completedSteps: 4,
    })
  })
  it('fresh quando ambos null → currentStep=hours, 0 completos', () => {
    expect(resolveOnboardingState(fresh)).toEqual({
      completed: false,
      currentStep: 'hours',
      completedSteps: 0,
    })
  })
  it('mid-services → currentStep=services, 1 completo', () => {
    expect(resolveOnboardingState(midServices)).toEqual({
      completed: false,
      currentStep: 'services',
      completedSteps: 1,
    })
  })
  it('mid-links → 3 completos', () => {
    expect(
      resolveOnboardingState({ onboarding_completed_at: null, onboarding_step: 'links' }),
    ).toEqual({ completed: false, currentStep: 'links', completedSteps: 3 })
  })
})

describe('nextStepPath', () => {
  it('hours → /admin/setup/horarios', () => {
    expect(nextStepPath('hours')).toBe('/admin/setup/horarios')
  })
  it('services → /admin/setup/servicos', () => {
    expect(nextStepPath('services')).toBe('/admin/setup/servicos')
  })
  it('professionals → /admin/setup/profissionais', () => {
    expect(nextStepPath('professionals')).toBe('/admin/setup/profissionais')
  })
  it('links → /admin/setup/vinculos', () => {
    expect(nextStepPath('links')).toBe('/admin/setup/vinculos')
  })
  it('null → /admin/dashboard (já completou)', () => {
    expect(nextStepPath(null)).toBe('/admin/dashboard')
  })
})

describe('STEP_ORDER', () => {
  it('contém 4 steps na ordem certa', () => {
    expect(STEP_ORDER).toEqual(['hours', 'services', 'professionals', 'links'])
  })
})
```

- [ ] **Step 2: Confirmar fail**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm test --run tests/unit/lib/onboarding/derivations.test.ts
```

Expected: FAIL — module não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/onboarding/derivations.ts

export const STEP_ORDER = ['hours', 'services', 'professionals', 'links'] as const
export type OnboardingStep = (typeof STEP_ORDER)[number]

export type OnboardingTenantSnapshot = {
  onboarding_completed_at: string | null
  onboarding_step: OnboardingStep | string | null
}

export type OnboardingState = {
  completed: boolean
  currentStep: OnboardingStep | null
  completedSteps: number
}

const STEP_TO_PATH: Record<OnboardingStep, string> = {
  hours: '/admin/setup/horarios',
  services: '/admin/setup/servicos',
  professionals: '/admin/setup/profissionais',
  links: '/admin/setup/vinculos',
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return STEP_ORDER.includes(value as OnboardingStep)
}

export function resolveOnboardingState(
  snapshot: OnboardingTenantSnapshot,
): OnboardingState {
  if (snapshot.onboarding_completed_at) {
    return { completed: true, currentStep: null, completedSteps: STEP_ORDER.length }
  }
  const step = isOnboardingStep(snapshot.onboarding_step)
    ? snapshot.onboarding_step
    : 'hours'
  return {
    completed: false,
    currentStep: step,
    completedSteps: STEP_ORDER.indexOf(step),
  }
}

export function nextStepPath(step: OnboardingStep | null): string {
  if (step === null) return '/admin/dashboard'
  return STEP_TO_PATH[step]
}
```

- [ ] **Step 4: Confirmar pass**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm test --run tests/unit/lib/onboarding/derivations.test.ts
```

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/lib/onboarding/derivations.ts tests/unit/lib/onboarding/derivations.test.ts
git commit -m "feat(onboarding): derivations puras de estado do wizard

resolveOnboardingState, nextStepPath, STEP_ORDER. 11 testes
cobrindo completed, fresh, mid-step, e mapeamento step→URL."
```

---

## Task 3: Queries server-only

**Files:**
- Create: `src/lib/onboarding/queries.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/onboarding/queries.ts
import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import {
  resolveOnboardingState,
  type OnboardingState,
} from '@/lib/onboarding/derivations'

/**
 * Lê o estado do onboarding wizard pra um tenant.
 * Usa secret client porque é chamado do dashboard layout (RSC) onde
 * a sessão já foi validada por assertStaff — bypassa RLS pra evitar
 * roundtrip extra.
 */
export async function getOnboardingState(tenantId: string): Promise<OnboardingState> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('onboarding_completed_at, onboarding_step')
    .eq('id', tenantId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    // Tenant não existe — defensivo: retorna como completed pra não loop.
    return { completed: true, currentStep: null, completedSteps: 4 }
  }
  return resolveOnboardingState(data)
}
```

- [ ] **Step 2: Verify**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/lib/onboarding/queries.ts
git commit -m "feat(onboarding): query getOnboardingState

Lê snapshot do tenants e delega resolução pra derivations.
Server-only (secret client). Consumido pelo layout do dashboard."
```

---

## Task 4: Server actions — schemas (TDD)

**Files:**
- Create: `tests/unit/lib/onboarding/actions-schemas.test.ts`
- Create: `src/lib/onboarding/actions.ts` (apenas schemas + export, implementação vem na Task 5)

- [ ] **Step 1: Failing test pros schemas**

```ts
// tests/unit/lib/onboarding/actions-schemas.test.ts
import { describe, expect, it } from 'vitest'
import {
  BusinessHoursStepSchema,
  ServicesStepSchema,
  ProfessionalsStepSchema,
  LinksStepSchema,
} from '@/lib/onboarding/actions'

describe('BusinessHoursStepSchema', () => {
  it('aceita 7 dias válidos', () => {
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00',
      end_time: '18:00',
    }))
    expect(BusinessHoursStepSchema.safeParse({ days }).success).toBe(true)
  })
  it('rejeita quantidade != 7', () => {
    expect(BusinessHoursStepSchema.safeParse({ days: [] }).success).toBe(false)
  })
  it('rejeita start_time >= end_time quando aberto', () => {
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_open: true,
      start_time: '18:00',
      end_time: '09:00',
    }))
    expect(BusinessHoursStepSchema.safeParse({ days }).success).toBe(false)
  })
  it('aceita start_time >= end_time quando fechado', () => {
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_open: false,
      start_time: '00:00',
      end_time: '00:00',
    }))
    expect(BusinessHoursStepSchema.safeParse({ days }).success).toBe(true)
  })
})

describe('ServicesStepSchema', () => {
  it('aceita 1 serviço válido', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: 'Corte', duration_minutes: 30, price_cents: 5000 }],
      }).success,
    ).toBe(true)
  })
  it('rejeita 0 serviços', () => {
    expect(ServicesStepSchema.safeParse({ services: [] }).success).toBe(false)
  })
  it('rejeita duração 0 ou negativa', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: 'Corte', duration_minutes: 0, price_cents: 5000 }],
      }).success,
    ).toBe(false)
  })
  it('rejeita preço negativo', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: 'Corte', duration_minutes: 30, price_cents: -1 }],
      }).success,
    ).toBe(false)
  })
  it('rejeita nome vazio', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: '', duration_minutes: 30, price_cents: 5000 }],
      }).success,
    ).toBe(false)
  })
})

describe('ProfessionalsStepSchema', () => {
  it('aceita 1 profissional válido', () => {
    expect(
      ProfessionalsStepSchema.safeParse({ professionals: [{ name: 'João' }] }).success,
    ).toBe(true)
  })
  it('rejeita 0 profissionais', () => {
    expect(ProfessionalsStepSchema.safeParse({ professionals: [] }).success).toBe(false)
  })
  it('rejeita nome vazio', () => {
    expect(
      ProfessionalsStepSchema.safeParse({ professionals: [{ name: '' }] }).success,
    ).toBe(false)
  })
  it('rejeita nome > 80 chars', () => {
    expect(
      ProfessionalsStepSchema.safeParse({
        professionals: [{ name: 'a'.repeat(81) }],
      }).success,
    ).toBe(false)
  })
})

describe('LinksStepSchema', () => {
  it('aceita ≥1 vínculo', () => {
    expect(
      LinksStepSchema.safeParse({
        links: [
          {
            service_id: '00000000-0000-0000-0000-000000000001',
            professional_id: '00000000-0000-0000-0000-000000000002',
          },
        ],
      }).success,
    ).toBe(true)
  })
  it('rejeita 0 vínculos', () => {
    expect(LinksStepSchema.safeParse({ links: [] }).success).toBe(false)
  })
  it('rejeita uuid inválido', () => {
    expect(
      LinksStepSchema.safeParse({
        links: [{ service_id: 'not-uuid', professional_id: 'also-not' }],
      }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Confirmar fail**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm test --run tests/unit/lib/onboarding/actions-schemas.test.ts
```

Expected: FAIL — module não existe.

- [ ] **Step 3: Criar arquivo `actions.ts` com APENAS os schemas (placeholder no `'use server'` por enquanto)**

```ts
// src/lib/onboarding/actions.ts
'use server'

import { z } from 'zod'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const BusinessHourDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    start_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
    end_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
  })
  .refine(
    (d) => !d.is_open || d.start_time < d.end_time,
    { message: 'start_time deve ser menor que end_time quando aberto' },
  )

export const BusinessHoursStepSchema = z.object({
  days: z.array(BusinessHourDaySchema).length(7, 'Exatamente 7 dias'),
})

export const ServicesStepSchema = z.object({
  services: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(120),
        duration_minutes: z.coerce.number().int().positive('Duração > 0'),
        price_cents: z.coerce.number().int().nonnegative('Preço >= 0'),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 serviço'),
})

export const ProfessionalsStepSchema = z.object({
  professionals: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(80),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 profissional'),
})

export const LinksStepSchema = z.object({
  links: z
    .array(
      z.object({
        service_id: z.string().uuid(),
        professional_id: z.string().uuid(),
      }),
    )
    .min(1, 'Marque pelo menos 1 vínculo'),
})

// Server actions vêm na próxima task — schemas exportados primeiro.
```

- [ ] **Step 4: Confirmar pass**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm test --run tests/unit/lib/onboarding/actions-schemas.test.ts
```

Expected: PASS — 16 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/lib/onboarding/actions.ts tests/unit/lib/onboarding/actions-schemas.test.ts
git commit -m "feat(onboarding): schemas Zod dos 4 steps do wizard

BusinessHoursStepSchema, ServicesStepSchema,
ProfessionalsStepSchema, LinksStepSchema. 16 testes cobrindo
casos válidos e edge cases (vazio, formato, ranges)."
```

---

## Task 5: Server actions — implementação

**Files:**
- Modify: `src/lib/onboarding/actions.ts`

- [ ] **Step 1: Adicionar implementações ao actions.ts**

Substituir o conteúdo do arquivo (mantém schemas, adiciona handlers):

```ts
// src/lib/onboarding/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { assertStaff } from '@/lib/auth/guards'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createSecretClient } from '@/lib/supabase/secret'
import { recordAudit } from '@/lib/audit/log'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const BusinessHourDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    start_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
    end_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
  })
  .refine(
    (d) => !d.is_open || d.start_time < d.end_time,
    { message: 'start_time deve ser menor que end_time quando aberto' },
  )

export const BusinessHoursStepSchema = z.object({
  days: z.array(BusinessHourDaySchema).length(7, 'Exatamente 7 dias'),
})

export const ServicesStepSchema = z.object({
  services: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(120),
        duration_minutes: z.coerce.number().int().positive('Duração > 0'),
        price_cents: z.coerce.number().int().nonnegative('Preço >= 0'),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 serviço'),
})

export const ProfessionalsStepSchema = z.object({
  professionals: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(80),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 profissional'),
})

export const LinksStepSchema = z.object({
  links: z
    .array(
      z.object({
        service_id: z.string().uuid(),
        professional_id: z.string().uuid(),
      }),
    )
    .min(1, 'Marque pelo menos 1 vínculo'),
})

export type StepActionState = { error?: string }

/**
 * Parse formData[arrayName + '[]'] como JSON. Forms enviam um campo
 * `payload` (JSON) pra evitar serializar arrays via FormData primitivo.
 */
function parseJsonField<T>(formData: FormData): T {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') throw new Error('Campo payload ausente')
  return JSON.parse(raw) as T
}

async function ensureStaff() {
  const tenant = await getCurrentTenantOrNotFound()
  const user = await assertStaff({ expectedTenantId: tenant.id })
  return { tenant, user }
}

// ─── Step 1: business hours ───────────────────────────────────────────────

export async function saveBusinessHoursStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = BusinessHoursStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('business_hours')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('business_hours').insert(
    parsed.data.days.map((d) => ({
      tenant_id: tenant.id,
      weekday: d.weekday,
      is_open: d.is_open,
      start_time: `${d.start_time}:00`,
      end_time: `${d.end_time}:00`,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }

  await supabase
    .from('tenants')
    .update({ onboarding_step: 'services' })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.step.hours',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { days: parsed.data.days.length },
  })
  revalidatePath('/admin/setup')
  redirect('/admin/setup/servicos')
}

// ─── Step 2: services ─────────────────────────────────────────────────────

export async function saveServicesStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = ServicesStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('services')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('services').insert(
    parsed.data.services.map((s) => ({
      tenant_id: tenant.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_cents: s.price_cents,
      is_active: true,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }

  await supabase
    .from('tenants')
    .update({ onboarding_step: 'professionals' })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.step.services',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { count: parsed.data.services.length },
  })
  revalidatePath('/admin/setup')
  redirect('/admin/setup/profissionais')
}

// ─── Step 3: professionals ────────────────────────────────────────────────

export async function saveProfessionalsStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = ProfessionalsStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('professionals')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('professionals').insert(
    parsed.data.professionals.map((p) => ({
      tenant_id: tenant.id,
      name: p.name,
      is_active: true,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }

  await supabase
    .from('tenants')
    .update({ onboarding_step: 'links' })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.step.professionals',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { count: parsed.data.professionals.length },
  })
  revalidatePath('/admin/setup')
  redirect('/admin/setup/vinculos')
}

// ─── Step 4: links + complete ─────────────────────────────────────────────

export async function saveLinksStep(
  _prev: StepActionState,
  formData: FormData,
): Promise<StepActionState> {
  const { tenant, user } = await ensureStaff()
  let payload: unknown
  try {
    payload = parseJsonField(formData)
  } catch {
    return { error: 'Payload inválido' }
  }
  const parsed = LinksStepSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const supabase = createSecretClient()
  const { error: delErr } = await supabase
    .from('professional_services')
    .delete()
    .eq('tenant_id', tenant.id)
  if (delErr) return { error: `delete: ${delErr.message}` }
  const { error: insErr } = await supabase.from('professional_services').insert(
    parsed.data.links.map((l) => ({
      tenant_id: tenant.id,
      service_id: l.service_id,
      professional_id: l.professional_id,
    })),
  )
  if (insErr) return { error: `insert: ${insErr.message}` }

  await supabase
    .from('tenants')
    .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: null })
    .eq('id', tenant.id)
  await recordAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorRole: user.profile.role,
    action: 'onboarding.completed',
    entityType: 'tenant',
    entityId: tenant.id,
    changes: { links: parsed.data.links.length },
  })
  revalidatePath('/admin/setup')
  revalidatePath('/admin/dashboard')
  redirect('/admin/dashboard?welcome=1')
}

// ─── Dismiss ──────────────────────────────────────────────────────────────

export async function dismissWizardAction(): Promise<void> {
  await ensureStaff()
  const c = await cookies()
  c.set('ara_setup_dismissed', '1', {
    path: '/admin',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
  redirect('/admin/dashboard')
}
```

- [ ] **Step 2: Verify (schemas tests ainda passam)**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm test --run tests/unit/lib/onboarding/
pnpm typecheck
```

Expected: PASS em ambos.

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/lib/onboarding/actions.ts
git commit -m "feat(onboarding): server actions dos 4 steps + dismiss

Cada step: assertStaff + Zod parse + delete-then-insert no
escopo do tenant + advance onboarding_step + audit log.
saveLinksStep marca onboarding_completed_at e redireciona pra
dashboard com ?welcome=1. dismissWizardAction seta cookie 30d."
```

---

## Task 6: Componentes do wizard (progress + footer)

**Files:**
- Create: `src/app/admin/setup/_components/progress-indicator.tsx`
- Create: `src/app/admin/setup/_components/wizard-footer.tsx`

- [ ] **Step 1: Progress indicator (server)**

```tsx
// src/app/admin/setup/_components/progress-indicator.tsx
type Props = { current: 1 | 2 | 3 | 4 }

const TITLES: Record<Props['current'], string> = {
  1: 'Horários de funcionamento',
  2: 'Serviços',
  3: 'Profissionais',
  4: 'Quem faz o quê',
}

export function ProgressIndicator({ current }: Props) {
  const total = 4
  const pct = (current / total) * 100
  return (
    <div className="mb-8">
      <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        Etapa {current} de {total}
      </p>
      <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
        {TITLES[current]}
      </h1>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wizard footer (client)**

```tsx
// src/app/admin/setup/_components/wizard-footer.tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { dismissWizardAction } from '@/lib/onboarding/actions'

type Props = {
  backHref?: string
  canSubmit: boolean
  pending: boolean
  submitLabel?: string
}

export function WizardFooter({ backHref, canSubmit, pending, submitLabel = 'Continuar' }: Props) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <form action={dismissWizardAction}>
        <button
          type="submit"
          className="text-[0.75rem] text-fg-subtle hover:text-fg underline-offset-2 hover:underline"
        >
          Sair do wizard
        </button>
      </form>
      <div className="flex items-center gap-2">
        {backHref ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={backHref}>Voltar</Link>
          </Button>
        ) : null}
        <Button type="submit" form="step-form" disabled={!canSubmit || pending} size="sm">
          {pending ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
```

Expected: PASS.

Se `Button asChild` não existe (anteriormente vimos que não), substituir por `<Link>` direto com `buttonVariants({ variant: 'secondary', size: 'sm' })` aplicado ao className.

- [ ] **Step 4: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/app/admin/setup/_components/
git commit -m "feat(onboarding): componentes ProgressIndicator e WizardFooter

Indicator mostra 'Etapa N de 4' + título + barra. Footer tem
Voltar (opcional), Continuar (disabled enquanto inválido) e
Sair do wizard (dispara dismiss server action)."
```

---

## Task 7: Layout do wizard + entry redirect

**Files:**
- Create: `src/app/admin/setup/layout.tsx`
- Create: `src/app/admin/setup/page.tsx`

- [ ] **Step 1: Layout full-screen**

```tsx
// src/app/admin/setup/layout.tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { assertStaff, AuthError } from '@/lib/auth/guards'

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')
  const tenant = await getCurrentTenantOrNotFound()
  try {
    await assertStaff({ expectedTenantId: tenant.id })
  } catch (err) {
    if (err instanceof AuthError) redirect('/admin/login')
    throw err
  }
  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <div className="min-h-screen bg-bg text-fg">
        <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-12 sm:px-8">{children}</main>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Entry redirect**

```tsx
// src/app/admin/setup/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { nextStepPath } from '@/lib/onboarding/derivations'

export default async function SetupEntryPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  redirect(nextStepPath(state.currentStep))
}
```

- [ ] **Step 3: Verify**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/app/admin/setup/layout.tsx src/app/admin/setup/page.tsx
git commit -m "feat(onboarding): layout do wizard + entry redirect

Layout full-screen sem sidebar/bottom-nav, com auth guard padrão
do staff. Entry /admin/setup lê state e redireciona pro step
pendente (ou /admin/dashboard se completed)."
```

---

## Task 8: Step 1 — horários

**Files:**
- Create: `src/app/admin/setup/horarios/page.tsx`
- Create: `src/app/admin/setup/horarios/form.tsx`

- [ ] **Step 1: Page (server)**

```tsx
// src/app/admin/setup/horarios/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { HoursForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function HoursStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.completed) redirect('/admin/dashboard')

  // Pré-fill: horários atuais (se houver) ou defaults Seg-Sáb 9-18, Dom fechado.
  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('business_hours')
    .select('weekday, is_open, start_time, end_time')
    .eq('tenant_id', tenant.id)
    .order('weekday')

  const days = Array.from({ length: 7 }, (_, weekday) => {
    const found = existing?.find((e) => e.weekday === weekday)
    if (found) {
      return {
        weekday,
        is_open: found.is_open,
        start_time: found.start_time.slice(0, 5),
        end_time: found.end_time.slice(0, 5),
      }
    }
    return {
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00',
      end_time: '18:00',
    }
  })

  return (
    <>
      <ProgressIndicator current={1} />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Quando seu negócio fica aberto? Você pode ajustar depois em{' '}
        <span className="text-fg">Mais → Disponibilidade</span>.
      </p>
      <HoursForm initialDays={days} />
    </>
  )
}
```

- [ ] **Step 2: Form (client)**

```tsx
// src/app/admin/setup/horarios/form.tsx
'use client'

import { useActionState, useState, useMemo } from 'react'
import { saveBusinessHoursStep, type StepActionState } from '@/lib/onboarding/actions'
import { WizardFooter } from '../_components/wizard-footer'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

type Day = {
  weekday: number
  is_open: boolean
  start_time: string
  end_time: string
}

export function HoursForm({ initialDays }: { initialDays: Day[] }) {
  const [days, setDays] = useState<Day[]>(initialDays)
  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveBusinessHoursStep,
    {},
  )

  const isValid = useMemo(
    () =>
      days.every((d) => !d.is_open || d.start_time < d.end_time) &&
      days.some((d) => d.is_open),
    [days],
  )

  function update(weekday: number, patch: Partial<Day>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)))
  }

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input type="hidden" name="payload" value={JSON.stringify({ days })} />
        {days.map((d) => (
          <div
            key={d.weekday}
            className="flex items-center gap-3 rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5"
          >
            <span className="w-20 text-[0.875rem] font-medium text-fg">
              {WEEKDAYS[d.weekday]}
            </span>
            <label className="flex items-center gap-1.5 text-[0.8125rem] text-fg-muted">
              <input
                type="checkbox"
                checked={d.is_open}
                onChange={(e) => update(d.weekday, { is_open: e.target.checked })}
                className="h-4 w-4"
              />
              Aberto
            </label>
            <select
              value={d.start_time}
              onChange={(e) => update(d.weekday, { start_time: e.target.value })}
              disabled={!d.is_open}
              className="ml-auto rounded-md border border-border bg-bg px-2 py-1 text-[0.8125rem] disabled:opacity-40"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-fg-subtle">→</span>
            <select
              value={d.end_time}
              onChange={(e) => update(d.weekday, { end_time: e.target.value })}
              disabled={!d.is_open}
              className="rounded-md border border-border bg-bg px-2 py-1 text-[0.8125rem] disabled:opacity-40"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ))}
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter canSubmit={isValid} pending={pending} />
    </>
  )
}
```

- [ ] **Step 3: Verify**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/app/admin/setup/horarios/
git commit -m "feat(onboarding): step 1 — horários de funcionamento

Pré-fill com horários existentes (se houver) ou defaults Seg-Sáb
9-18 / Dom fechado. Validação client: cada dia aberto tem
start<end + pelo menos 1 dia aberto."
```

---

## Task 9: Step 2 — serviços

**Files:**
- Create: `src/app/admin/setup/servicos/page.tsx`
- Create: `src/app/admin/setup/servicos/form.tsx`

- [ ] **Step 1: Page (server)**

```tsx
// src/app/admin/setup/servicos/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { ServicesForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function ServicesStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('services')
    .select('name, duration_minutes, price_cents')
    .eq('tenant_id', tenant.id)
    .order('name')
  const initial = existing && existing.length > 0
    ? existing.map((s) => ({
        name: s.name,
        duration_minutes: s.duration_minutes,
        price_cents: s.price_cents,
      }))
    : [{ name: '', duration_minutes: 30, price_cents: 0 }]

  return (
    <>
      <ProgressIndicator current={2} />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        O que seu negócio oferece? Você pode adicionar mais depois em{' '}
        <span className="text-fg">Mais → Serviços</span>.
      </p>
      <ServicesForm initial={initial} />
    </>
  )
}
```

- [ ] **Step 2: Form (client)**

```tsx
// src/app/admin/setup/servicos/form.tsx
'use client'

import { useActionState, useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { saveServicesStep, type StepActionState } from '@/lib/onboarding/actions'
import { WizardFooter } from '../_components/wizard-footer'

type Row = { name: string; duration_minutes: number; price_cents: number }

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function ServicesForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial)
  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveServicesStep,
    {},
  )

  const isValid = useMemo(
    () =>
      rows.length >= 1 &&
      rows.every((r) => r.name.trim().length > 0 && r.duration_minutes > 0 && r.price_cents >= 0),
    [rows],
  )

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function add() {
    setRows((prev) => [...prev, { name: '', duration_minutes: 30, price_cents: 0 }])
  }
  function remove(idx: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({
            services: rows.map((r) => ({
              name: r.name.trim(),
              duration_minutes: r.duration_minutes,
              price_cents: r.price_cents,
            })),
          })}
        />
        {rows.map((r, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5"
          >
            <Input
              value={r.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Nome do serviço"
              className="h-9 flex-1"
            />
            <select
              value={r.duration_minutes}
              onChange={(e) => update(idx, { duration_minutes: Number(e.target.value) })}
              className="h-9 rounded-md border border-border bg-bg px-2 text-[0.8125rem]"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}min
                </option>
              ))}
            </select>
            <span className="text-[0.8125rem] text-fg-muted">R$</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={(r.price_cents / 100).toFixed(2)}
              onChange={(e) =>
                update(idx, { price_cents: Math.round(Number(e.target.value) * 100) })
              }
              className="h-9 w-24 text-right"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              disabled={rows.length === 1}
              className="rounded p-1 text-fg-muted hover:bg-bg-subtle disabled:opacity-30"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-[0.8125rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <Plus className="h-4 w-4" /> Adicionar serviço
        </button>
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/horarios"
        canSubmit={isValid}
        pending={pending}
      />
    </>
  )
}
```

- [ ] **Step 3: Verify**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add src/app/admin/setup/servicos/
git commit -m "feat(onboarding): step 2 — serviços

Lista inline com adicionar/remover. Cada row: nome, duração
(15-120min), preço em R$ (convertido pra cents). Pré-fill com
serviços existentes ou 1 row vazia."
```

---

## Task 10: Step 3 — profissionais

**Files:**
- Create: `src/app/admin/setup/profissionais/page.tsx`
- Create: `src/app/admin/setup/profissionais/form.tsx`

- [ ] **Step 1: Page (server)**

```tsx
// src/app/admin/setup/profissionais/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { ProfessionalsForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function ProfessionalsStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const { data: existing } = await supabase
    .from('professionals')
    .select('name')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name')
  const initial = existing && existing.length > 0
    ? existing.map((p) => ({ name: p.name }))
    : [{ name: '' }]

  return (
    <>
      <ProgressIndicator current={3} />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Quem atende? Pode adicionar mais depois em{' '}
        <span className="text-fg">Mais → Profissionais</span>.
      </p>
      <ProfessionalsForm initial={initial} />
    </>
  )
}
```

- [ ] **Step 2: Form (client)**

```tsx
// src/app/admin/setup/profissionais/form.tsx
'use client'

import { useActionState, useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { saveProfessionalsStep, type StepActionState } from '@/lib/onboarding/actions'
import { WizardFooter } from '../_components/wizard-footer'

type Row = { name: string }

export function ProfessionalsForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial)
  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveProfessionalsStep,
    {},
  )
  const isValid = useMemo(
    () => rows.length >= 1 && rows.every((r) => r.name.trim().length > 0),
    [rows],
  )

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({
            professionals: rows.map((r) => ({ name: r.name.trim() })),
          })}
        />
        {rows.map((r, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5"
          >
            <Input
              value={r.name}
              onChange={(e) =>
                setRows((prev) => prev.map((p, i) => (i === idx ? { name: e.target.value } : p)))
              }
              placeholder="Nome do profissional"
              className="h-9 flex-1"
            />
            <button
              type="button"
              onClick={() =>
                setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
              }
              disabled={rows.length === 1}
              className="rounded p-1 text-fg-muted hover:bg-bg-subtle disabled:opacity-30"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { name: '' }])}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-[0.8125rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <Plus className="h-4 w-4" /> Adicionar profissional
        </button>
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/servicos"
        canSubmit={isValid}
        pending={pending}
      />
    </>
  )
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
git add src/app/admin/setup/profissionais/
git commit -m "feat(onboarding): step 3 — profissionais

Lista inline (só nome). Pré-fill com profissionais ativos ou
1 row vazia. Vínculos com serviços vêm no step 4."
```

---

## Task 11: Step 4 — vínculos + completion

**Files:**
- Create: `src/app/admin/setup/vinculos/page.tsx`
- Create: `src/app/admin/setup/vinculos/form.tsx`

- [ ] **Step 1: Page (server)**

```tsx
// src/app/admin/setup/vinculos/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { LinksForm } from './form'
import { createSecretClient } from '@/lib/supabase/secret'

export default async function LinksStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (state.completed) redirect('/admin/dashboard')

  const supabase = createSecretClient()
  const [{ data: services }, { data: pros }, { data: existingLinks }] = await Promise.all([
    supabase.from('services').select('id, name').eq('tenant_id', tenant.id).order('name'),
    supabase
      .from('professionals')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('professional_services')
      .select('service_id, professional_id')
      .eq('tenant_id', tenant.id),
  ])

  // Edge case: faltou step anterior — empurra de volta.
  if (!services || services.length === 0) redirect('/admin/setup/servicos')
  if (!pros || pros.length === 0) redirect('/admin/setup/profissionais')

  return (
    <>
      <ProgressIndicator current={4} />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Marque quem atende cada serviço. Por padrão, todos atendem tudo.
      </p>
      <LinksForm
        services={services}
        professionals={pros}
        existingLinks={existingLinks ?? []}
      />
    </>
  )
}
```

- [ ] **Step 2: Form (client)**

```tsx
// src/app/admin/setup/vinculos/form.tsx
'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveLinksStep, type StepActionState } from '@/lib/onboarding/actions'
import { WizardFooter } from '../_components/wizard-footer'

type Service = { id: string; name: string }
type Professional = { id: string; name: string }
type Link = { service_id: string; professional_id: string }

export function LinksForm({
  services,
  professionals,
  existingLinks,
}: {
  services: Service[]
  professionals: Professional[]
  existingLinks: Link[]
}) {
  // Cria set de "service_id::professional_id" pra checked-state.
  // Default quando vazio: tudo marcado.
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (existingLinks.length > 0) {
      return new Set(existingLinks.map((l) => `${l.service_id}::${l.professional_id}`))
    }
    const all = new Set<string>()
    for (const s of services) for (const p of professionals) all.add(`${s.id}::${p.id}`)
    return all
  })

  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveLinksStep,
    {},
  )

  function toggle(serviceId: string, profId: string) {
    const key = `${serviceId}::${profId}`
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const links = useMemo<Link[]>(() => {
    return Array.from(checked).map((k) => {
      const [service_id, professional_id] = k.split('::')
      return { service_id, professional_id }
    })
  }, [checked])

  const isValid = links.length >= 1

  return (
    <>
      <form id="step-form" action={action}>
        <input type="hidden" name="payload" value={JSON.stringify({ links })} />
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[0.875rem]">
            <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Profissional</th>
                {services.map((s) => (
                  <th key={s.id} className="px-3 py-2 text-center font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {professionals.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium text-fg">{p.name}</td>
                  {services.map((s) => {
                    const key = `${s.id}::${p.id}`
                    return (
                      <td key={s.id} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked.has(key)}
                          onChange={() => toggle(s.id, p.id)}
                          className="h-4 w-4"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/profissionais"
        canSubmit={isValid}
        pending={pending}
        submitLabel="Concluir setup"
      />
    </>
  )
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
git add src/app/admin/setup/vinculos/
git commit -m "feat(onboarding): step 4 — vínculos serviço×profissional

Matriz checkbox; default todo marcado quando não há vínculos
existentes; pré-fill com vínculos atuais quando há. Submit
marca onboarding_completed_at e redirect /admin/dashboard?welcome=1."
```

---

## Task 12: Banner persistente no dashboard

**Files:**
- Create: `src/components/dashboard/onboarding-banner.tsx`
- Modify: `src/app/admin/(authenticated)/layout.tsx`

- [ ] **Step 1: Banner**

```tsx
// src/components/dashboard/onboarding-banner.tsx
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import type { OnboardingState } from '@/lib/onboarding/derivations'

export function OnboardingBanner({ state }: { state: OnboardingState }) {
  if (state.completed) return null
  return (
    <div className="border-b border-warning/30 bg-warning-bg/40">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-2.5 sm:px-8">
        <ListChecks className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="flex-1 text-[0.8125rem] text-fg">
          <span className="font-medium">Configure seu negócio</span> ·{' '}
          <span className="text-fg-muted">
            {state.completedSteps} de 4 etapas concluídas
          </span>
        </p>
        <Link
          href="/admin/setup"
          className="shrink-0 rounded-md bg-fg px-3 py-1 text-[0.75rem] font-medium text-bg hover:opacity-90"
        >
          Continuar setup →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modificar dashboard layout**

Substituir `src/app/admin/(authenticated)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { assertStaff, AuthError } from '@/lib/auth/guards'
import { BottomTabNav } from '@/components/nav/bottom-tab-nav'
import { GlobalFab } from '@/components/nav/global-fab'
import { OnboardingBanner } from '@/components/dashboard/onboarding-banner'
import { getOnboardingState } from '@/lib/onboarding/queries'

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')

  const tenant = await getCurrentTenantOrNotFound()

  try {
    await assertStaff({ expectedTenantId: tenant.id })
  } catch (err) {
    if (err instanceof AuthError) redirect('/admin/login')
    throw err
  }

  // Gate: tenant não completou onboarding e não dispensou o wizard → manda pro setup.
  const onboarding = await getOnboardingState(tenant.id)
  if (!onboarding.completed) {
    const dismissed = (await cookies()).get('ara_setup_dismissed')?.value === '1'
    if (!dismissed) redirect('/admin/setup')
  }

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <div className="min-h-screen bg-bg text-fg pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
        {!onboarding.completed ? <OnboardingBanner state={onboarding} /> : null}
        {children}
      </div>
      <GlobalFab />
      <BottomTabNav />
    </>
  )
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
git add src/components/dashboard/onboarding-banner.tsx 'src/app/admin/(authenticated)/layout.tsx'
git commit -m "feat(onboarding): gate + banner persistente no dashboard

Layout autenticado checa onboarding state. Não-completed +
sem cookie dismiss → redirect /admin/setup. Não-completed +
cookie → renderiza banner sticky no topo com 'X de 4 etapas'
e CTA de continuar setup."
```

---

## Task 13: Welcome toast pós-conclusão

**Files:**
- Create: `src/components/dashboard/welcome-toast.tsx`
- Modify: `src/app/admin/(authenticated)/dashboard/(home)/page.tsx`

- [ ] **Step 1: Toast component**

```tsx
// src/components/dashboard/welcome-toast.tsx
'use client'

import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function WelcomeToast({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="mb-4 border-brand-primary/30 bg-brand-primary/5">
      <CardContent className="flex items-start gap-3 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary text-[1rem]">
          🎉
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1rem] font-semibold text-fg">
            Pronto! Sua agenda tá no ar.
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
            Compartilhe seu link com clientes:
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
            <span className="flex-1 truncate text-[0.8125rem] font-mono text-fg">{url}</span>
            <button
              onClick={copy}
              className="shrink-0 rounded-md bg-brand-primary px-3 py-1 text-[0.75rem] font-medium text-bg hover:opacity-90"
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Copiado
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </span>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={() => setHidden(true)}
          className="shrink-0 rounded p-1 text-fg-muted hover:bg-bg-subtle"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Adicionar toast no top da home do dashboard**

Editar `src/app/admin/(authenticated)/dashboard/(home)/page.tsx`. Adicionar import:

```tsx
import { WelcomeToast } from '@/components/dashboard/welcome-toast'
import { getOnboardingState } from '@/lib/onboarding/queries'
```

Modificar a assinatura da função pra aceitar `searchParams`:

```tsx
export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const params = await searchParams
  const tenant = await getCurrentTenantOrNotFound()
  const onboarding = await getOnboardingState(tenant.id)
  const showWelcome = params.welcome === '1' && onboarding.completed
  // ... resto do código existente
```

E inserir o toast logo dentro do `<main>` no JSX:

```tsx
<main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
  {showWelcome ? (
    <WelcomeToast url={`https://${tenant.subdomain}.aralabs.com.br`} />
  ) : null}
  <RealtimeAppointmentsRefresh tenantId={tenant.id} channelKey="staff-home" />
  {/* ... */}
```

(Posicionado antes do `RealtimeAppointmentsRefresh` pra aparecer no topo absoluto.)

- [ ] **Step 3: Verify + commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck && pnpm lint
git add src/components/dashboard/welcome-toast.tsx 'src/app/admin/(authenticated)/dashboard/(home)/page.tsx'
git commit -m "feat(onboarding): welcome toast pós-conclusão

Card no topo da home consumindo ?welcome=1, mostra link público
com botão copy-to-clipboard, dismissível. Some no próximo
page-load (query param consumido)."
```

---

## Task 14: Smoke test + futuro.md

**Files:**
- Modify: `docs/smoke-test-pilot.md`
- Modify: `docs/futuro.md`

- [ ] **Step 1: Adicionar seção wizard no smoke**

Em `docs/smoke-test-pilot.md`, adicionar antes de `## 13. Smoke técnico`:

```md
## 12c. Setup wizard (tenant novo)

**Pré-condição:** criar tenant novo via admin platform (ou `pnpm provision-tenant`) com `onboarding_completed_at = null`. Logar com o owner pela primeira vez.

- [ ] Owner loga → cai automaticamente em `/admin/setup` (não no `/admin/dashboard`)
- [ ] Step 1 (horários): pré-fill Seg-Sáb 9-18, Dom fechado. Mudar Sábado pra fechado, salvar → cai no step 2
- [ ] Step 2 (serviços): adicionar 2 serviços (ex: "Corte" 30min R$50 + "Barba" 30min R$25), salvar → cai no step 3
- [ ] Step 3 (profissionais): adicionar 2 profissionais (ex: João, Maria), salvar → cai no step 4
- [ ] Step 4 (vínculos): matriz com tudo marcado por default; desmarcar João×Barba (Maria fica fazendo só barba); salvar → redirect pra `/admin/dashboard?welcome=1`
- [ ] Toast "Pronto! Sua agenda tá no ar." com botão Copiar → copia URL pública
- [ ] Navegar pra outra rota e voltar → toast some
- [ ] Acessar `<slug>.aralabs.com.br/book` (cliente) → consegue agendar com slots reais
- [ ] **Sair do wizard:** criar OUTRO tenant novo, logar, no step 2 clicar "Sair do wizard" → cai em `/admin/dashboard` com banner amarelo "Configure seu negócio · 1 de 4 etapas concluídas"
- [ ] Navegar pra `/admin/dashboard/agenda` → banner persiste
- [ ] Click "Continuar setup →" no banner → cai em `/admin/setup/servicos` (step 2, onde parou)
- [ ] Completar steps 2-4 → banner some após conclusão
- [ ] **Tenants antigos NÃO veem wizard:** logar com user de tenant existente (`barbearia-teste`, etc) → dashboard normal sem banner
```

- [ ] **Step 2: Atualizar futuro.md**

Em `docs/futuro.md`, adicionar entrada nova nas decisões tomadas (no topo):

```md
- **2026-04-30 — Setup wizard pós-criação de tenant.**
  Wizard guiado de 4 steps mínimos pra agenda funcionar:
  horários, serviços, profissionais, vínculos serviço×profissional.
  Bloqueante na primeira sessão (cookie `ara_setup_dismissed` 30d
  pra escape), banner persistente no dashboard até completar.
  Schema add: `tenants.onboarding_completed_at` +
  `onboarding_step`. Backfill na própria migration cuida dos
  tenants já operacionais. Pós-conclusão: redirect
  `/admin/dashboard?welcome=1` com toast "Compartilhe link" +
  copy-to-clipboard. Spec:
  `docs/superpowers/specs/2026-04-30-setup-wizard-design.md`.
  Plano:
  `docs/superpowers/plans/2026-04-30-setup-wizard.md`.
  Resolve item #1 da checklist pré-launch (ver entrada
  "Bloqueadores reais pro launch do piloto").
```

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git add docs/smoke-test-pilot.md docs/futuro.md
git commit -m "docs: smoke test + futuro.md cobrem setup wizard

Roteiro novo (12c) cobre tenant novo passando pelos 4 steps,
'sair do wizard' com banner persistente, e validação de que
tenants antigos NÃO veem o wizard."
```

---

## Verificação final

- [ ] **Step 1: Tudo verde**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
pnpm typecheck
pnpm lint
pnpm test --run
```

Todos devem passar.

- [ ] **Step 2: Push da branch**

```bash
cd /Users/thiagotavares/Projects/a-labs/tech/ara-agenda-setup-wizard
git push -u origin feat/setup-wizard
```

- [ ] **Step 3: Deixar pronto pra smoke do user**

Imprimir log dos commits + URL de smoke (dev) com instruções específicas.

---

## Fora do escopo deste plano

- **Cobrança/billing pós-piloto** (item #7 da checklist) — postergado até virar dor
- **Acordo de piloto** (item #4) — fora de código
- **Backup Supabase Pro tier** (item #3) — fora de código
- **Uptime monitor** (item #5) — fora de código
- **Trial 60d hardcoded** (item #6) — fora de escopo (provision-tenant atual já marca TRIALING)
- **Tutorial in-app, vídeo de boas-vindas, tour das telas** — explicitamente fora
- **Reabrir wizard após completar** — se quiser refazer, vai nas telas individuais
