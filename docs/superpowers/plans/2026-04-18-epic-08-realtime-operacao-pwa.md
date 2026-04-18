# Épico 8 — Realtime + Modo Operação + PWA Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar auto-refresh da agenda via Supabase Realtime, implementar o Modo Operação (layout simplificado + Wake Lock + PIN), polish do PWA (service worker, install prompt, ícones default).

**Architecture:** Supabase Realtime escuta canal específico do tenant (`appointments:tenant_id=eq.{id}`), client component revalida server data on-change. Modo Operação é um layout/toggle que esconde menus, lida com Wake Lock API, pede PIN 4-dígitos (bcrypt-hash em `tenants.operation_mode_pin_hash`) para sair. Service worker mínimo gerado manualmente para habilitar install prompt no Android; iOS depende do manifest já gerado no Épico 2.

**Tech Stack:** Supabase Realtime, Wake Lock API, Web App Manifest, Service Worker, bcrypt (server-only).

**Referência:** Spec — Seções 11 (PWA), 12 (Modo Operação), 10.9 (Modo Operação), 10.10 (Realtime).

**Dependências:** Épicos 0–7.

---

## File Structure

```
ara-barber/
├── supabase/migrations/
│   └── 0021_realtime_publications.sql
├── src/
│   ├── lib/
│   │   ├── pwa/
│   │   │   └── register-sw.ts
│   │   ├── operation-mode/
│   │   │   ├── pin.ts                     # bcrypt hash/verify (server-only)
│   │   │   └── wake-lock.ts
│   │   └── realtime/
│   │       └── subscribe.ts
│   ├── components/
│   │   ├── pwa/
│   │   │   ├── install-prompt.tsx
│   │   │   └── sw-register.tsx
│   │   ├── operation-mode/
│   │   │   ├── toggle.tsx
│   │   │   └── pin-gate.tsx
│   │   └── agenda/
│   │       └── realtime-agenda.tsx
│   └── app/
│       ├── (salon)/dashboard/
│       │   ├── configuracoes/operacao/
│       │   │   ├── page.tsx
│       │   │   └── actions.ts
│       │   └── agenda/_live-board.tsx
│       └── sw.js                          # service worker servido em /sw.js
└── public/
    └── icons/
        ├── default-192.png
        └── default-512.png
```

---

## Task 1: Habilitar Realtime para `appointments`

**Files:**
- Create: `supabase/migrations/0021_realtime_publications.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new realtime_publications
```

```sql
-- supabase/migrations/0021_realtime_publications.sql

-- Adiciona tabela appointments à publication padrão do Realtime
alter publication supabase_realtime add table public.appointments;

-- availability_blocks também, para agenda ficar consistente
alter publication supabase_realtime add table public.availability_blocks;
```

- [ ] **Step 2: Aplicar**

```bash
supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0021_realtime_publications.sql
git commit -m "feat(db): habilita Realtime em appointments e availability_blocks"
```

---

## Task 2: Helper de subscribe Realtime

**Files:**
- Create: `src/lib/realtime/subscribe.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/realtime/subscribe.ts
'use client'

import { createClient } from '@/lib/supabase/browser'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function subscribeToAgenda(
  tenantId: string,
  onChange: () => void,
): RealtimeChannel {
  const supabase = createClient()

  const channel = supabase
    .channel(`agenda:${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `tenant_id=eq.${tenantId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'availability_blocks',
        filter: `tenant_id=eq.${tenantId}`,
      },
      onChange,
    )
    .subscribe()

  return channel
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/realtime/subscribe.ts
git commit -m "feat(realtime): helper subscribeToAgenda (appointments + blocks)"
```

---

## Task 3: Wrapping da agenda com LiveBoard

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/_live-board.tsx`
- Modify: `src/app/(salon)/dashboard/agenda/page.tsx`

- [ ] **Step 1: Live wrapper**

```tsx
// src/app/(salon)/dashboard/agenda/_live-board.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeToAgenda } from '@/lib/realtime/subscribe'

export function LiveBoard({
  tenantId,
  children,
}: {
  tenantId: string
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const channel = subscribeToAgenda(tenantId, () => {
      router.refresh()
    })
    return () => {
      channel.unsubscribe()
    }
  }, [tenantId, router])

  return <>{children}</>
}
```

- [ ] **Step 2: Wrappar na page**

```tsx
// src/app/(salon)/dashboard/agenda/page.tsx (trecho, adicionar import + wrap)
import { LiveBoard } from './_live-board'

// No retorno, envolver o conteúdo:
return (
  <main className="p-4 pb-20">
    {/* ... header + form ... */}
    <LiveBoard tenantId={tenant.id}>
      <div className="lg:hidden">
        <DayList appointments={appointments ?? []} />
      </div>
      <div className="hidden lg:block">
        <ColumnsBoard
          appointments={appointments ?? []}
          professionals={professionals ?? []}
        />
      </div>
    </LiveBoard>
  </main>
)
```

- [ ] **Step 3: Teste manual**

Abrir agenda em 2 abas (`http://barbearia-teste.lvh.me:3000/dashboard/agenda`) e fazer um check-in em uma delas. A outra deve atualizar automaticamente.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/
git commit -m "feat(agenda): LiveBoard — auto-refresh via Supabase Realtime"
```

---

## Task 4: PIN do Modo Operação (bcrypt)

**Files:**
- Create: `src/lib/operation-mode/pin.ts`
- Create: `src/app/(salon)/dashboard/configuracoes/operacao/page.tsx`
- Create: `src/app/(salon)/dashboard/configuracoes/operacao/actions.ts`

- [ ] **Step 1: Instalar bcrypt**

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: Helper pin**

```ts
// src/lib/operation-mode/pin.ts
import 'server-only'

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN deve ser 4 dígitos numéricos')
  return bcrypt.hash(pin, SALT_ROUNDS)
}

export async function verifyPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(pin, hash)
}
```

- [ ] **Step 3: Server actions**

```ts
// src/app/(salon)/dashboard/configuracoes/operacao/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { hashPin, verifyPin } from '@/lib/operation-mode/pin'

const schema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN deve ter 4 dígitos'),
})

export type PinState = { error?: string; success?: boolean }

export async function setOperationPinAction(
  _prev: PinState,
  formData: FormData,
): Promise<PinState> {
  const user = await assertStaff()
  if (user.profile.role !== 'SALON_OWNER') {
    return { error: 'Apenas o owner pode definir o PIN' }
  }

  const parsed = schema.safeParse({ pin: formData.get('pin') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'PIN inválido' }

  const hash = await hashPin(parsed.data.pin)
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ operation_mode_pin_hash: hash })
    .eq('id', user.profile.tenantId!)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes/operacao')
  return { success: true }
}

const verifySchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
})

export async function verifyOperationPinAction(
  _prev: PinState,
  formData: FormData,
): Promise<PinState> {
  const user = await assertStaff()
  const parsed = verifySchema.safeParse({ pin: formData.get('pin') })
  if (!parsed.success) return { error: 'PIN inválido' }

  const supabase = await createClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('operation_mode_pin_hash')
    .eq('id', user.profile.tenantId!)
    .maybeSingle()

  if (!tenant?.operation_mode_pin_hash) return { error: 'PIN não configurado' }

  const ok = await verifyPin(parsed.data.pin, tenant.operation_mode_pin_hash)
  if (!ok) return { error: 'PIN incorreto' }

  return { success: true }
}
```

- [ ] **Step 4: Page**

```tsx
// src/app/(salon)/dashboard/configuracoes/operacao/page.tsx
import { assertStaff } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { PinForm } from './_form'

export default async function OperacaoConfigPage() {
  const user = await assertStaff()
  const supabase = await createClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('operation_mode_pin_hash')
    .eq('id', user.profile.tenantId!)
    .maybeSingle()

  const pinConfigured = !!tenant?.operation_mode_pin_hash

  return (
    <main className="p-4 pb-20">
      <h1 className="text-xl font-bold">Modo Operação</h1>
      <p className="mt-2 text-sm opacity-70">
        O Modo Operação simplifica a tela para uso no balcão. Para sair do modo, o usuário precisa digitar o PIN.
      </p>

      <div className="mt-4 rounded-lg border p-4 text-sm">
        <p className="opacity-70">
          Status do PIN: <strong>{pinConfigured ? 'configurado' : 'não configurado'}</strong>
        </p>
      </div>

      <PinForm />
    </main>
  )
}
```

```tsx
// src/app/(salon)/dashboard/configuracoes/operacao/_form.tsx
'use client'

import { useActionState } from 'react'
import { setOperationPinAction, type PinState } from './actions'

const INITIAL: PinState = {}

export function PinForm() {
  const [state, action, pending] = useActionState(setOperationPinAction, INITIAL)

  return (
    <form action={action} className="mt-6 max-w-xs space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Definir / alterar PIN</h2>

      <label className="block">
        <span className="mb-1 block text-sm">PIN (4 dígitos)</span>
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          pattern="^\d{4}$"
          maxLength={4}
          required
          className="h-12 w-full rounded-md border px-3 text-center text-2xl tracking-[0.5em]"
        />
      </label>

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">PIN atualizado.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Salvar PIN'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(salon\)/dashboard/configuracoes/operacao/ src/lib/operation-mode/pin.ts package.json pnpm-lock.yaml
git commit -m "feat(operacao): PIN bcrypt + CRUD na configuração"
```

---

## Task 5: Wake Lock helper + toggle do Modo Operação

**Files:**
- Create: `src/lib/operation-mode/wake-lock.ts`
- Create: `src/components/operation-mode/toggle.tsx`
- Create: `src/components/operation-mode/pin-gate.tsx`

- [ ] **Step 1: Wake Lock helper**

```ts
// src/lib/operation-mode/wake-lock.ts
'use client'

type WakeLockRef = { release: () => Promise<void> } | null

let current: WakeLockRef = null

export async function requestWakeLock(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    wakeLock?: { request: (kind: 'screen') => Promise<WakeLockRef> }
  }
  if (!nav.wakeLock) return false
  try {
    current = await nav.wakeLock.request('screen')
    return true
  } catch {
    return false
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (current) {
    try {
      await current.release()
    } catch {
      // ignore
    }
    current = null
  }
}
```

- [ ] **Step 2: Toggle**

```tsx
// src/components/operation-mode/toggle.tsx
'use client'

import { useEffect, useState } from 'react'
import { requestWakeLock, releaseWakeLock } from '@/lib/operation-mode/wake-lock'
import { PinGate } from './pin-gate'

const STORAGE_KEY = 'ara:operation-mode'

export function OperationModeToggle() {
  const [enabled, setEnabled] = useState(false)
  const [showPinGate, setShowPinGate] = useState(false)

  useEffect(() => {
    setEnabled(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  useEffect(() => {
    if (enabled) {
      document.body.dataset.operation = 'on'
      void requestWakeLock()
    } else {
      document.body.removeAttribute('data-operation')
      void releaseWakeLock()
    }
  }, [enabled])

  function enable() {
    localStorage.setItem(STORAGE_KEY, '1')
    setEnabled(true)
  }

  function disable() {
    localStorage.removeItem(STORAGE_KEY)
    setEnabled(false)
    setShowPinGate(false)
  }

  return (
    <>
      {!enabled ? (
        <button
          onClick={enable}
          className="fixed bottom-4 right-4 rounded-full bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-[var(--color-primary-fg)] shadow-lg"
        >
          Modo Operação
        </button>
      ) : (
        <button
          onClick={() => setShowPinGate(true)}
          className="fixed bottom-4 right-4 rounded-full border bg-white px-4 py-2 text-xs font-medium shadow-lg"
        >
          Sair do modo
        </button>
      )}

      {showPinGate ? <PinGate onCancel={() => setShowPinGate(false)} onSuccess={disable} /> : null}
    </>
  )
}
```

- [ ] **Step 3: PinGate**

```tsx
// src/components/operation-mode/pin-gate.tsx
'use client'

import { useActionState } from 'react'
import { verifyOperationPinAction, type PinState } from '@/app/(salon)/dashboard/configuracoes/operacao/actions'

const INITIAL: PinState = {}

export function PinGate({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(verifyOperationPinAction, INITIAL)

  if (state.success) {
    // Dispara callback na próxima render
    queueMicrotask(onSuccess)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        action={action}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold">Digite o PIN</h2>
        <p className="mt-1 text-sm opacity-70">Somente o owner definiu esse PIN.</p>

        <input
          name="pin"
          type="text"
          inputMode="numeric"
          pattern="^\d{4}$"
          maxLength={4}
          required
          autoFocus
          className="mt-4 h-14 w-full rounded-md border px-3 text-center text-3xl tracking-[0.5em]"
        />

        {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="h-11 flex-1 rounded-md bg-[var(--color-primary)] font-medium text-[var(--color-primary-fg)]"
          >
            {pending ? 'Verificando...' : 'Sair do modo'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-md border px-4 text-sm"
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Injetar no layout do dashboard**

```tsx
// src/app/(salon)/dashboard/layout.tsx (trecho — adicionar OperationModeToggle)
import { OperationModeToggle } from '@/components/operation-mode/toggle'

// No return, dentro do div externo:
return (
  <>
    <ThemeInjector ... />
    <div className="min-h-screen" data-operation="off">
      {children}
      <OperationModeToggle />
    </div>
  </>
)
```

- [ ] **Step 5: CSS para esconder menus quando Modo Operação ativo**

Adicionar em `src/app/globals.css`:

```css
body[data-operation='on'] [data-hide-in-operation-mode] {
  display: none !important;
}
```

Qualquer componente de navegação secundária deve ter o atributo `data-hide-in-operation-mode`. No épico, adicionar ao header/nav do dashboard quando for criado.

- [ ] **Step 6: Commit**

```bash
git add src/lib/operation-mode/ src/components/operation-mode/ src/app/\(salon\)/dashboard/layout.tsx src/app/globals.css
git commit -m "feat(operacao): toggle + Wake Lock + PIN gate"
```

---

## Task 6: Service Worker mínimo + install prompt

**Files:**
- Create: `public/sw.js`
- Create: `src/components/pwa/sw-register.tsx`
- Create: `src/components/pwa/install-prompt.tsx`
- Modify: `src/app/(public)/layout.tsx` (incluir `<SwRegister />`)

- [ ] **Step 1: Service worker básico**

```js
// public/sw.js
const CACHE = 'ara-barber-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/icons/default-192.png', '/icons/default-512.png']),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Cache-first só para recursos estáticos
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
          return res
        })
      }),
    )
  }
})
```

- [ ] **Step 2: Client register**

```tsx
// src/components/pwa/sw-register.tsx
'use client'

import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignore
    })
  }, [])

  return null
}
```

- [ ] **Step 3: Install prompt**

```tsx
// src/components/pwa/install-prompt.tsx
'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!evt || dismissed) return null

  async function install() {
    if (!evt) return
    await evt.prompt()
    const { outcome } = await evt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    setEvt(null)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 rounded-lg bg-[var(--color-primary)] p-4 text-[var(--color-primary-fg)] shadow-lg md:left-auto md:w-80">
      <p className="text-sm font-medium">Instalar app</p>
      <p className="mt-1 text-xs opacity-80">
        Adicione à tela inicial para acesso rápido ao agendamento.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={install}
          className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-primary)]"
        >
          Instalar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md border border-white/30 px-3 py-1.5 text-xs"
        >
          Depois
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Injetar em `(public)/layout.tsx`**

```tsx
// src/app/(public)/layout.tsx (trecho — adicionar)
import { SwRegister } from '@/components/pwa/sw-register'
import { InstallPrompt } from '@/components/pwa/install-prompt'

// No return:
return (
  <>
    <ThemeInjector ... />
    <div className="min-h-screen ...">
      {children}
      <InstallPrompt />
    </div>
    <SwRegister />
  </>
)
```

- [ ] **Step 5: Ícones default**

Placeholder images em `public/icons/default-192.png` e `public/icons/default-512.png`. Pode ser um quadrado cinza com "A" branco no centro; substituir por design real mais tarde.

Gerar com Imagemagick (ou incluir dois PNGs estáticos no repo):

```bash
# Exemplo (pré-requisito: imagemagick)
convert -size 512x512 xc:'#111827' -fill white -gravity center -pointsize 280 -annotate 0 'A' public/icons/default-512.png
convert public/icons/default-512.png -resize 192x192 public/icons/default-192.png
```

Se não tiver imagemagick, criar os PNGs manualmente em qualquer editor. Comitar os dois.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js public/icons/ src/components/pwa/ src/app/\(public\)/layout.tsx
git commit -m "feat(pwa): service worker mínimo + install prompt + ícones default"
```

---

## Task 7: Sanity check

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm build
```

---

## Critério de aceitação do épico 8

- ✅ Realtime habilitado para `appointments` e `availability_blocks`.
- ✅ `LiveBoard` faz `router.refresh()` on-change; agenda atualiza sem F5.
- ✅ Modo Operação tem toggle persistente em `localStorage`, Wake Lock ativo quando ligado, PIN gate para sair.
- ✅ PIN armazenado como bcrypt em `tenants.operation_mode_pin_hash`, apenas owner configura.
- ✅ Service Worker registrado em prod, cache-first para static/icons.
- ✅ Install prompt aparece em Android via `beforeinstallprompt`.
- ✅ Ícones default presentes em `public/icons/`.

**Output:** experiência completa "app-like" — agenda viva, modo operação de tablet e PWA instalável. Próximo épico é audit log + hardening final.
