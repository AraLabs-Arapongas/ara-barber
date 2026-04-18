# Épico 2 — Tenants + Middleware + Branding + PWA Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o middleware funcional resolvendo tenant por host (subdomínio), habilitar branding dinâmico por tenant via CSS custom properties, implementar manifest PWA dinâmico por tenant, gerenciar storage de logos/ícones, e montar a página pública mínima do salão (home) consumindo branding.

**Architecture:** Middleware lê `host`, resolve `slug`, busca `tenants.id` via service-role (anon não tem acesso) com cache in-memory de 60s, e injeta em headers internos (`x-ara-tenant-id`, `x-ara-tenant-slug`, `x-ara-area`). Server components em `(public)/layout.tsx` e `(salon)/dashboard/layout.tsx` leem esse header e montam contexto de tenant (cores, logo, nome). Route handler `/api/manifest/[slug]/route.ts` gera manifest.webmanifest dinâmico. Logos ficam em Supabase Storage bucket público `tenant-assets`.

**Tech Stack:** Next.js 16 middleware + headers, `@supabase/ssr` service-role client, Supabase Storage, Web Manifest spec.

**Referência:** Spec — Seções 4.3 (resolução de tenant), 4.4 (DNS/hospedagem), 5.1 (branding em `tenants`), 7 (RLS), 11 (PWA), 13 (estrutura de código).

**Dependências:** Épicos 0 e 1.

---

## File Structure

```
ara-barber/
├── supabase/
│   └── migrations/
│       └── 0008_storage_buckets.sql          # Task 1
├── src/
│   ├── lib/
│   │   ├── tenant/
│   │   │   ├── resolve.ts                    # Task 2
│   │   │   ├── context.ts                    # Task 3
│   │   │   └── branding.ts                   # Task 4
│   │   └── pwa/
│   │       └── manifest.ts                   # Task 6
│   ├── middleware.ts                         # Task 5 (reescrito)
│   ├── components/
│   │   └── branding/
│   │       ├── theme-injector.tsx            # Task 4
│   │       └── tenant-logo.tsx               # Task 4
│   └── app/
│       ├── (public)/
│       │   ├── layout.tsx                    # Task 7
│       │   └── page.tsx                      # Task 7
│       ├── (salon)/
│       │   └── dashboard/
│       │       └── layout.tsx                # Task 8 (placeholder)
│       ├── (platform)/
│       │   └── platform/
│       │       └── layout.tsx                # Task 9 (placeholder)
│       └── api/
│           └── manifest/
│               └── [slug]/
│                   └── route.ts              # Task 6
└── tests/
    ├── unit/
    │   └── tenant/
    │       ├── resolve.test.ts               # Task 2
    │       └── branding.test.ts              # Task 4
    └── e2e/
        ├── tenant-resolution.spec.ts         # Task 10
        └── manifest.spec.ts                  # Task 10
```

---

## Task 1: Storage bucket para assets do tenant

**Files:**
- Create: `supabase/migrations/0008_storage_buckets.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new storage_buckets
```

Renomear para `0008_storage_buckets.sql`.

- [ ] **Step 2: Preencher**

```sql
-- supabase/migrations/0008_storage_buckets.sql

-- Bucket público para assets de tenant (logos, favicons, ícones PWA).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-assets',
  'tenant-assets',
  true,
  5 * 1024 * 1024, -- 5 MB
  array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon']
)
on conflict (id) do nothing;

-- Policies: upload apenas por platform admin e pelo owner do próprio tenant.
create policy "tenant_assets_public_read" on storage.objects
  for select
  using (bucket_id = 'tenant-assets');

create policy "tenant_assets_platform_admin_write" on storage.objects
  for insert
  with check (
    bucket_id = 'tenant-assets'
    and auth.is_platform_admin()
  );

create policy "tenant_assets_platform_admin_update" on storage.objects
  for update
  using (bucket_id = 'tenant-assets' and auth.is_platform_admin());

create policy "tenant_assets_platform_admin_delete" on storage.objects
  for delete
  using (bucket_id = 'tenant-assets' and auth.is_platform_admin());

-- Owner do tenant: upload em pasta que começa com tenantId do próprio usuário.
-- Convenção: objetos ficam em {tenantId}/{filename}.
create policy "tenant_assets_owner_write" on storage.objects
  for insert
  with check (
    bucket_id = 'tenant-assets'
    and auth.current_role() = 'SALON_OWNER'
    and (storage.foldername(name))[1]::uuid = auth.current_tenant_id()
  );

create policy "tenant_assets_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'tenant-assets'
    and auth.current_role() = 'SALON_OWNER'
    and (storage.foldername(name))[1]::uuid = auth.current_tenant_id()
  );
```

- [ ] **Step 3: Aplicar**

```bash
supabase db reset
```

- [ ] **Step 4: Verificar**

```bash
supabase db psql -c "select id, public, file_size_limit from storage.buckets where id = 'tenant-assets';"
```

Expected: 1 linha.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_storage_buckets.sql
git commit -m "feat(db): storage bucket tenant-assets + policies"
```

---

## Task 2: `lib/tenant/resolve.ts` + cache + teste

**Files:**
- Create: `src/lib/tenant/resolve.ts`
- Create: `tests/unit/tenant/resolve.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/tenant/resolve.test.ts
import { describe, it, expect } from 'vitest'
import { parseHostToSlug } from '@/lib/tenant/resolve'

describe('parseHostToSlug', () => {
  it('extrai slug de subdomínio de produção', () => {
    expect(parseHostToSlug('barbearia-joao.aralabs.com.br')).toEqual({
      area: 'tenant',
      slug: 'barbearia-joao',
    })
  })

  it('extrai slug de subdomínio lvh.me (dev)', () => {
    expect(parseHostToSlug('barbearia-joao.lvh.me')).toEqual({
      area: 'tenant',
      slug: 'barbearia-joao',
    })
  })

  it('identifica platform admin por host exato', () => {
    expect(parseHostToSlug('admin.aralabs.com.br')).toEqual({
      area: 'platform',
      slug: null,
    })
  })

  it('ignora porta', () => {
    expect(parseHostToSlug('barbearia-joao.lvh.me:3000')).toEqual({
      area: 'tenant',
      slug: 'barbearia-joao',
    })
  })

  it('retorna root quando host não matcha', () => {
    expect(parseHostToSlug('localhost:3000')).toEqual({ area: 'root', slug: null })
    expect(parseHostToSlug('aralabs.com.br')).toEqual({ area: 'root', slug: null })
  })

  it('rejeita slug inválido', () => {
    // slug precisa começar com letra/número e não pode ter '_'
    expect(parseHostToSlug('-foo.aralabs.com.br')).toEqual({ area: 'root', slug: null })
    expect(parseHostToSlug('foo_bar.aralabs.com.br')).toEqual({ area: 'root', slug: null })
  })
})
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pnpm test -- tests/unit/tenant/resolve.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/tenant/resolve.ts
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service-role'

const PLATFORM_HOST = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? 'admin.aralabs.com.br'
const APP_BASE_HOST = process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br'
const DEV_BASE_HOST = process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me'

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]$/

export type ParsedHost =
  | { area: 'platform'; slug: null }
  | { area: 'tenant'; slug: string }
  | { area: 'root'; slug: null }

export function parseHostToSlug(host: string): ParsedHost {
  const clean = host.split(':')[0].toLowerCase()
  if (clean === PLATFORM_HOST) return { area: 'platform', slug: null }

  for (const base of [APP_BASE_HOST, DEV_BASE_HOST]) {
    if (clean.endsWith(`.${base}`)) {
      const slug = clean.slice(0, -`.${base}`.length)
      if (!SLUG_REGEX.test(slug)) return { area: 'root', slug: null }
      return { area: 'tenant', slug }
    }
  }
  return { area: 'root', slug: null }
}

// Cache in-memory de 60s. Cold start do serverless limpa; OK para Fase 1.
const cache = new Map<string, { id: string | null; expires: number }>()
const TTL_MS = 60_000

export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(slug)
  if (cached && cached.expires > now) return cached.id

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('resolveTenantIdBySlug error', error)
    return null
  }

  const id = data?.id ?? null
  cache.set(slug, { id, expires: now + TTL_MS })
  return id
}

export function __resetTenantResolveCache() {
  cache.clear()
}
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pnpm test -- tests/unit/tenant/resolve.test.ts
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenant/resolve.ts tests/unit/tenant/resolve.test.ts
git commit -m "feat(tenant): parseHostToSlug + resolveTenantIdBySlug com cache"
```

---

## Task 3: `lib/tenant/context.ts`

**Files:**
- Create: `src/lib/tenant/context.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/tenant/context.ts
import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service-role'
import type { Database } from '@/lib/supabase/types'

export type TenantContext = {
  id: string
  slug: string
  name: string
  timezone: string
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  status: Database['public']['Enums']['tenant_status']
  billingStatus: Database['public']['Enums']['billing_status']
}

export async function getCurrentTenantId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-ara-tenant-id')
}

export async function getCurrentTenantSlug(): Promise<string | null> {
  const h = await headers()
  return h.get('x-ara-tenant-slug')
}

export async function getCurrentTenantOrNotFound(): Promise<TenantContext> {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) notFound()

  // Service role porque usuário anônimo também precisa ler branding do tenant.
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('tenants')
    .select(
      'id, slug, name, timezone, primary_color, secondary_color, accent_color, logo_url, favicon_url, status, billing_status',
    )
    .eq('id', tenantId)
    .maybeSingle()

  if (!data) notFound()

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    timezone: data.timezone,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    accentColor: data.accent_color,
    logoUrl: data.logo_url,
    faviconUrl: data.favicon_url,
    status: data.status,
    billingStatus: data.billing_status,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tenant/context.ts
git commit -m "feat(tenant): getCurrentTenant helpers (header + service-role)"
```

---

## Task 4: Branding helpers + componente theme injector

**Files:**
- Create: `src/lib/tenant/branding.ts`
- Create: `src/components/branding/theme-injector.tsx`
- Create: `src/components/branding/tenant-logo.tsx`
- Create: `tests/unit/tenant/branding.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/tenant/branding.test.ts
import { describe, it, expect } from 'vitest'
import {
  brandingToCssVars,
  contrastColor,
  sanitizeHexColor,
} from '@/lib/tenant/branding'

describe('sanitizeHexColor', () => {
  it('aceita #rrggbb', () => {
    expect(sanitizeHexColor('#ab34cd')).toBe('#ab34cd')
  })

  it('aceita #rgb e expande', () => {
    expect(sanitizeHexColor('#abc')).toBe('#aabbcc')
  })

  it('retorna null para formato inválido', () => {
    expect(sanitizeHexColor('red')).toBe(null)
    expect(sanitizeHexColor('#zzz')).toBe(null)
    expect(sanitizeHexColor(null)).toBe(null)
  })
})

describe('contrastColor', () => {
  it('retorna branco sobre fundo escuro', () => {
    expect(contrastColor('#000000')).toBe('#ffffff')
  })

  it('retorna preto sobre fundo claro', () => {
    expect(contrastColor('#ffffff')).toBe('#0f172a')
  })
})

describe('brandingToCssVars', () => {
  it('produz map completo com fallbacks quando cores são nulas', () => {
    const vars = brandingToCssVars({
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
    })
    expect(vars['--color-primary']).toBeTruthy()
    expect(vars['--color-primary-fg']).toBeTruthy()
  })

  it('aplica cores custom quando fornecidas', () => {
    const vars = brandingToCssVars({
      primaryColor: '#ff0000',
      secondaryColor: null,
      accentColor: null,
    })
    expect(vars['--color-primary']).toBe('#ff0000')
    expect(vars['--color-primary-fg']).toBe('#ffffff') // contraste
  })
})
```

- [ ] **Step 2: Rodar — falha**

```bash
pnpm test -- tests/unit/tenant/branding.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar `branding.ts`**

```ts
// src/lib/tenant/branding.ts
export type BrandingInput = {
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
}

const DEFAULTS = {
  primary: '#111827',
  secondary: '#6b7280',
  accent: '#2563eb',
}

const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX3_RE = /^#[0-9a-f]{3}$/i

export function sanitizeHexColor(input: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim().toLowerCase()
  if (HEX6_RE.test(trimmed)) return trimmed
  if (HEX3_RE.test(trimmed)) {
    const [_, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

/**
 * Calcula luminância relativa e escolhe texto preto ou branco.
 */
export function contrastColor(hex: string): string {
  const clean = sanitizeHexColor(hex) ?? DEFAULTS.primary
  const r = parseInt(clean.slice(1, 3), 16) / 255
  const g = parseInt(clean.slice(3, 5), 16) / 255
  const b = parseInt(clean.slice(5, 7), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? '#0f172a' : '#ffffff'
}

export function brandingToCssVars(input: BrandingInput): Record<string, string> {
  const primary = sanitizeHexColor(input.primaryColor) ?? DEFAULTS.primary
  const secondary = sanitizeHexColor(input.secondaryColor) ?? DEFAULTS.secondary
  const accent = sanitizeHexColor(input.accentColor) ?? DEFAULTS.accent

  return {
    '--color-primary': primary,
    '--color-primary-fg': contrastColor(primary),
    '--color-secondary': secondary,
    '--color-secondary-fg': contrastColor(secondary),
    '--color-accent': accent,
    '--color-accent-fg': contrastColor(accent),
  }
}
```

- [ ] **Step 4: Rodar — passa**

```bash
pnpm test -- tests/unit/tenant/branding.test.ts
```

Expected: 7 PASS.

- [ ] **Step 5: Componente `ThemeInjector`**

```tsx
// src/components/branding/theme-injector.tsx
import { brandingToCssVars, type BrandingInput } from '@/lib/tenant/branding'

export function ThemeInjector({ branding }: { branding: BrandingInput }) {
  const vars = brandingToCssVars(branding)
  const css = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')

  return (
    <style
      // eslint-disable-next-line react/no-danger -- valores sanitizados acima
      dangerouslySetInnerHTML={{
        __html: `:root{${css}}`,
      }}
    />
  )
}
```

- [ ] **Step 6: Componente `TenantLogo`**

```tsx
// src/components/branding/tenant-logo.tsx
import Image from 'next/image'

type Props = {
  logoUrl: string | null
  name: string
  size?: number
}

export function TenantLogo({ logoUrl, name, size = 48 }: Props) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-md object-contain"
        priority
      />
    )
  }

  return (
    <div
      className="flex items-center justify-center rounded-md bg-[var(--color-primary)] font-bold text-[var(--color-primary-fg)]"
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/tenant/branding.ts src/components/branding/ tests/unit/tenant/branding.test.ts
git commit -m "feat(branding): helpers de cor + ThemeInjector + TenantLogo"
```

---

## Task 5: Reescrever middleware com tenant resolution

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Substituir middleware**

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { parseHostToSlug, resolveTenantIdBySlug } from '@/lib/tenant/resolve'

const PLATFORM_LOGIN = '/login'

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const parsed = parseHostToSlug(host)

  const res = NextResponse.next()
  res.headers.set('x-ara-area', parsed.area)
  res.headers.set('x-ara-host', host)

  if (parsed.area === 'tenant' && parsed.slug) {
    const tenantId = await resolveTenantIdBySlug(parsed.slug)
    if (!tenantId) {
      // Tenant não existe → 404
      return new NextResponse('Salão não encontrado.', { status: 404 })
    }
    res.headers.set('x-ara-tenant-id', tenantId)
    res.headers.set('x-ara-tenant-slug', parsed.slug)
  }

  if (parsed.area === 'platform') {
    res.headers.set('x-ara-tenant-id', '')
    res.headers.set('x-ara-tenant-slug', '')
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
}
```

- [ ] **Step 2: Testar manualmente**

Com Supabase local rodando e dados do Épico 1 aplicados (tenant `barbearia-teste`):

```bash
pnpm dev
```

Em outra aba:

```bash
curl -H "Host: barbearia-teste.lvh.me" -I http://localhost:3000/
```

Expected: header `x-ara-tenant-id: 11111111-1111-1111-1111-111111111111` e `x-ara-tenant-slug: barbearia-teste`.

Testar tenant inexistente:

```bash
curl -H "Host: nao-existe.lvh.me" -I http://localhost:3000/
```

Expected: HTTP 404.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): resolve tenant por host e injeta headers"
```

---

## Task 6: Manifest PWA dinâmico

**Files:**
- Create: `src/lib/pwa/manifest.ts`
- Create: `src/app/api/manifest/[slug]/route.ts`

- [ ] **Step 1: Helper de manifest**

```ts
// src/lib/pwa/manifest.ts
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service-role'

export type TenantManifest = {
  name: string
  short_name: string
  description: string
  start_url: string
  scope: string
  display: 'standalone'
  background_color: string
  theme_color: string
  icons: Array<{
    src: string
    sizes: string
    type: string
    purpose?: string
  }>
  lang: string
  dir: 'ltr'
}

const DEFAULTS = {
  background: '#ffffff',
  theme: '#111827',
  icon192: '/icons/default-192.png',
  icon512: '/icons/default-512.png',
}

export async function buildManifestForSlug(slug: string): Promise<TenantManifest | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('tenants')
    .select('slug, name, primary_color, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return null

  const base = process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br'
  const origin = `https://${data.slug}.${base}`
  const themeColor = data.primary_color ?? DEFAULTS.theme

  return {
    name: data.name,
    short_name: data.name.slice(0, 12),
    description: `App do salão ${data.name}`,
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: DEFAULTS.background,
    theme_color: themeColor,
    icons: [
      {
        src: data.logo_url ?? DEFAULTS.icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: data.logo_url ?? DEFAULTS.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    lang: 'pt-BR',
    dir: 'ltr',
  }
}
```

- [ ] **Step 2: Route handler**

```ts
// src/app/api/manifest/[slug]/route.ts
import { NextResponse } from 'next/server'
import { buildManifestForSlug } from '@/lib/pwa/manifest'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const manifest = await buildManifestForSlug(slug)

  if (!manifest) {
    return new NextResponse('Not found', { status: 404 })
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pwa/manifest.ts src/app/api/manifest/
git commit -m "feat(pwa): manifest dinâmico por tenant via route handler"
```

---

## Task 7: Layout `(public)` + home do salão

**Files:**
- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/page.tsx`

- [ ] **Step 1: Layout `(public)`**

```tsx
// src/app/(public)/layout.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const slug = h.get('x-ara-tenant-slug')
  const tenant = await getCurrentTenantOrNotFound()

  return {
    title: tenant.name,
    description: `Agende seu horário no ${tenant.name}`,
    manifest: slug ? `/api/manifest/${slug}` : undefined,
    themeColor: tenant.primaryColor ?? '#111827',
    icons: tenant.faviconUrl ? [{ rel: 'icon', url: tenant.faviconUrl }] : undefined,
    appleWebApp: { title: tenant.name, capable: true, statusBarStyle: 'default' },
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
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
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
        {children}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Home do salão (PublicPage)**

Observação: a raiz `src/app/page.tsx` renderizou o fallback "ara-barber" no Épico 0. Agora, para subdomínios de tenant, a rota `/` cai em `(public)/page.tsx`. Mas como os dois estão na raiz (mesmo path `/`), precisamos decidir qual vence — route group `(public)` toma precedência quando existe. Para garantir, o `(public)/page.tsx` é servido quando middleware marca `x-ara-area: tenant`, e o `src/app/page.tsx` (raiz) só é servido quando não há tenant (acesso a `aralabs.com.br` cru).

**Nota do Next.js 16:** route groups não afetam path URL. Consultar context7 se houver conflito; pode ser necessário mover o fallback da raiz para uma página explícita ou usar middleware para rewrite.

Criar `src/app/(public)/page.tsx`:

```tsx
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { TenantLogo } from '@/components/branding/tenant-logo'
import Link from 'next/link'

export default async function PublicHomePage() {
  const tenant = await getCurrentTenantOrNotFound()

  if (tenant.billingStatus === 'SUSPENDED' || tenant.status !== 'ACTIVE') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Salão indisponível</h1>
          <p className="mt-2 opacity-70">
            Este salão está temporariamente fora do ar. Por favor, tente novamente mais tarde.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 p-6">
        <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} size={64} />
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="max-w-xs text-lg opacity-80">
          Agende seu horário em poucos toques.
        </p>
        <Link
          href="/book"
          className="h-12 rounded-md bg-[var(--color-primary)] px-6 font-medium text-[var(--color-primary-fg)] leading-[3rem]"
        >
          Agendar agora
        </Link>
      </section>

      <footer className="p-6 text-center text-xs opacity-60">
        Powered by Aralabs.
      </footer>
    </main>
  )
}
```

- [ ] **Step 3: Testar manualmente**

Com o Supabase rodando + tenant `barbearia-teste` seeded:

```bash
pnpm dev
```

Acessar `http://barbearia-teste.lvh.me:3000/`.

Expected: ver "Barbearia Teste" no header + CTA "Agendar agora".

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/
git commit -m "feat(public): layout e home do salão com branding dinâmico"
```

---

## Task 8: Placeholder de dashboard (`(salon)`)

**Files:**
- Create: `src/app/(salon)/dashboard/layout.tsx`
- Create: `src/app/(salon)/dashboard/page.tsx`

- [ ] **Step 1: Layout esqueleto**

```tsx
// src/app/(salon)/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ThemeInjector } from '@/components/branding/theme-injector'
import { assertStaff } from '@/lib/auth/guards'

export default async function SalonDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const tenant = await getCurrentTenantOrNotFound()
  await assertStaff({ expectedTenantId: tenant.id })

  return (
    <>
      <ThemeInjector
        branding={{
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
        }}
      />
      <div className="min-h-screen">{children}</div>
    </>
  )
}
```

- [ ] **Step 2: Página placeholder**

```tsx
// src/app/(salon)/dashboard/page.tsx
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

export default async function DashboardPage() {
  const tenant = await getCurrentTenantOrNotFound()
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Dashboard — {tenant.name}</h1>
      <p className="mt-2 text-sm opacity-70">
        Épicos 3+ vão preencher esta área (cadastros, agenda, etc).
      </p>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(salon\)/dashboard/
git commit -m "feat(salon): layout e placeholder do dashboard"
```

---

## Task 9: Placeholder de platform admin (`(platform)`)

**Files:**
- Create: `src/app/(platform)/platform/layout.tsx`
- Create: `src/app/(platform)/platform/page.tsx`

- [ ] **Step 1: Layout**

```tsx
// src/app/(platform)/platform/layout.tsx
import { redirect } from 'next/navigation'
import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await assertPlatformAdmin()
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    throw err
  }

  return <div className="min-h-screen">{children}</div>
}
```

- [ ] **Step 2: Página placeholder**

```tsx
// src/app/(platform)/platform/page.tsx
export default function PlatformHomePage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Aralabs — Platform</h1>
      <p className="mt-2 text-sm opacity-70">
        Épico 7 vai preencher esta área (tenants, plans, billing).
      </p>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/platform/
git commit -m "feat(platform): layout e placeholder"
```

---

## Task 10: E2E — tenant resolution + manifest

**Files:**
- Create: `e2e/tenant-resolution.spec.ts`
- Create: `e2e/manifest.spec.ts`

- [ ] **Step 1: Tenant resolution E2E**

```ts
// e2e/tenant-resolution.spec.ts
import { test, expect } from '@playwright/test'

test('home do tenant mostra o nome do salão', async ({ page, baseURL }) => {
  const url = baseURL!.replace('localhost', 'barbearia-teste.lvh.me')
  await page.goto(url)

  await expect(page.getByRole('heading', { name: 'Barbearia Teste' })).toBeVisible()
  await expect(page.getByRole('link', { name: /agendar/i })).toBeVisible()
})

test('tenant inexistente retorna 404', async ({ request, baseURL }) => {
  const url = baseURL!.replace('localhost', 'nao-existe-nunca.lvh.me')
  const res = await request.get(url)
  expect(res.status()).toBe(404)
})

test('middleware injeta header x-ara-tenant-id para tenant válido', async ({
  request,
  baseURL,
}) => {
  const url = baseURL!.replace('localhost', 'barbearia-teste.lvh.me')
  const res = await request.get(url)
  expect(res.headers()['x-ara-tenant-id']).toBeTruthy()
  expect(res.headers()['x-ara-tenant-slug']).toBe('barbearia-teste')
})
```

- [ ] **Step 2: Manifest E2E**

```ts
// e2e/manifest.spec.ts
import { test, expect } from '@playwright/test'

test('manifest dinâmico retorna JSON válido para tenant existente', async ({
  request,
  baseURL,
}) => {
  const url = new URL('/api/manifest/barbearia-teste', baseURL!)
  const res = await request.get(url.toString())
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/manifest+json')

  const json = await res.json()
  expect(json.name).toBe('Barbearia Teste')
  expect(json.display).toBe('standalone')
  expect(json.icons).toHaveLength(2)
})

test('manifest de tenant inexistente retorna 404', async ({ request, baseURL }) => {
  const url = new URL('/api/manifest/nao-existe', baseURL!)
  const res = await request.get(url.toString())
  expect(res.status()).toBe(404)
})
```

- [ ] **Step 3: Rodar E2E**

```bash
pnpm test:e2e
```

Expected: testes passam.

- [ ] **Step 4: Commit**

```bash
git add e2e/tenant-resolution.spec.ts e2e/manifest.spec.ts
git commit -m "test(e2e): tenant resolution + manifest dinâmico"
```

---

## Task 11: Sanity check

- [ ] **Step 1: Rodar tudo**

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm test:e2e && pnpm build
```

Expected: verde.

---

## Critério de aceitação do épico 2

- ✅ Storage bucket `tenant-assets` criado com policies (upload por owner em pasta do próprio tenant + platform admin em tudo).
- ✅ `parseHostToSlug` + `resolveTenantIdBySlug` (com cache 60s) implementados e testados.
- ✅ Middleware injeta `x-ara-tenant-id`, `x-ara-tenant-slug`, `x-ara-area`.
- ✅ Tenant inexistente retorna 404.
- ✅ `getCurrentTenantOrNotFound` usa service-role para permitir leitura anônima.
- ✅ `ThemeInjector` aplica CSS custom properties por tenant em runtime.
- ✅ Helpers de cor (`sanitizeHexColor`, `contrastColor`, `brandingToCssVars`) testados.
- ✅ Manifest dinâmico `/api/manifest/[slug]` retorna JSON válido.
- ✅ Home pública do tenant mostra logo/nome/CTA com cores do salão.
- ✅ Placeholders de `(salon)/dashboard` e `(platform)/platform` respeitam guards.
- ✅ E2E cobre tenant válido, tenant inexistente (404) e manifest.

**Output do épico:** app totalmente "tenant-aware" — subdomínios resolvem tenant, branding aplica, manifest PWA dinâmico funciona, páginas de cada área têm layout esqueleto pronto para receber conteúdo nos próximos épicos.
