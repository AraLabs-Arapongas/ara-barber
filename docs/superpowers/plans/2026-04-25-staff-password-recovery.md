> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# Staff Password Recovery + Resend SMTP Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir fluxo self-service de "Esqueci a senha" pra staff em `/salon/forgot-password` + `/salon/reset-password`, migrar Supabase Auth SMTP pra Resend, e customizar 3 templates de email PT-BR com nome do tenant via `user_metadata`.

**Architecture:** Server actions com Zod validation (match com `/salon/login/actions.ts`). Server components renderizam forms pra ter acesso ao tenant context (logo, theme injection). Code exchange via PKCE flow do Supabase (`exchangeCodeForSession`). SMTP via Resend (host `smtp.resend.com`, sender `no-reply@aralabs.com.br`). Templates Go com conditional `{{ if .Data.tenant_name }}` pra ramificar staff vs customer.

**Tech Stack:** Next.js 16 (server actions + server components), Supabase Auth (`@supabase/ssr`), Zod, React 19 (`useActionState`), Vitest + happy-dom (unit tests), Resend SMTP, Tailwind 4.

**Spec:** [docs/superpowers/specs/2026-04-25-staff-password-recovery-design.md](../specs/2026-04-25-staff-password-recovery-design.md)

---

## File Structure

**New code files:**
- `src/app/salon/forgot-password/page.tsx` — server component, tenant resolve + render form
- `src/app/salon/forgot-password/forgot-password-form.tsx` — client component, useActionState
- `src/app/salon/forgot-password/actions.ts` — server action: resetPasswordForEmail
- `src/app/salon/reset-password/page.tsx` — server component, code exchange + render form
- `src/app/salon/reset-password/reset-password-form.tsx` — client component
- `src/app/salon/reset-password/actions.ts` — server action: updateUser({ password })

**New test files:**
- `tests/unit/salon/forgot-password/actions.test.ts`
- `tests/unit/salon/reset-password/actions.test.ts`

**Modified docs:**
- `docs/smoke-test-pilot.md` — adicionar checklist do novo fluxo
- `docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md` — adicionar 3 tech debts

**External (Supabase Dashboard, no code):**
- SMTP configuration (Settings → Auth → SMTP Settings)
- 3 email templates (Settings → Auth → Email Templates)

**SQL one-shot (executed via MCP):**
- Backfill `auth.users.raw_user_meta_data.tenant_name` pro `thiago@aralabs.com.br`

---

## Phase 1 — Server actions + tests (TDD)

### Task 1: Forgot-password action — write failing test

**Files:**
- Create: `tests/unit/salon/forgot-password/actions.test.ts`

- [ ] **Step 1.1: Create test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { forgotPasswordAction, type ForgotPasswordState } from '@/app/salon/forgot-password/actions'
import * as supabaseServer from '@/lib/supabase/server'
import * as nextHeaders from 'next/headers'

vi.mock('@/lib/supabase/server')
vi.mock('next/headers')

const INITIAL: ForgotPasswordState = {}

function makeFormData(email: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  return fd
}

function mockSupabaseAuth(resetPasswordForEmail: ReturnType<typeof vi.fn>) {
  vi.mocked(supabaseServer.createClient).mockResolvedValue({
    auth: { resetPasswordForEmail },
  } as any)
}

function mockHeaders(host: string) {
  vi.mocked(nextHeaders.headers).mockResolvedValue({
    get: (key: string) => (key === 'x-ara-host' ? host : null),
  } as any)
}

describe('forgotPasswordAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejeita email com formato inválido', async () => {
    const result = await forgotPasswordAction(INITIAL, makeFormData('not-an-email'))
    expect(result.error).toBe('E-mail inválido.')
  })

  it('chama resetPasswordForEmail com redirectTo dinâmico baseado em x-ara-host', async () => {
    const reset = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseAuth(reset)
    mockHeaders('qa-aralabs.aralabs.com.br')

    const result = await forgotPasswordAction(INITIAL, makeFormData('user@example.com'))

    expect(reset).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://qa-aralabs.aralabs.com.br/salon/reset-password',
    })
    expect(result.ok).toBe(true)
  })

  it('retorna ok=true mesmo se Supabase devolver erro (anti-enumeration)', async () => {
    const reset = vi.fn().mockResolvedValue({
      error: { message: 'User not found' },
    })
    mockSupabaseAuth(reset)
    mockHeaders('qa-aralabs.aralabs.com.br')

    const result = await forgotPasswordAction(INITIAL, makeFormData('ghost@example.com'))

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('usa http em dev quando NODE_ENV !== production', async () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })

    const reset = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseAuth(reset)
    mockHeaders('qa-aralabs.lvh.me:3008')

    await forgotPasswordAction(INITIAL, makeFormData('user@example.com'))

    expect(reset).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://qa-aralabs.lvh.me:3008/salon/reset-password',
    })

    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })
})
```

- [ ] **Step 1.2: Run test, verify it fails**

```bash
pnpm test tests/unit/salon/forgot-password/actions.test.ts
```

Expected: FAIL — module `@/app/salon/forgot-password/actions` doesn't exist.

---

### Task 2: Forgot-password action — implementation

**Files:**
- Create: `src/app/salon/forgot-password/actions.ts`

- [ ] **Step 2.1: Implement action**

```ts
'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const forgotSchema = z.object({
  email: z.string().email(),
})

export type ForgotPasswordState = {
  ok?: boolean
  error?: string
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return { error: 'E-mail inválido.' }
  }

  const h = await headers()
  const host = h.get('x-ara-host') ?? 'localhost'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const redirectTo = `${protocol}://${host}/salon/reset-password`

  const supabase = await createClient()
  // Anti-enumeration: ignoramos o resultado. Sempre retornamos sucesso pra não
  // vazar se o email existe ou não. Supabase rate limita per-email automaticamente.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })

  return { ok: true }
}
```

- [ ] **Step 2.2: Run test, verify it passes**

```bash
pnpm test tests/unit/salon/forgot-password/actions.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 2.3: Commit**

```bash
git add tests/unit/salon/forgot-password/actions.test.ts src/app/salon/forgot-password/actions.ts
git commit -m "feat(salon-auth): forgot-password server action with anti-enumeration"
```

---

### Task 3: Reset-password action — write failing test

**Files:**
- Create: `tests/unit/salon/reset-password/actions.test.ts`

- [ ] **Step 3.1: Create test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetPasswordAction, type ResetPasswordState } from '@/app/salon/reset-password/actions'
import * as supabaseServer from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server')
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

const INITIAL: ResetPasswordState = {}

function makeFormData(password: string, confirm: string): FormData {
  const fd = new FormData()
  fd.set('password', password)
  fd.set('confirm', confirm)
  return fd
}

function mockSupabaseAuth(updateUser: ReturnType<typeof vi.fn>) {
  vi.mocked(supabaseServer.createClient).mockResolvedValue({
    auth: { updateUser },
  } as any)
}

describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejeita senha com menos de 8 caracteres', async () => {
    const result = await resetPasswordAction(INITIAL, makeFormData('short', 'short'))
    expect(result.error).toContain('Mínimo 8 caracteres')
  })

  it('rejeita quando confirmação não bate', async () => {
    const result = await resetPasswordAction(INITIAL, makeFormData('abcdefgh', 'abcdefgX'))
    expect(result.error).toContain('Senhas não conferem')
  })

  it('chama updateUser e redireciona pra /salon/dashboard em caso de sucesso', async () => {
    const update = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockSupabaseAuth(update)

    await expect(
      resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123')),
    ).rejects.toThrow('NEXT_REDIRECT:/salon/dashboard')

    expect(update).toHaveBeenCalledWith({ password: 'newpass123' })
  })

  it('retorna error quando updateUser falha', async () => {
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired' },
    })
    mockSupabaseAuth(update)

    const result = await resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123'))

    expect(result.error).toBe('Erro ao atualizar senha. Tente novamente.')
  })
})
```

- [ ] **Step 3.2: Run test, verify it fails**

```bash
pnpm test tests/unit/salon/reset-password/actions.test.ts
```

Expected: FAIL — module `@/app/salon/reset-password/actions` doesn't exist.

---

### Task 4: Reset-password action — implementation

**Files:**
- Create: `src/app/salon/reset-password/actions.ts`

- [ ] **Step 4.1: Implement action**

```ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const resetSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Senhas não conferem',
    path: ['confirm'],
  })

export type ResetPasswordState = {
  error?: string
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { error: firstIssue?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { error: 'Erro ao atualizar senha. Tente novamente.' }
  }

  redirect('/salon/dashboard')
}
```

- [ ] **Step 4.2: Run test, verify it passes**

```bash
pnpm test tests/unit/salon/reset-password/actions.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 4.3: Commit**

```bash
git add tests/unit/salon/reset-password/actions.test.ts src/app/salon/reset-password/actions.ts
git commit -m "feat(salon-auth): reset-password server action with Zod validation"
```

---

## Phase 2 — Forgot password UI

### Task 5: Forgot-password client form

**Files:**
- Create: `src/app/salon/forgot-password/forgot-password-form.tsx`

- [ ] **Step 5.1: Implement form**

```tsx
'use client'

import { useActionState } from 'react'
import { Mail, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { forgotPasswordAction, type ForgotPasswordState } from './actions'

const INITIAL: ForgotPasswordState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, INITIAL)

  if (state.ok) {
    return (
      <Alert variant="success" title="E-mail enviado">
        Se essa conta existe, enviamos um link pra redefinir a senha. Confira sua caixa de entrada (e o spam).
      </Alert>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <Input
        aria-label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@salao.com"
        leftIcon={<Mail className="h-4 w-4" />}
      />

      {state.error ? (
        <Alert variant="error" title="Não foi possível enviar">
          {state.error}
        </Alert>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Enviando..." className="mt-3">
        Enviar link de recuperação
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  )
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/app/salon/forgot-password/forgot-password-form.tsx
git commit -m "feat(salon-auth): forgot-password client form"
```

---

### Task 6: Forgot-password page (server component)

**Files:**
- Create: `src/app/salon/forgot-password/page.tsx`

- [ ] **Step 6.1: Implement page**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BarberStripeOrnament } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
import { getCurrentArea, getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ForgotPasswordForm } from './forgot-password-form'

export default async function SalonForgotPasswordPage() {
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />

      <main className="noise-overlay relative flex min-h-screen flex-col bg-bg">
        <div className="pointer-events-none absolute inset-0 hidden opacity-60 lg:block">
          <BarberStripeOrnament />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={72} />
              <div>
                <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
                  {tenant.name}
                </h1>
                <p className="mt-0.5 text-[0.75rem] uppercase tracking-[0.16em] text-fg-subtle">
                  Recuperar senha
                </p>
              </div>
            </div>

            <Card className="shadow-md">
              <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                  Esqueci a senha
                  <span className="text-brand-accent">.</span>
                </h2>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-fg-muted">
                  Enviaremos um link pro e-mail cadastrado.
                </p>
              </div>

              <div className="px-6 pb-6 sm:px-7 sm:pb-7">
                <ForgotPasswordForm />
              </div>
            </Card>

            <div className="mt-6 flex justify-center">
              <Link
                href="/salon/login"
                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar pro login
              </Link>
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex justify-center px-6 pt-10 pb-8">
          <AraLabsAttribution />
        </footer>
      </main>
    </>
  )
}
```

- [ ] **Step 6.2: Verify rota build**

```bash
pnpm build 2>&1 | grep -E "/salon/forgot-password|error"
```

Expected: linha tipo `├ ƒ /salon/forgot-password` (rota dinâmica registrada). Sem erros.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/salon/forgot-password/page.tsx
git commit -m "feat(salon-auth): forgot-password page with tenant branding"
```

---

## Phase 3 — Reset password UI

### Task 7: Reset-password client form

**Files:**
- Create: `src/app/salon/reset-password/reset-password-form.tsx`

- [ ] **Step 7.1: Implement form**

```tsx
'use client'

import { useActionState } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const INITIAL: ResetPasswordState = {}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL)

  return (
    <form action={formAction} className="space-y-3">
      <Input
        aria-label="Nova senha"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        leftIcon={<Lock className="h-4 w-4" />}
      />

      <Input
        aria-label="Confirmar senha"
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repita a senha"
        leftIcon={<Lock className="h-4 w-4" />}
      />

      {state.error ? (
        <Alert variant="error" title="Não foi possível atualizar">
          {state.error}
        </Alert>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Atualizando..." className="mt-3">
        Definir nova senha
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/app/salon/reset-password/reset-password-form.tsx
git commit -m "feat(salon-auth): reset-password client form"
```

---

### Task 8: Reset-password page (server component) with code exchange

**Files:**
- Create: `src/app/salon/reset-password/page.tsx`

- [ ] **Step 8.1: Implement page**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { BarberStripeOrnament } from '@/components/brand/logo'
import { AraLabsAttribution } from '@/components/brand/aralabs-attribution'
import { TenantLogo } from '@/components/branding/tenant-logo'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getCurrentArea, getCurrentTenantOrNotFound, type TenantContext } from '@/lib/tenant/context'
import { ResetPasswordForm } from './reset-password-form'

type SearchParams = Promise<{ code?: string }>

export default async function SalonResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const area = await getCurrentArea()
  if (area !== 'tenant') redirect('/')

  const tenant = await getCurrentTenantOrNotFound()
  const params = await searchParams
  const code = params.code

  if (!code) {
    return <ResetShell tenant={tenant} body={<InvalidLinkMessage reason="missing" />} />
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return <ResetShell tenant={tenant} body={<InvalidLinkMessage reason="expired" />} />
  }

  return <ResetShell tenant={tenant} body={<ResetPasswordForm />} />
}

function ResetShell({ tenant, body }: { tenant: TenantContext; body: React.ReactNode }) {
  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />

      <main className="noise-overlay relative flex min-h-screen flex-col bg-bg">
        <div className="pointer-events-none absolute inset-0 hidden opacity-60 lg:block">
          <BarberStripeOrnament />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={72} />
              <div>
                <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
                  {tenant.name}
                </h1>
                <p className="mt-0.5 text-[0.75rem] uppercase tracking-[0.16em] text-fg-subtle">
                  Redefinir senha
                </p>
              </div>
            </div>

            <Card className="shadow-md">
              <div className="px-6 pt-7 pb-4 sm:px-7 sm:pt-8">
                <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.75rem]">
                  Nova senha
                  <span className="text-brand-accent">.</span>
                </h2>
              </div>

              <div className="px-6 pb-6 sm:px-7 sm:pb-7">{body}</div>
            </Card>
          </div>
        </div>

        <footer className="relative z-10 flex justify-center px-6 pt-10 pb-8">
          <AraLabsAttribution />
        </footer>
      </main>
    </>
  )
}

function InvalidLinkMessage({ reason }: { reason: 'missing' | 'expired' }) {
  const title = reason === 'expired' ? 'Link expirado ou já usado' : 'Link inválido'
  const description =
    reason === 'expired'
      ? 'Esse link de recuperação não é mais válido. Solicite um novo email.'
      : 'O link parece estar incompleto. Solicite um novo email.'

  return (
    <div className="space-y-3">
      <Alert variant="warning" title={title} icon={<AlertCircle className="h-4 w-4" />}>
        {description}
      </Alert>
      <Button asChild size="lg" fullWidth>
        <Link href="/salon/forgot-password">Solicitar novo email</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 8.2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "salon/reset-password|error"
```

Expected: zero errors. Se aparecer erro de `Button asChild` ou prop diferente, ajustar pra match com os componentes UI atuais (rodar `cat src/components/ui/button.tsx | head -30` pra confirmar API).

- [ ] **Step 8.3: Verify rota build**

```bash
pnpm build 2>&1 | grep -E "/salon/reset-password|error"
```

Expected: `├ ƒ /salon/reset-password` registrada. Sem erros.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/salon/reset-password/page.tsx
git commit -m "feat(salon-auth): reset-password page with PKCE code exchange + error states"
```

---

## Phase 4 — Configuração externa (Supabase Dashboard + SQL)

### Task 9: SQL — backfill `user_metadata.tenant_name`

**Files:**
- Modify (via MCP `execute_sql`): `auth.users` row pra `thiago@aralabs.com.br`

- [ ] **Step 9.1: Executar SQL via MCP**

Roda via Supabase MCP `execute_sql`:

```sql
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('tenant_name', 'QA AraLabs')
where email = 'thiago@aralabs.com.br'
returning email, raw_user_meta_data;
```

Expected output: 1 row, `raw_user_meta_data` contém `{"tenant_name": "QA AraLabs"}`.

- [ ] **Step 9.2: Verificar via select**

```sql
select email, raw_user_meta_data->>'tenant_name' as tenant_name
from auth.users
where email = 'thiago@aralabs.com.br';
```

Expected: `tenant_name = 'QA AraLabs'`.

---

### Task 10: Supabase Dashboard — Migrar SMTP pra Resend

**Files:** Nenhum (config no Dashboard)

- [ ] **Step 10.1: Abrir Supabase Dashboard SMTP Settings**

URL: https://supabase.com/dashboard/project/jddttefvoqpolmhqwzuw/settings/auth

Scroll até **"SMTP Settings"** → toggle **"Enable Custom SMTP"**.

- [ ] **Step 10.2: Preencher campos**

| Campo | Valor |
|---|---|
| Sender email | `no-reply@aralabs.com.br` |
| Sender name | `AraLabs` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<Resend API key — pegar no password manager (rotacionada no BT-04)>` |
| Minimum interval | `60` |

→ **Save**.

- [ ] **Step 10.3: Verificar (opcional, manual)**

Ainda no Dashboard → Authentication → Users → click `thiago@aralabs.com.br` → **"Send password recovery"**. Email deve chegar via `no-reply@aralabs.com.br` (não `noreply@mail.app.supabase.io`).

> ⚠️ Nota: o link nesse email caiu em `aralabs.com.br` (Site URL broken), mas o sender já valida que SMTP migrou. Quando fizermos pelo app na Task 14, o link vai pra subdomain correto via `emailRedirectTo` dinâmico.

---

### Task 11: Supabase Dashboard — Customizar template "Reset Password"

**Files:** Nenhum (config no Dashboard)

- [ ] **Step 11.1: Abrir Email Templates**

URL: https://supabase.com/dashboard/project/jddttefvoqpolmhqwzuw/auth/templates

Selecionar **"Reset Password"**.

- [ ] **Step 11.2: Subject**

Cola exatamente:

```
{{ if .Data.tenant_name }}Redefinir senha — {{ .Data.tenant_name }}{{ else }}Redefinir senha — AraLabs{{ end }}
```

- [ ] **Step 11.3: Message body (HTML)**

Cola exatamente (substitui qualquer template existente):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redefinir senha</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f1e8;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:8px;max-width:600px;">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:600;color:#17343f;">Redefinir senha</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;font-size:16px;line-height:1.5;color:#333333;">
              {{ if .Data.tenant_name }}
                Recebemos um pedido pra redefinir a senha do seu acesso à <strong>{{ .Data.tenant_name }}</strong>. Click no botão abaixo. O link expira em 1 hora.
              {{ else }}
                Recebemos um pedido pra redefinir a senha da sua conta AraLabs. Click no botão abaixo. O link expira em 1 hora.
              {{ end }}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;background-color:#b9945a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:500;border-radius:6px;">Redefinir senha</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px 32px;font-size:14px;line-height:1.5;color:#666666;border-top:1px solid #f0f0f0;">
              Se o botão não funcionar, copie este link no navegador:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#b9945a;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;font-size:13px;line-height:1.5;color:#999999;">
              Se não foi você, ignore este email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

→ **Save changes**.

---

### Task 12: Supabase Dashboard — Customizar template "Magic Link"

**Files:** Nenhum (config no Dashboard)

- [ ] **Step 12.1: Selecionar "Magic Link" na mesma tela**

- [ ] **Step 12.2: Subject**

```
{{ if .Data.tenant_name }}Seu link de acesso — {{ .Data.tenant_name }}{{ else }}Seu link de acesso — AraLabs{{ end }}
```

- [ ] **Step 12.3: Message body (HTML)**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acessar</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f1e8;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:8px;max-width:600px;">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:600;color:#17343f;">Acessar</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;font-size:16px;line-height:1.5;color:#333333;">
              {{ if .Data.tenant_name }}
                Click no botão abaixo pra entrar no portal da <strong>{{ .Data.tenant_name }}</strong>. O link expira em 1 hora.
              {{ else }}
                Click no botão abaixo pra entrar. O link expira em 1 hora.
              {{ end }}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;background-color:#b9945a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:500;border-radius:6px;">Entrar agora</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px 32px;font-size:14px;line-height:1.5;color:#666666;border-top:1px solid #f0f0f0;">
              Se o botão não funcionar, copie este link no navegador:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#b9945a;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;font-size:13px;line-height:1.5;color:#999999;">
              Se não foi você, ignore este email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

→ **Save changes**.

---

### Task 13: Supabase Dashboard — Customizar template "Confirm Signup"

**Files:** Nenhum (config no Dashboard)

- [ ] **Step 13.1: Selecionar "Confirm Signup" na mesma tela**

- [ ] **Step 13.2: Subject**

```
Confirme seu email — AraLabs
```

(Sem condicional — confirm signup é sempre flow do customer no `/book/login`, sem tenant fixo.)

- [ ] **Step 13.3: Message body (HTML)**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirme seu email</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f1e8;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:8px;max-width:600px;">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:600;color:#17343f;">Bem-vindo</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;font-size:16px;line-height:1.5;color:#333333;">
              Confirme seu email pra continuar agendando.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;background-color:#b9945a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:500;border-radius:6px;">Confirmar email</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 16px 32px;font-size:14px;line-height:1.5;color:#666666;border-top:1px solid #f0f0f0;">
              Se o botão não funcionar, copie este link no navegador:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#b9945a;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;font-size:13px;line-height:1.5;color:#999999;">
              Se não foi você, ignore este email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

→ **Save changes**.

---

## Phase 5 — Smoke test em prod + documentação

### Task 14: Deploy + smoke test end-to-end

**Files:** Nenhum (validação em prod)

- [ ] **Step 14.1: Push pra main**

```bash
git push origin main
```

Vercel detecta + builda + deploy automático. Acompanha em https://vercel.com/dashboard → ara-agenda.

- [ ] **Step 14.2: Acessar /salon/login em prod**

URL: https://qa-aralabs.aralabs.com.br/salon/login

Verificar: link "Esqueci a senha" aparece e é clickable.

- [ ] **Step 14.3: Solicitar reset**

Click "Esqueci a senha" → preencher `thiago@aralabs.com.br` → submit. UI deve mostrar "Se essa conta existe, enviamos um link...".

- [ ] **Step 14.4: Verificar email recebido**

Inbox de `thiago@aralabs.com.br` (via Cloudflare Email Routing). Confirmar:
- [ ] Sender: `no-reply@aralabs.com.br` (NÃO `noreply@mail.app.supabase.io`)
- [ ] Subject: `Redefinir senha — QA AraLabs`
- [ ] Body menciona "QA AraLabs" em negrito
- [ ] Botão "Redefinir senha" visível e estilizado em accent (#b9945a)

- [ ] **Step 14.5: Click no botão do email**

Browser deve abrir em: `https://qa-aralabs.aralabs.com.br/salon/reset-password?code=<longo>`. Página renderiza form de nova senha com logo + nome do tenant.

- [ ] **Step 14.6: Testar validações**

- Tentar senha < 8 chars → erro "Mínimo 8 caracteres"
- Tentar senhas diferentes → erro "Senhas não conferem"

- [ ] **Step 14.7: Definir senha válida**

Digitar senha nova válida (ex: `Teste@2026!`) duas vezes → submit. Deve redirecionar pra `/salon/dashboard` já logado.

- [ ] **Step 14.8: Verificar login com nova senha**

- Logout (`/auth/logout` ou via UI)
- Voltar em `/salon/login`
- Logar com `thiago@aralabs.com.br` + senha nova → deve entrar.

- [ ] **Step 14.9: Testar link expirado**

- Voltar no email anterior (mesmo link já clicado)
- Click novamente → deve ir pra `/salon/reset-password?code=<mesmo>` mas página renderiza `<InvalidLinkMessage reason="expired" />` (one-time use)

---

### Task 15: Atualizar `docs/smoke-test-pilot.md`

**Files:**
- Modify: `docs/smoke-test-pilot.md`

- [ ] **Step 15.1: Ler estado atual**

```bash
cat docs/smoke-test-pilot.md | head -50
```

- [ ] **Step 15.2: Adicionar seção "Recuperação de senha (staff)"**

Adicionar em local apropriado (após seção de login do staff). Conteúdo:

```markdown
## Recuperação de senha (staff)

Validar fluxo self-service de "Esqueci a senha" em `/salon/*`.

### Passos

1. Em `https://<slug>.aralabs.com.br/salon/login`, click "Esqueci a senha"
2. Preencher email do staff cadastrado → submit
3. UI mostra "Se essa conta existe, enviamos um link..."
4. Verificar email recebido:
   - [ ] Sender: `no-reply@aralabs.com.br`
   - [ ] Subject: `Redefinir senha — <Nome do tenant>`
   - [ ] Body menciona o nome do tenant
5. Click no botão "Redefinir senha"
6. Página `/salon/reset-password` carrega com form
7. Tentar validações (< 8 chars, senhas diferentes) → erros inline
8. Definir senha válida → redirect `/salon/dashboard` logado
9. Logout → relogar com nova senha em `/salon/login` → ✓
10. Voltar pro link do email → click 2ª vez → "Link expirado ou já usado"

### Edge cases manuais

- Email não cadastrado: deve retornar mesma msg de sucesso (anti-enumeration)
- Acesso direto a `/salon/forgot-password` ou `/salon/reset-password` sem subdomain de tenant: redirect pra `/`
```

- [ ] **Step 15.3: Commit**

```bash
git add docs/smoke-test-pilot.md
git commit -m "docs(smoke-test): adicionar fluxo de recuperação de senha staff"
```

---

### Task 16: Adicionar tech debts ao Épico 10

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md`

- [ ] **Step 16.1: Adicionar 3 entradas ao "Índice de débitos"**

Adicionar antes da última linha da tabela:

```markdown
| 25 | Consertar Supabase Site URL global (Dashboard "Send recovery/magic link" caem em aralabs.com.br/storefront) | Sessão 2026-04-25 staff password recovery | Média (suporte interno) |
| 26 | Templates de email per-tenant (logo, cores, fonts próprios do salão) — exige custom email sender via Auth Hook + edge function | Sessão 2026-04-25 staff password recovery | Baixa (Fase 2) |
| 27 | Sync automático `tenants.name → user_metadata.tenant_name` em todos staff users do tenant (trigger SQL on update) | Sessão 2026-04-25 staff password recovery | Baixa |
| 28 | Migrar `tenant_name` de `user_metadata` (user-writable) pra `app_metadata` (service_role only) — checar se Supabase template syntax suporta `{{ .AppData }}` | Sessão 2026-04-25 staff password recovery | Baixa |
| 29 | Captcha em `/salon/forgot-password` antes de scale (>100 tenants) | Sessão 2026-04-25 staff password recovery | Baixa |
```

- [ ] **Step 16.2: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md
git commit -m "docs(epic-10): registrar 5 tech debts da staff password recovery"
```

---

## Phase 6 — Verificação final

### Task 17: Lint + typecheck + tests + push

**Files:** Nenhum

- [ ] **Step 17.1: Rodar suite local**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: tudo verde. Se algum erro, corrige antes de seguir.

- [ ] **Step 17.2: Push final (se houver commits não pushed)**

```bash
git status
git log origin/main..HEAD --oneline
git push origin main
```

- [ ] **Step 17.3: Re-validar smoke em prod**

Repetir Task 14 rapidamente — confirmar que push final não quebrou nada.


---

## Critério de sucesso

- [x] Spec aprovada e commitada (`5c97971`)
- [ ] 17 tasks acima completadas
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` verdes
- [ ] Smoke test E2E passou: email chegou via Resend, subject com nome do tenant, redefinição funcionou, login subsequente funcionou, link one-time-use validado
- [ ] `docs/smoke-test-pilot.md` atualizado
- [ ] 5 tech debts registrados no Épico 10

---

## Notas de implementação

**Sobre componentes UI:** se algum prop não bater (ex: `Button asChild`, `Alert icon`, `Input leftIcon`), abrir o arquivo em `src/components/ui/` correspondente e ajustar. Esses componentes podem ter evoluído.

**Sobre `useActionState`:** API React 19 (`react@19.2.4` confirmado em `package.json`). Mesma API usada em `src/app/salon/login/login-form.tsx:15`.

**Sobre PKCE flow:** Supabase CLI/SSR usa PKCE por default. `exchangeCodeForSession` é o método correto. Se aparecer erro `auth_code_expired` ou similar, verificar se `flowType: 'pkce'` está configurado no client em `src/lib/supabase/server.ts`.

**Sobre testes:** se `vi.mock('next/headers')` der problema (next-internal), usar approach alternativo: importar e re-exportar headers via wrapper testável em `src/lib/auth/...` e mock o wrapper.

**Sobre rollback:** ver §10 do spec. Resumindo: `git revert`, toggle SMTP no Dashboard, `update auth.users` removendo `tenant_name`.
