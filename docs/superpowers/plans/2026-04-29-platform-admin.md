# Platform Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer a UI do platform admin (cross-tenant) de volta pro repo `ara-agenda` em vez de esperar a implementação no `aralabs-storefront`. Admin vive em subdomínio dedicado `admin.aralabs.com.br` enquanto for produto único.

**Architecture:** Subdomínio `admin` resolve numa nova área `platform` no proxy → route group `(platform)` no Next.js. Todas as queries/mutations cross-tenant usam `createSecretClient()` (bypass RLS), gated por `assertPlatformAdmin()`. Auth via Supabase magic link (OTP), reaproveitando `getSessionUser`. Dashboard desktop-first (sidebar fixa + tabelas densas) — não é PWA, não é mobile-first.

**Tech Stack:** Next.js 16 (App Router, route groups), Supabase JS (`@supabase/ssr` + secret client), Zod (schemas de mutations), Vitest (unit tests), `@/components/ui/*` (Card/Button/Input já existentes).

---

## Decisões de design já fechadas

- **URL:** `admin.aralabs.com.br/{login,dashboard,tenants,plans,users,audit}`. Sem prefixo `/platform/` ou `/admin/` — subdomínio já carrega a semântica.
- **Layout:** desktop-first, sidebar fixa à esquerda, conteúdo `max-w-6xl`. Sem service worker, sem manifest, sem touch targets generosos. Tabelas densas (font-size 14px, padding compacto). Reusa `@/components/ui/*` existente.
- **Auth:** magic link via Supabase (`signInWithOtp`). Cookie de sessão tem `domain=.aralabs.com.br`, então login feito em `admin.aralabs.com.br` é independente do login em tenant subdomains.
- **Backend:** todas as queries usam `createSecretClient()` (bypass RLS). Guard `assertPlatformAdmin()` no layout `(platform)/(authenticated)/layout.tsx` checa `user_profiles.role = 'PLATFORM_ADMIN'`.
- **Criar tenant:** server action atomic que reusa a lógica do `scripts/provision-tenant.ts` (extrair pra módulo compartilhado).
- **Audit:** consome `audit_log` (já existe, criada migration 0028). Toda mutation de admin grava entrada via `recordAudit()` com `actorRole='PLATFORM_ADMIN'`.

---

## File Structure

```
src/
├── proxy.ts                                          # MODIFY: nova área 'platform'
├── lib/
│   ├── tenant/resolve.ts                             # MODIFY: ParsedHost ganha 'platform'
│   ├── auth/
│   │   ├── guards.ts                                 # MODIFY: + assertPlatformAdmin
│   │   └── platform-redirects.ts                     # NEW: helpers de redirect pós-login
│   └── platform/
│       ├── tenants.ts                                # NEW: queries e mutations cross-tenant
│       ├── provision.ts                              # NEW: extraído de scripts/provision-tenant.ts
│       ├── plans.ts                                  # NEW: queries/mutations de plans
│       ├── users.ts                                  # NEW: queries de user_profiles cross
│       ├── audit-query.ts                            # NEW: leitura paginada do audit_log
│       └── derivations.ts                            # NEW: agregações pro dashboard (MRR, counts)
└── app/
    ├── (platform)/                                   # NEW: route group, só responde em admin host
    │   ├── layout.tsx                                # NEW: HTML base, sem ThemeInjector
    │   ├── login/
    │   │   ├── page.tsx                              # NEW
    │   │   └── login-form.tsx                        # NEW: client component
    │   ├── auth/callback/route.ts                    # NEW: lida com link OTP
    │   └── (authenticated)/
    │       ├── layout.tsx                            # NEW: assertPlatformAdmin + sidebar
    │       ├── dashboard/page.tsx                    # NEW
    │       ├── tenants/
    │       │   ├── page.tsx                          # NEW: listagem
    │       │   ├── new/
    │       │   │   ├── page.tsx                      # NEW
    │       │   │   └── form.tsx                      # NEW: client form
    │       │   └── [id]/
    │       │       ├── page.tsx                      # NEW: detalhe + ações
    │       │       └── edit-forms.tsx                # NEW: branding/billing forms
    │       ├── plans/
    │       │   ├── page.tsx                          # NEW: tabela CRUD
    │       │   └── plan-form.tsx                     # NEW
    │       ├── users/page.tsx                        # NEW
    │       ├── audit/page.tsx                        # NEW
    │       └── actions.ts                            # NEW: server actions cross-tenant
    └── ...

scripts/provision-tenant.ts                           # MODIFY: importar de lib/platform/provision.ts

tests/unit/
├── lib/tenant/resolve-admin.test.ts                  # NEW
├── lib/platform/provision.test.ts                    # NEW
├── lib/platform/derivations.test.ts                  # NEW
└── ...
```

---

## Task 1: Proxy + resolver suportam área `platform`

**Files:**
- Modify: `src/lib/tenant/resolve.ts`
- Modify: `src/proxy.ts`
- Test: `tests/unit/lib/tenant/resolve-admin.test.ts`

- [ ] **Step 1: Write failing test pra subdomínio `admin`**

Crie `tests/unit/lib/tenant/resolve-admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseHostToSlug } from '@/lib/tenant/resolve'

describe('parseHostToSlug — admin subdomain', () => {
  it('admin.aralabs.com.br → area: platform', () => {
    expect(parseHostToSlug('admin.aralabs.com.br')).toEqual({ area: 'platform', slug: null })
  })

  it('admin.lvh.me com porta → area: platform', () => {
    expect(parseHostToSlug('admin.lvh.me:3008')).toEqual({ area: 'platform', slug: null })
  })

  it('barbearia-teste.aralabs.com.br continua tenant', () => {
    expect(parseHostToSlug('barbearia-teste.aralabs.com.br')).toEqual({
      area: 'tenant',
      slug: 'barbearia-teste',
    })
  })

  it('www continua sendo root, não platform', () => {
    expect(parseHostToSlug('www.aralabs.com.br')).toEqual({ area: 'root', slug: null })
  })
})
```

- [ ] **Step 2: Rodar e confirmar fail**

```bash
pnpm test tests/unit/lib/tenant/resolve-admin.test.ts
```

Expected: FAIL — area='root' atual, não 'platform'.

- [ ] **Step 3: Atualizar `ParsedHost` e `parseHostToSlug`**

Em `src/lib/tenant/resolve.ts`, substitua o tipo e a função:

```ts
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app'])
const PLATFORM_SUBDOMAIN = 'admin'

export type ParsedHost =
  | { area: 'tenant'; slug: string }
  | { area: 'platform'; slug: null }
  | { area: 'root'; slug: null }

export function parseHostToSlug(host: string): ParsedHost {
  const clean = host.split(':')[0].toLowerCase()

  for (const base of [APP_BASE_HOST, DEV_BASE_HOST]) {
    const suffix = `.${base}`
    if (clean.endsWith(suffix)) {
      const slug = clean.slice(0, -suffix.length)
      if (slug === PLATFORM_SUBDOMAIN) return { area: 'platform', slug: null }
      if (!SLUG_REGEX.test(slug)) return { area: 'root', slug: null }
      if (RESERVED_SUBDOMAINS.has(slug)) return { area: 'root', slug: null }
      return { area: 'tenant', slug }
    }
  }

  return { area: 'root', slug: null }
}
```

Remova o comentário antigo "`admin` pertence ao storefront" — agora é deste app.

- [ ] **Step 4: Rodar e confirmar pass**

```bash
pnpm test tests/unit/lib/tenant/resolve-admin.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Atualizar proxy pra propagar a área**

Em `src/proxy.ts`, o header `x-ara-area` já recebe o `parsed.area`. Não precisa mudança aqui — a refatoração do enum é suficiente. Mas confirme rodando o type check:

```bash
pnpm typecheck
```

Expected: PASS. Se houver `case 'tenant'` exhaustivo em algum lugar (ex: `src/lib/tenant/context.ts::getCurrentArea`), atualize pra incluir `'platform'`.

- [ ] **Step 6: Atualizar `getCurrentArea` se necessário**

Lê `src/lib/tenant/context.ts` e procure a função `getCurrentArea`. Se ela tem tipo de retorno `'tenant' | 'root'`, expanda pra incluir `'platform'`:

```ts
export async function getCurrentArea(): Promise<'tenant' | 'platform' | 'root'> {
  const h = await headers()
  const area = h.get('x-ara-area')
  if (area === 'tenant') return 'tenant'
  if (area === 'platform') return 'platform'
  return 'root'
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/tenant/resolve.ts src/lib/tenant/context.ts src/proxy.ts tests/unit/lib/tenant/resolve-admin.test.ts
git commit -m "feat(platform): subdomínio 'admin' resolve em nova área 'platform'

Era 'root' (porque admin morava em outro repo). Agora 'admin' é
área dedicada do platform admin; route group (platform) responde."
```

---

## Task 2: Guard `assertPlatformAdmin`

**Files:**
- Modify: `src/lib/auth/guards.ts`
- Test: `tests/unit/lib/auth/guards-platform.test.ts`

- [ ] **Step 1: Test failing**

Crie `tests/unit/lib/auth/guards-platform.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}))

import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import { getSessionUser } from '@/lib/auth/session'

const mocked = vi.mocked(getSessionUser)

describe('assertPlatformAdmin', () => {
  beforeEach(() => mocked.mockReset())

  it('throws UNAUTHORIZED quando não há user', async () => {
    mocked.mockResolvedValue(null)
    await expect(assertPlatformAdmin()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws UNAUTHORIZED quando user sem profile', async () => {
    mocked.mockResolvedValue({ id: 'u1', email: 'x@y.com', profile: null })
    await expect(assertPlatformAdmin()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN quando role não é PLATFORM_ADMIN', async () => {
    mocked.mockResolvedValue({
      id: 'u1', email: 'x@y.com',
      profile: { id: 'p1', name: 'X', role: 'BUSINESS_OWNER', tenantId: 't1' },
    })
    await expect(assertPlatformAdmin()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns user quando role é PLATFORM_ADMIN', async () => {
    const user = {
      id: 'u1', email: 'x@y.com',
      profile: { id: 'p1', name: 'X', role: 'PLATFORM_ADMIN' as const, tenantId: null },
    }
    mocked.mockResolvedValue(user)
    await expect(assertPlatformAdmin()).resolves.toEqual(user)
  })

  it('throws AuthError instance, não Error genérico', async () => {
    mocked.mockResolvedValue(null)
    await expect(assertPlatformAdmin()).rejects.toBeInstanceOf(AuthError)
  })
})
```

- [ ] **Step 2: Confirmar fail**

```bash
pnpm test tests/unit/lib/auth/guards-platform.test.ts
```

Expected: FAIL — `assertPlatformAdmin` não existe.

- [ ] **Step 3: Implementar guard**

Em `src/lib/auth/guards.ts`, adicione no final do arquivo:

```ts
import { isPlatformAdminRole } from '@/lib/auth/roles'

export async function assertPlatformAdmin(): Promise<AuthenticatedUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHORIZED')
  if (!user.profile) throw new AuthError('UNAUTHORIZED')
  if (!isPlatformAdminRole(user.profile.role)) throw new AuthError('FORBIDDEN')
  return user as AuthenticatedUser
}
```

- [ ] **Step 4: Confirmar pass**

```bash
pnpm test tests/unit/lib/auth/guards-platform.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/guards.ts tests/unit/lib/auth/guards-platform.test.ts
git commit -m "feat(platform): assertPlatformAdmin guard

Espelha assertStaff mas checa role=PLATFORM_ADMIN. Uso no
layout (platform)/(authenticated)."
```

---

## Task 3: Route group `(platform)` + layout base

**Files:**
- Create: `src/app/(platform)/layout.tsx`

- [ ] **Step 1: Criar layout HTML base**

Crie `src/app/(platform)/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '@/app/globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AraLabs Admin',
  robots: { index: false, follow: false },
}

export default function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg text-fg`}>
        {children}
      </body>
    </html>
  )
}
```

Diferenças vs root tenant layout: sem `ThemeInjector` (admin não tem branding por tenant), `robots noindex`, `dark` mode default no `<html>`.

- [ ] **Step 2: Type check**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/(platform)/layout.tsx
git commit -m "feat(platform): layout base do route group

Sem ThemeInjector (não tem branding por tenant), robots noindex,
dark mode default."
```

---

## Task 4: Login (magic link via Supabase)

**Files:**
- Create: `src/app/(platform)/login/page.tsx`
- Create: `src/app/(platform)/login/login-form.tsx`
- Create: `src/app/(platform)/auth/callback/route.ts`

- [ ] **Step 1: Página de login (server)**

Crie `src/app/(platform)/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentArea } from '@/lib/tenant/context'
import { getSessionUser } from '@/lib/auth/session'
import { isPlatformAdminRole } from '@/lib/auth/roles'
import { Card } from '@/components/ui/card'
import { LoginForm } from './login-form'

export default async function PlatformLoginPage() {
  const area = await getCurrentArea()
  if (area !== 'platform') redirect('/')

  const user = await getSessionUser()
  if (user?.profile && isPlatformAdminRole(user.profile.role)) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <Card className="w-full max-w-sm p-8">
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">AraLabs Admin</h1>
        <p className="mt-1 text-[0.8125rem] text-fg-muted">Entre com seu email institucional.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Form client component**

Crie `src/app/(platform)/login/login-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="text-[0.875rem] text-fg-muted">
        Enviamos um link de acesso pra <span className="font-medium text-fg">{email}</span>.
        Clique no link pra entrar.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        required
        autoFocus
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {errorMsg ? <p className="text-[0.8125rem] text-danger">{errorMsg}</p> : null}
      <Button type="submit" disabled={status === 'sending'} className="w-full">
        {status === 'sending' ? 'Enviando...' : 'Enviar link mágico'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Auth callback handler**

Crie `src/app/(platform)/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
```

- [ ] **Step 4: Type check + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Smoke manual**

```bash
pnpm dev
```

Abra `http://admin.lvh.me:3008/login`. Esperado: página renderiza com card "AraLabs Admin" + input email + botão. Não tente logar ainda (precisa do guard pra redirecionar pós-login).

- [ ] **Step 6: Commit**

```bash
git add src/app/(platform)/login src/app/(platform)/auth
git commit -m "feat(platform): login com magic link

Form client usa supabase.auth.signInWithOtp; callback troca o
code por sessão e redireciona pro /dashboard. shouldCreateUser:
false bloqueia signup público."
```

---

## Task 5: Layout autenticado com sidebar + guard

**Files:**
- Create: `src/app/(platform)/(authenticated)/layout.tsx`
- Create: `src/components/platform/sidebar.tsx`
- Create: `src/components/platform/user-menu.tsx`

- [ ] **Step 1: Layout com guard**

Crie `src/app/(platform)/(authenticated)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import { PlatformSidebar } from '@/components/platform/sidebar'
import { PlatformUserMenu } from '@/components/platform/user-menu'

export default async function PlatformAuthLayout({ children }: { children: React.ReactNode }) {
  let user
  try {
    user = await assertPlatformAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === 'UNAUTHORIZED') redirect('/login')
      // FORBIDDEN: usuário logado mas sem role correta. Volta pro login com mensagem.
      redirect('/login?error=forbidden')
    }
    throw err
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-bg-subtle">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="font-display text-[0.9375rem] font-semibold text-fg">
            AraLabs Admin
          </span>
        </div>
        <PlatformSidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-border px-6">
          <PlatformUserMenu name={user.profile.name} email={user.email ?? ''} />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Sidebar client component**

Crie `src/components/platform/sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Wallet, Users, FileText } from 'lucide-react'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenants', icon: Building2 },
  { href: '/plans', label: 'Plans', icon: Wallet },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/audit', label: 'Audit', icon: FileText },
] as const

export function PlatformSidebar() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.875rem] transition-colors ${
              active
                ? 'bg-bg text-fg font-medium'
                : 'text-fg-muted hover:bg-bg hover:text-fg'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: User menu (logout)**

Crie `src/components/platform/user-menu.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

export function PlatformUserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.875rem] text-fg hover:bg-bg-subtle"
      >
        <span className="font-medium">{name}</span>
        <span className="text-fg-muted">▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-bg shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[0.75rem] text-fg-muted">
            {email}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-[0.875rem] text-fg hover:bg-bg-subtle"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Type check + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(platform)/(authenticated)/layout.tsx src/components/platform/
git commit -m "feat(platform): layout autenticado com sidebar + guard

assertPlatformAdmin no layout server; sidebar fixa 224px com
links pra Dashboard/Tenants/Plans/Users/Audit; header com user
menu (logout)."
```

---

## Task 6: Derivações pro dashboard (MRR, counts)

**Files:**
- Create: `src/lib/platform/derivations.ts`
- Test: `tests/unit/lib/platform/derivations.test.ts`

- [ ] **Step 1: Test failing**

Crie `tests/unit/lib/platform/derivations.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  calculateMRR,
  countByStatus,
  filterTrialsExpiringWithinDays,
} from '@/lib/platform/derivations'

const sampleTenants = [
  { id: 't1', billing_status: 'ACTIVE', monthly_price_cents: 9900, status: 'ACTIVE', trial_ends_at: null },
  { id: 't2', billing_status: 'ACTIVE', monthly_price_cents: 19900, status: 'ACTIVE', trial_ends_at: null },
  { id: 't3', billing_status: 'TRIALING', monthly_price_cents: 9900, status: 'ACTIVE', trial_ends_at: '2026-05-03T00:00:00Z' },
  { id: 't4', billing_status: 'TRIALING', monthly_price_cents: 9900, status: 'ACTIVE', trial_ends_at: '2026-05-15T00:00:00Z' },
  { id: 't5', billing_status: 'SUSPENDED', monthly_price_cents: 9900, status: 'SUSPENDED', trial_ends_at: null },
] as const

describe('calculateMRR', () => {
  it('soma só billing_status=ACTIVE', () => {
    expect(calculateMRR(sampleTenants)).toBe(29800) // 9900 + 19900
  })

  it('retorna 0 quando lista vazia', () => {
    expect(calculateMRR([])).toBe(0)
  })

  it('ignora monthly_price_cents null', () => {
    expect(calculateMRR([{ id: 'x', billing_status: 'ACTIVE', monthly_price_cents: null, status: 'ACTIVE', trial_ends_at: null }])).toBe(0)
  })
})

describe('countByStatus', () => {
  it('agrupa por tenant.status', () => {
    expect(countByStatus(sampleTenants)).toEqual({ ACTIVE: 4, SUSPENDED: 1, ARCHIVED: 0 })
  })
})

describe('filterTrialsExpiringWithinDays', () => {
  it('retorna trials que vencem dentro da janela (referência fixa)', () => {
    const ref = new Date('2026-04-29T00:00:00Z')
    const result = filterTrialsExpiringWithinDays(sampleTenants, 7, ref)
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('inclui trials já vencidos (deadline passou)', () => {
    const ref = new Date('2026-05-04T00:00:00Z') // t3 venceu 2026-05-03
    const result = filterTrialsExpiringWithinDays(sampleTenants, 7, ref)
    expect(result.map((t) => t.id)).toContain('t3')
  })
})
```

- [ ] **Step 2: Confirmar fail**

```bash
pnpm test tests/unit/lib/platform/derivations.test.ts
```

Expected: FAIL — module não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/platform/derivations.ts`:

```ts
import type { Database } from '@/lib/supabase/types'

type TenantRow = {
  id: string
  status: Database['public']['Enums']['tenant_status']
  billing_status: Database['public']['Enums']['billing_status']
  monthly_price_cents: number | null
  trial_ends_at: string | null
}

export function calculateMRR(tenants: ReadonlyArray<TenantRow>): number {
  return tenants
    .filter((t) => t.billing_status === 'ACTIVE')
    .reduce((sum, t) => sum + (t.monthly_price_cents ?? 0), 0)
}

export function countByStatus(
  tenants: ReadonlyArray<TenantRow>,
): Record<Database['public']['Enums']['tenant_status'], number> {
  const init = { ACTIVE: 0, SUSPENDED: 0, ARCHIVED: 0 } as Record<
    Database['public']['Enums']['tenant_status'],
    number
  >
  for (const t of tenants) init[t.status] = (init[t.status] ?? 0) + 1
  return init
}

export function filterTrialsExpiringWithinDays(
  tenants: ReadonlyArray<TenantRow>,
  days: number,
  reference: Date = new Date(),
): TenantRow[] {
  const refMs = reference.getTime()
  const horizonMs = refMs + days * 24 * 60 * 60 * 1000
  return tenants.filter((t) => {
    if (t.billing_status !== 'TRIALING' || !t.trial_ends_at) return false
    const expiresMs = new Date(t.trial_ends_at).getTime()
    return expiresMs <= horizonMs
  })
}
```

- [ ] **Step 4: Confirmar pass**

```bash
pnpm test tests/unit/lib/platform/derivations.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform/derivations.ts tests/unit/lib/platform/derivations.test.ts
git commit -m "feat(platform): derivations puras (MRR, counts, trials expirando)

Funções stateless testáveis. Page do dashboard consome."
```

---

## Task 7: Queries cross-tenant (lib/platform/tenants.ts)

**Files:**
- Create: `src/lib/platform/tenants.ts`

- [ ] **Step 1: Implementar queries**

Crie `src/lib/platform/tenants.ts`:

```ts
import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AdminTenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  | 'id' | 'slug' | 'name' | 'subdomain' | 'status' | 'billing_status'
  | 'plan_id' | 'monthly_price_cents' | 'trial_ends_at' | 'created_at'
  | 'primary_color' | 'secondary_color' | 'accent_color'
  | 'logo_url' | 'favicon_url'
>

export async function listAllTenants(): Promise<AdminTenantRow[]> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id, slug, name, subdomain, status, billing_status, plan_id, monthly_price_cents, trial_ends_at, created_at, primary_color, secondary_color, accent_color, logo_url, favicon_url',
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getTenantById(id: string): Promise<AdminTenantRow | null> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id, slug, name, subdomain, status, billing_status, plan_id, monthly_price_cents, trial_ends_at, created_at, primary_color, secondary_color, accent_color, logo_url, favicon_url',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}
```

- [ ] **Step 2: Type check**

```bash
pnpm typecheck
```

Expected: PASS. Se algum field não existir no schema TS gerado, ajuste.

- [ ] **Step 3: Commit**

```bash
git add src/lib/platform/tenants.ts
git commit -m "feat(platform): queries cross-tenant via secret client

listAllTenants, getTenantById. Bypassa RLS — só chamado dentro
de (platform)/(authenticated) atrás do guard."
```

---

## Task 8: Dashboard page

**Files:**
- Create: `src/app/(platform)/(authenticated)/dashboard/page.tsx`

- [ ] **Step 1: Implementar page**

Crie `src/app/(platform)/(authenticated)/dashboard/page.tsx`:

```tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { listAllTenants } from '@/lib/platform/tenants'
import { calculateMRR, countByStatus, filterTrialsExpiringWithinDays } from '@/lib/platform/derivations'
import { formatCentsToBrl } from '@/lib/money'

export default async function PlatformDashboard() {
  const tenants = await listAllTenants()
  const mrr = calculateMRR(tenants)
  const byStatus = countByStatus(tenants)
  const trialing = tenants.filter((t) => t.billing_status === 'TRIALING').length
  const expiringTrials = filterTrialsExpiringWithinDays(tenants, 7)

  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">Dashboard</h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">Visão geral da plataforma.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Tenants" value={String(tenants.length)} hint={`${byStatus.ACTIVE} ativos`} />
        <Stat label="MRR estimado" value={formatCentsToBrl(mrr)} hint="billing ACTIVE" />
        <Stat label="Em trial" value={String(trialing)} hint="billing TRIALING" />
        <Stat
          label="Trials vencendo 7d"
          value={String(expiringTrials.length)}
          hint={expiringTrials.length === 0 ? 'tudo em dia' : 'ação requerida'}
          tone={expiringTrials.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {expiringTrials.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Trials vencendo nos próximos 7 dias
          </h2>
          <Card>
            <ul className="divide-y divide-border">
              {expiringTrials.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <Link href={`/tenants/${t.id}`} className="flex-1 hover:underline">
                    <p className="font-medium text-fg">{t.name}</p>
                    <p className="text-[0.8125rem] text-fg-muted">
                      {t.slug} ·{' '}
                      {t.trial_ends_at ? `vence em ${dateFmt.format(new Date(t.trial_ends_at))}` : '—'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

function Stat({
  label, value, hint, tone = 'default',
}: { label: string; value: string; hint: string; tone?: 'default' | 'warning' }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
        <p className={`mt-2 font-display text-[1.5rem] font-semibold ${tone === 'warning' ? 'text-warning' : 'text-fg'}`}>
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Smoke**

```bash
pnpm dev
```

Abra `http://admin.lvh.me:3008/login`, logue (precisa de PLATFORM_ADMIN — usar `thiago@aralabs.com.br` se já tem; senão criar via SQL: `UPDATE user_profiles SET role='PLATFORM_ADMIN' WHERE user_id=...`). Esperado: cards com counts reais, lista de trials se houver.

- [ ] **Step 3: Commit**

```bash
git add src/app/(platform)/(authenticated)/dashboard/
git commit -m "feat(platform): dashboard com KPIs (tenants, MRR, trials)

Cards com count e MRR; lista de trials vencendo em 7d com link
pro detalhe do tenant."
```

---

## Task 9: Tenants — listagem com busca e filtros

**Files:**
- Create: `src/app/(platform)/(authenticated)/tenants/page.tsx`
- Create: `src/components/platform/tenants-table.tsx`

- [ ] **Step 1: Page server**

Crie `src/app/(platform)/(authenticated)/tenants/page.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { listAllTenants } from '@/lib/platform/tenants'
import { TenantsTable } from '@/components/platform/tenants-table'

export default async function TenantsListPage() {
  const tenants = await listAllTenants()
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">Tenants</h1>
        <Button asChild>
          <Link href="/tenants/new">+ Novo tenant</Link>
        </Button>
      </header>
      <TenantsTable tenants={tenants} />
    </div>
  )
}
```

- [ ] **Step 2: Tabela client (filtros + busca)**

Crie `src/components/platform/tenants-table.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import type { AdminTenantRow } from '@/lib/platform/tenants'

const STATUSES = ['ALL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const
const BILLING = ['ALL', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] as const

export function TenantsTable({ tenants }: { tenants: AdminTenantRow[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL')
  const [billing, setBilling] = useState<(typeof BILLING)[number]>('ALL')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tenants.filter((t) => {
      if (status !== 'ALL' && t.status !== status) return false
      if (billing !== 'ALL' && t.billing_status !== billing) return false
      if (needle && !`${t.name} ${t.slug}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [tenants, q, status, billing])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar nome ou slug..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <Select label="Billing" value={billing} onChange={setBilling} options={BILLING} />
        <span className="ml-auto text-[0.8125rem] text-fg-muted">
          {filtered.length} de {tenants.length}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.875rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Billing</th>
              <th className="px-3 py-2 text-left">Plano</th>
              <th className="px-3 py-2 text-left">Trial até</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-bg-subtle">
                <td className="px-3 py-2">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-fg hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-fg-muted">{t.slug}</td>
                <td className="px-3 py-2"><Badge>{t.status}</Badge></td>
                <td className="px-3 py-2"><Badge tone={t.billing_status === 'PAST_DUE' ? 'danger' : 'default'}>{t.billing_status}</Badge></td>
                <td className="px-3 py-2 text-fg-muted">{t.plan_id ?? '—'}</td>
                <td className="px-3 py-2 text-fg-muted">{t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Select<T extends string>({
  label, value, onChange, options,
}: { label: string; value: T; onChange: (v: T) => void; options: ReadonlyArray<T> }) {
  return (
    <label className="flex items-center gap-2 text-[0.8125rem] text-fg-muted">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-border bg-bg px-2 py-1 text-[0.8125rem] text-fg"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide ${
      tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-bg-subtle text-fg'
    }`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Smoke + commit**

```bash
pnpm typecheck && pnpm lint
```

Abra `http://admin.lvh.me:3008/tenants`, valide busca + filtros funcionando.

```bash
git add src/app/(platform)/(authenticated)/tenants/page.tsx src/components/platform/tenants-table.tsx
git commit -m "feat(platform): listagem de tenants com busca e filtros

Tabela densa client-side; filtros por status e billing_status;
busca por nome/slug. Click → /tenants/[id]."
```

---

## Task 10: Tenant — página de detalhe (read-only)

**Files:**
- Create: `src/app/(platform)/(authenticated)/tenants/[id]/page.tsx`

- [ ] **Step 1: Implementar**

Crie `src/app/(platform)/(authenticated)/tenants/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { getTenantById } from '@/lib/platform/tenants'
import { formatCentsToBrl } from '@/lib/money'

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenant = await getTenantById(id)
  if (!tenant) notFound()

  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/tenants" className="text-[0.8125rem] text-fg-muted hover:text-fg">
        ← Tenants
      </Link>
      <header>
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">{tenant.name}</h1>
        <p className="text-[0.8125rem] text-fg-muted">
          {tenant.slug} ·{' '}
          <a href={`https://${tenant.subdomain}.aralabs.com.br`} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {tenant.subdomain}.aralabs.com.br
          </a>
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">Status</h2>
          <Row label="Status" value={tenant.status} />
          <Row label="Billing" value={tenant.billing_status} />
          <Row label="Mensalidade" value={formatCentsToBrl(tenant.monthly_price_cents ?? 0)} />
          <Row label="Trial até" value={tenant.trial_ends_at ? dateFmt.format(new Date(tenant.trial_ends_at)) : '—'} />
          <Row label="Criado em" value={dateFmt.format(new Date(tenant.created_at))} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">Branding</h2>
          <Row label="Cor primária" value={tenant.primary_color ?? '—'} />
          <Row label="Cor secundária" value={tenant.secondary_color ?? '—'} />
          <Row label="Cor accent" value={tenant.accent_color ?? '—'} />
          <Row label="Logo" value={tenant.logo_url ?? '—'} />
          <Row label="Favicon" value={tenant.favicon_url ?? '—'} />
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[0.8125rem] text-fg-muted">{label}</span>
      <span className="text-[0.875rem] text-fg">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(platform)/(authenticated)/tenants/[id]/page.tsx
git commit -m "feat(platform): página de detalhe do tenant (read-only)

Mostra Status, Billing, Branding. Edição vem em task separada."
```

---

## Task 11: Extrair lógica de provisioning pra módulo compartilhado

**Files:**
- Create: `src/lib/platform/provision.ts`
- Modify: `scripts/provision-tenant.ts`
- Test: `tests/unit/lib/platform/provision.test.ts`

- [ ] **Step 1: Test failing pra validação**

Crie `tests/unit/lib/platform/provision.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ProvisionTenantInputSchema } from '@/lib/platform/provision'

describe('ProvisionTenantInputSchema', () => {
  it('aceita input válido', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'estetica-luna',
      name: 'Estética Luna',
      ownerEmail: 'maria@example.com',
      ownerName: 'Maria',
      timezone: 'America/Sao_Paulo',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita slug com chars inválidos', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'Estética Luna',
      name: 'Estética Luna',
      ownerEmail: 'maria@example.com',
      ownerName: 'Maria',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita email inválido', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'ok-slug',
      name: 'Ok',
      ownerEmail: 'not-an-email',
      ownerName: 'Maria',
    })
    expect(result.success).toBe(false)
  })

  it('rejeita slug muito longo', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'a'.repeat(60),
      name: 'X', ownerEmail: 'a@b.com', ownerName: 'Y',
    })
    expect(result.success).toBe(false)
  })

  it('aplica default timezone America/Sao_Paulo', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      slug: 'ok', name: 'Ok', ownerEmail: 'a@b.com', ownerName: 'Y',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.timezone).toBe('America/Sao_Paulo')
  })
})
```

- [ ] **Step 2: Confirmar fail**

```bash
pnpm test tests/unit/lib/platform/provision.test.ts
```

- [ ] **Step 3: Implementar módulo**

Crie `src/lib/platform/provision.ts`:

```ts
import 'server-only'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export const ProvisionTenantInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, 'Use só [a-z0-9-]'),
  name: z.string().min(1).max(120),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
  timezone: z.string().default('America/Sao_Paulo'),
  subdomain: z.string().optional(),
  skipHours: z.boolean().default(false),
})

export type ProvisionTenantInput = z.infer<typeof ProvisionTenantInputSchema>

export type ProvisionResult = {
  tenantId: string
  ownerUserId: string
  resetEmailSent: boolean
}

export async function provisionTenant(
  input: ProvisionTenantInput,
  supabase: SupabaseClient<Database> = createSecretClient(),
): Promise<ProvisionResult> {
  const subdomain = input.subdomain ?? input.slug

  // 1. Tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      slug: input.slug,
      name: input.name,
      subdomain,
      timezone: input.timezone,
      primary_color: '#0f172a',
      billing_status: 'TRIALING',
      booking_window_days: 14,
      min_advance_hours: 0,
      slot_interval_minutes: 15,
      cancellation_window_hours: 2,
      customer_can_cancel: true,
    })
    .select('id')
    .single()
  if (tenantErr || !tenant) throw new Error(`tenant insert: ${tenantErr?.message}`)

  // 2. business_hours
  if (!input.skipHours) {
    const hours = Array.from({ length: 7 }, (_, weekday) => ({
      tenant_id: tenant.id,
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00:00',
      end_time: '18:00:00',
    }))
    const { error: hoursErr } = await supabase.from('business_hours').insert(hours)
    if (hoursErr) throw new Error(`business_hours: ${hoursErr.message}`)
  }

  // 3. Auth user — cria ou reusa
  let userId: string
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = existingUsers?.users.find((u) => u.email === input.ownerEmail)

  if (existing) {
    userId = existing.id
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: input.ownerEmail,
      email_confirm: true,
      user_metadata: { name: input.ownerName },
    })
    if (createErr || !created.user) throw new Error(`auth.createUser: ${createErr?.message}`)
    userId = created.user.id
  }

  // 4. user_profile
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    user_id: userId,
    tenant_id: tenant.id,
    role: 'BUSINESS_OWNER',
    name: input.ownerName,
    is_active: true,
  })
  if (profileErr) throw new Error(`user_profiles: ${profileErr.message}`)

  // 5. Reset password email
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(input.ownerEmail, {
    redirectTo: `https://${subdomain}.aralabs.com.br/admin/reset-password`,
  })

  return {
    tenantId: tenant.id,
    ownerUserId: userId,
    resetEmailSent: !resetErr,
  }
}
```

- [ ] **Step 4: Confirmar pass**

```bash
pnpm test tests/unit/lib/platform/provision.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Refatorar script CLI pra usar o módulo**

Em `scripts/provision-tenant.ts`, substitua a função `main` pra chamar `provisionTenant()`:

```ts
import { provisionTenant, ProvisionTenantInputSchema } from '../src/lib/platform/provision.ts'
// ... mantém parseCliArgs, getSupabaseAdmin

async function main() {
  const args = parseCliArgs()
  const supabase = getSupabaseAdmin()

  const parsed = ProvisionTenantInputSchema.parse({
    slug: args.slug,
    name: args.name,
    ownerEmail: args.ownerEmail,
    ownerName: args.ownerName,
    timezone: args.timezone,
    subdomain: args.subdomain,
    skipHours: args.skipHours,
  })

  console.log(`\n→ Provisioning tenant "${parsed.name}" (${parsed.slug})...`)

  try {
    const result = await provisionTenant(parsed, supabase)
    console.log(`  ✓ Tenant criado: ${result.tenantId}`)
    console.log(`  ✓ Owner: ${result.ownerUserId}`)
    if (result.resetEmailSent) console.log(`  ✓ Reset de senha enviado pra ${parsed.ownerEmail}`)
    else console.log(`  ⚠ Reset de senha falhou — owner usa "Esqueci a senha"`)
    console.log('\n✓ Pronto.')
    console.log(`  Admin: https://${parsed.subdomain ?? parsed.slug}.aralabs.com.br/admin/login`)
  } catch (e) {
    console.error('✗ Erro:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}
```

- [ ] **Step 6: Smoke do CLI**

```bash
node --env-file=.env.local scripts/provision-tenant.ts \
  --slug test-cli-$(date +%s) \
  --name "Test CLI" \
  --owner-email cli-test@example.com \
  --owner-name "Test"
```

Expected: cria com sucesso. Limpe depois via SQL/admin UI quando ela existir.

- [ ] **Step 7: Commit**

```bash
git add src/lib/platform/provision.ts scripts/provision-tenant.ts tests/unit/lib/platform/provision.test.ts
git commit -m "refactor(platform): extrai provisioning pra módulo compartilhado

scripts/provision-tenant.ts vira thin wrapper de CLI; lógica de
banco mora em lib/platform/provision.ts pra ser reusada pela
server action de criar tenant na UI."
```

---

## Task 12: Criar tenant via UI (form + server action)

**Files:**
- Create: `src/app/(platform)/(authenticated)/tenants/new/page.tsx`
- Create: `src/app/(platform)/(authenticated)/tenants/new/form.tsx`
- Create: `src/app/(platform)/(authenticated)/actions.ts`

- [ ] **Step 1: Server action**

Crie `src/app/(platform)/(authenticated)/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { provisionTenant, ProvisionTenantInputSchema } from '@/lib/platform/provision'
import { recordAudit } from '@/lib/audit/log'

export type CreateTenantState = { error?: string }

export async function createTenantAction(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const user = await assertPlatformAdmin()
  const parsed = ProvisionTenantInputSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    ownerEmail: formData.get('ownerEmail'),
    ownerName: formData.get('ownerName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }
  try {
    const result = await provisionTenant(parsed.data)
    await recordAudit({
      tenantId: result.tenantId,
      actorUserId: user.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'tenant.create',
      entityType: 'tenant',
      entityId: result.tenantId,
      changes: { slug: parsed.data.slug, ownerEmail: parsed.data.ownerEmail },
    })
    revalidatePath('/tenants')
    redirect(`/tenants/${result.tenantId}`)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  return {}
}
```

- [ ] **Step 2: Page**

Crie `src/app/(platform)/(authenticated)/tenants/new/page.tsx`:

```tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { NewTenantForm } from './form'

export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/tenants" className="text-[0.8125rem] text-fg-muted hover:text-fg">
        ← Tenants
      </Link>
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Novo tenant</h1>
      <Card>
        <CardContent className="py-6">
          <NewTenantForm />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Form client (useActionState)**

Crie `src/app/(platform)/(authenticated)/tenants/new/form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTenantAction, type CreateTenantState } from '../../actions'

export function NewTenantForm() {
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(createTenantAction, {})
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome do negócio" name="name" placeholder="Estética Luna" required />
      <Field
        label="Slug (subdomínio)"
        name="slug"
        placeholder="estetica-luna"
        helper="Vira estetica-luna.aralabs.com.br"
        required
      />
      <Field label="Nome do owner" name="ownerName" placeholder="Maria Luna" required />
      <Field label="Email do owner" name="ownerEmail" type="email" placeholder="maria@estetica.com" required />
      {state.error ? <p className="text-[0.8125rem] text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Criando...' : 'Criar tenant'}
      </Button>
    </form>
  )
}

function Field({
  label, name, placeholder, helper, required, type = 'text',
}: { label: string; name: string; placeholder?: string; helper?: string; required?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-fg">{label}</span>
      <Input name={name} type={type} placeholder={placeholder} required={required} />
      {helper ? <p className="mt-1 text-[0.75rem] text-fg-muted">{helper}</p> : null}
    </label>
  )
}
```

- [ ] **Step 4: Smoke + commit**

```bash
pnpm typecheck && pnpm lint
```

Em `http://admin.lvh.me:3008/tenants/new`, criar tenant teste, validar redirect pra detalhe, conferir entrada no `audit_log`.

```bash
git add src/app/(platform)/(authenticated)/actions.ts src/app/(platform)/(authenticated)/tenants/new
git commit -m "feat(platform): criar tenant pela UI

Form usa useActionState; action chama provisionTenant + grava
audit log; redirect pra /tenants/[id] em sucesso."
```

---

## Task 13: Editar tenant (branding + billing) + ações de status

**Files:**
- Modify: `src/app/(platform)/(authenticated)/tenants/[id]/page.tsx` (substitui pela versão editável)
- Create: `src/app/(platform)/(authenticated)/tenants/[id]/edit-forms.tsx`
- Modify: `src/app/(platform)/(authenticated)/actions.ts` (adiciona update + status actions)

- [ ] **Step 1: Adicionar actions de update**

Em `src/app/(platform)/(authenticated)/actions.ts`, adicione no final:

```ts
import { z } from 'zod'
import { createSecretClient } from '@/lib/supabase/secret'

const UpdateBrandingSchema = z.object({
  tenantId: z.string().uuid(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
})

export async function updateTenantBrandingAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await assertPlatformAdmin()
  const parsed = UpdateBrandingSchema.safeParse({
    tenantId: formData.get('tenantId'),
    primaryColor: formData.get('primaryColor') || null,
    secondaryColor: formData.get('secondaryColor') || null,
    accentColor: formData.get('accentColor') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const supabase = createSecretClient()
  const { error } = await supabase
    .from('tenants')
    .update({
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      accent_color: parsed.data.accentColor,
    })
    .eq('id', parsed.data.tenantId)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: parsed.data.tenantId,
    actorUserId: user.id, actorRole: 'PLATFORM_ADMIN',
    action: 'tenant.branding.update',
    entityType: 'tenant', entityId: parsed.data.tenantId,
    changes: parsed.data,
  })
  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}

const SetStatusSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
})

export async function setTenantStatusAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await assertPlatformAdmin()
  const parsed = SetStatusSchema.safeParse({
    tenantId: formData.get('tenantId'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { error: 'Status inválido' }
  const supabase = createSecretClient()
  const { error } = await supabase.from('tenants').update({ status: parsed.data.status }).eq('id', parsed.data.tenantId)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: parsed.data.tenantId,
    actorUserId: user.id, actorRole: 'PLATFORM_ADMIN',
    action: `tenant.status.${parsed.data.status.toLowerCase()}`,
    entityType: 'tenant', entityId: parsed.data.tenantId,
    changes: { status: parsed.data.status },
  })
  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true }
}
```

- [ ] **Step 2: Forms client**

Crie `src/app/(platform)/(authenticated)/tenants/[id]/edit-forms.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateTenantBrandingAction, setTenantStatusAction } from '../../actions'

export function BrandingForm({
  tenantId, primaryColor, secondaryColor, accentColor,
}: { tenantId: string; primaryColor: string | null; secondaryColor: string | null; accentColor: string | null }) {
  const [state, action, pending] = useActionState(updateTenantBrandingAction, {})
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <ColorField label="Cor primária" name="primaryColor" defaultValue={primaryColor ?? ''} />
      <ColorField label="Cor secundária" name="secondaryColor" defaultValue={secondaryColor ?? ''} />
      <ColorField label="Cor accent" name="accentColor" defaultValue={accentColor ?? ''} />
      {state.error ? <p className="text-[0.8125rem] text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-[0.8125rem] text-success">Salvo.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar branding'}</Button>
    </form>
  )
}

function ColorField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-32 text-[0.8125rem] text-fg-muted">{label}</span>
      <Input name={name} defaultValue={defaultValue} placeholder="#000000" className="max-w-[140px]" />
    </label>
  )
}

export function StatusActions({ tenantId, current }: { tenantId: string; current: string }) {
  const [state, action, pending] = useActionState(setTenantStatusAction, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <span className="text-[0.8125rem] text-fg-muted">Atual: {current}</span>
      {(['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const)
        .filter((s) => s !== current)
        .map((s) => (
          <Button key={s} type="submit" name="status" value={s} variant="outline" disabled={pending}>
            → {s}
          </Button>
        ))}
      {state.error ? <span className="text-[0.8125rem] text-danger">{state.error}</span> : null}
    </form>
  )
}
```

- [ ] **Step 3: Atualizar page do detalhe pra usar os forms**

Em `src/app/(platform)/(authenticated)/tenants/[id]/page.tsx`, adicione import e duas seções novas antes do `</div>` final:

```tsx
import { BrandingForm, StatusActions } from './edit-forms'
// ...

<Card>
  <CardContent className="space-y-3 py-4">
    <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">Mudar status</h2>
    <StatusActions tenantId={tenant.id} current={tenant.status} />
  </CardContent>
</Card>

<Card>
  <CardContent className="space-y-3 py-4">
    <h2 className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">Editar branding</h2>
    <BrandingForm
      tenantId={tenant.id}
      primaryColor={tenant.primary_color}
      secondaryColor={tenant.secondary_color}
      accentColor={tenant.accent_color}
    />
  </CardContent>
</Card>
```

- [ ] **Step 4: Smoke + commit**

Em `/tenants/[id]`, mude branding e status. Confira entrada no `audit_log`.

```bash
git add src/app/(platform)/(authenticated)/tenants/[id]/edit-forms.tsx \
        src/app/(platform)/(authenticated)/tenants/[id]/page.tsx \
        src/app/(platform)/(authenticated)/actions.ts
git commit -m "feat(platform): editar branding + mudar status do tenant

Forms usam useActionState; toda mutation grava audit_log com
actor PLATFORM_ADMIN."
```

---

## Task 14: Plans CRUD

**Files:**
- Create: `src/lib/platform/plans.ts`
- Create: `src/app/(platform)/(authenticated)/plans/page.tsx`
- Create: `src/app/(platform)/(authenticated)/plans/plan-row.tsx`
- Modify: `src/app/(platform)/(authenticated)/actions.ts` (add upsertPlan, deletePlan)

- [ ] **Step 1: Queries**

Crie `src/lib/platform/plans.ts`:

```ts
import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AdminPlanRow = Database['public']['Tables']['plans']['Row']

export async function listPlans(): Promise<AdminPlanRow[]> {
  const supabase = createSecretClient()
  const { data, error } = await supabase.from('plans').select('*').order('monthly_price_cents', { ascending: true })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Server action upsert**

Em `actions.ts`, adicione:

```ts
const UpsertPlanSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  monthly_price_cents: z.coerce.number().int().nonnegative(),
  trial_days: z.coerce.number().int().nonnegative().default(0),
})

export async function upsertPlanAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await assertPlatformAdmin()
  const parsed = UpsertPlanSchema.safeParse({
    id: formData.get('id') || undefined,
    code: formData.get('code'),
    name: formData.get('name'),
    monthly_price_cents: formData.get('monthly_price_cents'),
    trial_days: formData.get('trial_days'),
  })
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  const supabase = createSecretClient()
  const { error } = await supabase.from('plans').upsert(parsed.data)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: null,
    actorUserId: user.id, actorRole: 'PLATFORM_ADMIN',
    action: parsed.data.id ? 'plan.update' : 'plan.create',
    entityType: 'plan', entityId: parsed.data.id ?? null,
    changes: parsed.data,
  })
  revalidatePath('/plans')
  return { ok: true }
}
```

- [ ] **Step 3: Page + row component**

Crie `src/app/(platform)/(authenticated)/plans/page.tsx`:

```tsx
import { listPlans } from '@/lib/platform/plans'
import { PlanRow } from './plan-row'

export default async function PlansPage() {
  const plans = await listPlans()
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Plans</h1>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.875rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-right">Preço/mês</th>
              <th className="px-3 py-2 text-right">Trial (dias)</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((p) => <PlanRow key={p.id} plan={p} />)}
            <PlanRow plan={null} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Crie `src/app/(platform)/(authenticated)/plans/plan-row.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertPlanAction } from '../actions'
import type { AdminPlanRow } from '@/lib/platform/plans'

export function PlanRow({ plan }: { plan: AdminPlanRow | null }) {
  const [state, action, pending] = useActionState(upsertPlanAction, {})
  const isNew = plan === null
  return (
    <tr>
      <td className="px-3 py-1.5">
        <form action={action} id={isNew ? 'new-plan' : `plan-${plan.id}`}>
          {!isNew ? <input type="hidden" name="id" value={plan.id} /> : null}
          <Input name="code" defaultValue={plan?.code ?? ''} placeholder={isNew ? 'NOVO_CODE' : ''} required className="h-8" />
        </form>
      </td>
      <td className="px-3 py-1.5">
        <Input form={isNew ? 'new-plan' : `plan-${plan.id}`} name="name" defaultValue={plan?.name ?? ''} required className="h-8" />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Input form={isNew ? 'new-plan' : `plan-${plan.id}`} name="monthly_price_cents" type="number" defaultValue={plan?.monthly_price_cents ?? 0} className="h-8 text-right" />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Input form={isNew ? 'new-plan' : `plan-${plan.id}`} name="trial_days" type="number" defaultValue={plan?.trial_days ?? 0} className="h-8 text-right" />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Button type="submit" form={isNew ? 'new-plan' : `plan-${plan.id}`} size="sm" disabled={pending}>
          {pending ? '...' : isNew ? 'Criar' : 'Salvar'}
        </Button>
        {state.error ? <span className="ml-2 text-[0.75rem] text-danger">{state.error}</span> : null}
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Smoke + commit**

```bash
pnpm typecheck && pnpm lint
```

Em `/plans`, edite um plano, crie outro, confira `audit_log`.

```bash
git add src/lib/platform/plans.ts src/app/(platform)/(authenticated)/plans \
        src/app/(platform)/(authenticated)/actions.ts
git commit -m "feat(platform): plans CRUD inline

Tabela com edição inline; upsert via server action; audit log
em cada change."
```

---

## Task 15: Users cross-tenant

**Files:**
- Create: `src/lib/platform/users.ts`
- Create: `src/app/(platform)/(authenticated)/users/page.tsx`
- Create: `src/app/(platform)/(authenticated)/users/users-table.tsx`
- Modify: `actions.ts` (deactivateUser, sendPasswordReset)

- [ ] **Step 1: Queries**

Crie `src/lib/platform/users.ts`:

```ts
import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AdminUserRow = {
  id: string
  user_id: string
  name: string
  role: Database['public']['Enums']['user_role']
  is_active: boolean
  tenant_id: string | null
  tenant_name: string | null
  email: string | null
  last_sign_in_at: string | null
}

export async function listAllUsers(): Promise<AdminUserRow[]> {
  const supabase = createSecretClient()
  const [{ data: profiles, error: profErr }, { data: authData }] = await Promise.all([
    supabase.from('user_profiles').select('id, user_id, name, role, is_active, tenant_id, tenants(name)').order('name'),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])
  if (profErr) throw profErr
  const authMap = new Map((authData?.users ?? []).map((u) => [u.id, u]))
  return (profiles ?? []).map((p) => {
    const auth = authMap.get(p.user_id)
    return {
      id: p.id,
      user_id: p.user_id,
      name: p.name,
      role: p.role,
      is_active: p.is_active,
      tenant_id: p.tenant_id,
      tenant_name: (p.tenants as { name: string } | null)?.name ?? null,
      email: auth?.email ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
    }
  })
}
```

- [ ] **Step 2: Server actions**

Em `actions.ts`:

```ts
const UserActionSchema = z.object({ profileId: z.string().uuid(), userId: z.string().uuid(), email: z.string().email() })

export async function deactivateUserAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
) {
  const actor = await assertPlatformAdmin()
  const parsed = UserActionSchema.safeParse({
    profileId: formData.get('profileId'),
    userId: formData.get('userId'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: 'Input inválido' }
  const supabase = createSecretClient()
  const { error } = await supabase.from('user_profiles').update({ is_active: false }).eq('id', parsed.data.profileId)
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: null, actorUserId: actor.id, actorRole: 'PLATFORM_ADMIN',
    action: 'user.deactivate', entityType: 'user_profile', entityId: parsed.data.profileId,
    changes: { email: parsed.data.email },
  })
  revalidatePath('/users')
  return { ok: true }
}

export async function sendPasswordResetAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
) {
  const actor = await assertPlatformAdmin()
  const parsed = UserActionSchema.safeParse({
    profileId: formData.get('profileId'),
    userId: formData.get('userId'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: 'Input inválido' }
  const supabase = createSecretClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `https://aralabs.com.br/admin/reset-password`,
  })
  if (error) return { error: error.message }
  await recordAudit({
    tenantId: null, actorUserId: actor.id, actorRole: 'PLATFORM_ADMIN',
    action: 'user.password_reset_sent', entityType: 'user_profile', entityId: parsed.data.profileId,
    changes: { email: parsed.data.email },
  })
  return { ok: true }
}
```

- [ ] **Step 3: Page + table**

Crie `src/app/(platform)/(authenticated)/users/page.tsx`:

```tsx
import { listAllUsers } from '@/lib/platform/users'
import { UsersTable } from './users-table'

export default async function UsersPage() {
  const users = await listAllUsers()
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Users</h1>
      <UsersTable users={users} />
    </div>
  )
}
```

Crie `src/app/(platform)/(authenticated)/users/users-table.tsx`:

```tsx
'use client'

import { useMemo, useState, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deactivateUserAction, sendPasswordResetAction } from '../actions'
import type { AdminUserRow } from '@/lib/platform/users'

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return users
    return users.filter((u) =>
      `${u.name} ${u.email ?? ''} ${u.tenant_name ?? ''}`.toLowerCase().includes(needle),
    )
  }, [users, q])
  return (
    <div className="space-y-3">
      <Input placeholder="Buscar nome / email / tenant..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.875rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Ativo</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => <Row key={u.id} u={u} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ u }: { u: AdminUserRow }) {
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordResetAction, {})
  const [deactState, deactAction, deactPending] = useActionState(deactivateUserAction, {})
  return (
    <tr className={u.is_active ? '' : 'opacity-60'}>
      <td className="px-3 py-1.5">{u.name}</td>
      <td className="px-3 py-1.5 text-fg-muted">{u.email ?? '—'}</td>
      <td className="px-3 py-1.5">{u.role}</td>
      <td className="px-3 py-1.5">{u.tenant_name ?? '—'}</td>
      <td className="px-3 py-1.5">{u.is_active ? '✓' : '✗'}</td>
      <td className="px-3 py-1.5 text-right">
        <form action={resetAction} className="inline-block">
          <input type="hidden" name="profileId" value={u.id} />
          <input type="hidden" name="userId" value={u.user_id} />
          <input type="hidden" name="email" value={u.email ?? ''} />
          <Button type="submit" variant="outline" size="sm" disabled={resetPending || !u.email}>
            {resetPending ? '...' : 'Reset senha'}
          </Button>
        </form>
        {u.is_active ? (
          <form action={deactAction} className="ml-2 inline-block">
            <input type="hidden" name="profileId" value={u.id} />
            <input type="hidden" name="userId" value={u.user_id} />
            <input type="hidden" name="email" value={u.email ?? ''} />
            <Button type="submit" variant="outline" size="sm" disabled={deactPending}>
              {deactPending ? '...' : 'Desativar'}
            </Button>
          </form>
        ) : null}
        {(resetState.error || deactState.error) ? (
          <span className="ml-2 text-[0.75rem] text-danger">
            {resetState.error || deactState.error}
          </span>
        ) : null}
        {(resetState.ok || deactState.ok) ? (
          <span className="ml-2 text-[0.75rem] text-success">✓</span>
        ) : null}
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Smoke + commit**

```bash
pnpm typecheck && pnpm lint
```

Em `/users`, valide listagem, busca, ações de reset/deactivate. Confira `audit_log`.

```bash
git add src/lib/platform/users.ts src/app/(platform)/(authenticated)/users \
        src/app/(platform)/(authenticated)/actions.ts
git commit -m "feat(platform): users cross-tenant + ações

Lista profiles + email/last_sign_in via auth.admin.listUsers;
ações reset senha e desativar com audit."
```

---

## Task 16: Audit log viewer

**Files:**
- Create: `src/lib/platform/audit-query.ts`
- Create: `src/app/(platform)/(authenticated)/audit/page.tsx`

- [ ] **Step 1: Query**

Crie `src/lib/platform/audit-query.ts`:

```ts
import 'server-only'
import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

export type AuditEntry = Database['public']['Tables']['audit_log']['Row'] & {
  actor_email: string | null
  tenant_name: string | null
}

export async function listRecentAudit(limit = 100): Promise<AuditEntry[]> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, tenants(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = (data ?? []) as Array<Database['public']['Tables']['audit_log']['Row'] & { tenants: { name: string } | null }>
  if (rows.length === 0) return []

  const userIds = Array.from(new Set(rows.map((r) => r.actor_user_id).filter((x): x is string => !!x)))
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.email ?? null]))

  return rows.map((r) => ({
    ...r,
    actor_email: r.actor_user_id ? (emailMap.get(r.actor_user_id) ?? null) : null,
    tenant_name: r.tenants?.name ?? null,
  }))
}
```

- [ ] **Step 2: Page**

Crie `src/app/(platform)/(authenticated)/audit/page.tsx`:

```tsx
import { listRecentAudit } from '@/lib/platform/audit-query'

export default async function AuditPage() {
  const entries = await listRecentAudit(200)
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Audit log</h1>
      <p className="text-[0.8125rem] text-fg-muted">Últimas {entries.length} entradas.</p>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.8125rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Quando</th>
              <th className="px-3 py-2 text-left">Ator</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-bg-subtle">
                <td className="px-3 py-1.5 text-fg-muted">{dateFmt.format(new Date(e.created_at))}</td>
                <td className="px-3 py-1.5">{e.actor_email ?? e.actor_user_id ?? '—'}</td>
                <td className="px-3 py-1.5 text-fg-muted">{e.actor_role ?? '—'}</td>
                <td className="px-3 py-1.5 font-mono text-[0.75rem]">{e.action}</td>
                <td className="px-3 py-1.5 text-fg-muted">{e.tenant_name ?? '—'}</td>
                <td className="px-3 py-1.5 text-fg-muted">{e.entity_type}{e.entity_id ? `#${e.entity_id.slice(0, 8)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Smoke + commit**

```bash
pnpm typecheck && pnpm lint
```

Em `/audit`, confira que entries das tasks anteriores aparecem.

```bash
git add src/lib/platform/audit-query.ts src/app/(platform)/(authenticated)/audit
git commit -m "feat(platform): audit log viewer

Tabela cronológica reversa; resolve ator (auth) + tenant (FK)
em N+1 simples (cabe em até ~1000 entries no Fase 1)."
```

---

## Task 17: Smoke test + atualizar docs

**Files:**
- Modify: `docs/smoke-test-pilot.md`
- Modify: `docs/futuro.md`

- [ ] **Step 1: Adicionar seção "Platform admin" no smoke**

Em `docs/smoke-test-pilot.md`, adicione um cenário novo:

```md
## Platform admin (admin.aralabs.com.br)

**Pré-condição:** usuário com `user_profiles.role='PLATFORM_ADMIN'` (ex: thiago@aralabs.com.br).

1. Abrir `https://admin.aralabs.com.br/login` (em dev: `http://admin.lvh.me:3008/login`).
2. Inserir email institucional → "Enviar link mágico" → confirmar mensagem "Enviamos link...".
3. Abrir email, clicar link → cair em `/dashboard` autenticado.
4. Validar cards (Tenants, MRR, Em trial, Trials vencendo 7d) com números coerentes.
5. Click sidebar "Tenants" → tabela carrega; busca por slug funciona; filtro por status funciona.
6. Click "+ Novo tenant" → preencher form com slug único → submit → redirect pra detalhe.
7. No detalhe: mudar status pra SUSPENDED → confirmar atualização. Voltar pra ACTIVE.
8. Editar branding (cor primária pra `#ff0000`) → "Salvar" → confirmar mensagem.
9. Click sidebar "Plans" → editar `monthly_price_cents` de algum plano → "Salvar".
10. Click sidebar "Users" → buscar por email → "Reset senha" → confirmar mensagem.
11. Click sidebar "Audit" → confirmar que ações dos passos 6-10 aparecem.
12. Click user menu → "Sair" → cair em `/login`.

**Falha esperada:** logar com user que NÃO é PLATFORM_ADMIN → cair em `/login?error=forbidden`.
```

- [ ] **Step 2: Atualizar `futuro.md`**

Em `docs/futuro.md`, na entrada de 2026-04-29 sobre admin postergado, anexar nota de implementação:

```md
**Update 2026-04-29 (mesmo dia):** admin foi implementado dentro
do `ara-agenda` em vez de adiado. Vive em subdomínio dedicado
`admin.aralabs.com.br` (route group `src/app/(platform)/`). Spec
multi-produto no storefront permanece como referência futura.
Plano de execução: `docs/superpowers/plans/2026-04-29-platform-admin.md`.
```

- [ ] **Step 3: Commit final**

```bash
git add docs/smoke-test-pilot.md docs/futuro.md
git commit -m "docs: smoke test + futuro.md cobrem platform admin

Roteiro novo no smoke pra subdomínio admin; futuro.md referencia
o plano executado."
```

---

## Verificação final

- [ ] `pnpm typecheck` sem erros
- [ ] `pnpm lint` sem warnings
- [ ] `pnpm test` todos passam
- [ ] Smoke manual completo do roteiro novo
- [ ] `audit_log` ganha entries em todas as mutations testadas
- [ ] Logout funciona; login bloqueia user sem PLATFORM_ADMIN

## Fora do escopo deste plano

- **Subdomínio `admin` em produção (DNS + Vercel).** Configurar no painel Vercel: adicionar `admin.aralabs.com.br` ao projeto, criar CNAME no DNS. Não cabe em código; tarefa de ops separada.
- **Email customizado** (today usa template Supabase default). Quando for ajustar branding do email, cobrir todos templates juntos (magic link, reset, confirmation).
- **Dark mode toggle.** Layout força `dark` no `<html>`. Toggle pra light fica como melhoria futura se incomodar.
- **Command palette (`cmd+k`).** Mencionado na conversa; vai como tarefa separada quando volume de tenants justificar.
- **Paginação no audit log.** Hoje carrega 200 últimos; quando passar de ~1000 entries, paginar ou filtrar por período.
- **Edição de billing details** (plan_id, monthly_price_cents, trial_ends_at) na página do tenant. Cobre só branding + status nesta entrega; billing fica pra próxima iteração.
- **Listagem cross-tenant de appointments / customers / services.** Não é necessário no MVP; suporte usa subdomínio do próprio tenant.
