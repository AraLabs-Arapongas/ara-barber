# Épico 0 — Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer a fundação do projeto ara-barber — Next.js 16 + Supabase + TypeScript + Tailwind 4 + infraestrutura de testes e CI — pronto para receber auth, tenants e features nos próximos épicos.

**Architecture:** Next.js 16 app (App Router) hospedado na Vercel, conectado a projeto Supabase (Postgres + Auth + Storage + Realtime). Middleware esqueleto para resolução futura de tenant por host. Toolchain inclui Supabase CLI para migrations versionadas, Vitest para unitários, Playwright para E2E, pgTAP para testes de RLS, GitHub Actions para CI.

**Tech Stack:** Next.js 16.x, React 19, TypeScript 5, Tailwind CSS 4, @supabase/supabase-js 2, @supabase/ssr 0.5, zod 3, vitest 2, @playwright/test 1, supabase CLI, pgTAP.

**Referência:** `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md` — Seções 4 (arquitetura), 5 (stack), 13 (estrutura de código), 14 (testes), 17 (CI/CD).

---

## Pré-requisitos do executor

Antes de começar:

- Node.js 20+ instalado (`node -v`).
- pnpm ou npm disponível (este plano usa **pnpm** — ajuste os comandos se usar npm/yarn).
- Git instalado e configurado.
- Conta Supabase criada (https://supabase.com).
- Conta Vercel criada (https://vercel.com).
- Docker Desktop rodando (para Supabase local).
- Supabase CLI instalado: `brew install supabase/tap/supabase`.
- Consulta a context7 MCP para docs atuais do Next.js 16 **antes** de escrever código — Next.js 16 tem breaking changes vs training data.

---

## File Structure

Este épico cria o esqueleto do repositório. Arquivos criados:

```
ara-barber/
├── package.json                          # Criado pela task 1
├── pnpm-lock.yaml                        # Criado pela task 1
├── tsconfig.json                         # Criado pela task 1
├── next.config.ts                        # Criado pela task 1
├── next-env.d.ts                         # Criado pela task 1 (auto)
├── postcss.config.mjs                    # Criado pela task 2
├── .env.local.example                    # Criado pela task 3
├── .prettierrc                           # Criado pela task 5
├── .eslintrc.json (ou eslint.config.mjs) # Criado pela task 5
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Task 1 (gerado), ajustado task 6
│   │   ├── page.tsx                      # Task 1 (gerado), simplificado task 6
│   │   └── globals.css                   # Task 2
│   ├── middleware.ts                     # Task 7 (esqueleto)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts                 # Task 8
│   │   │   ├── browser.ts                # Task 8
│   │   │   └── service-role.ts           # Task 8
│   │   └── utils/
│   │       └── env.ts                    # Task 9
│   └── styles/
│       └── tokens.css                    # Task 2
├── supabase/
│   ├── config.toml                       # Task 10 (supabase init)
│   ├── migrations/
│   │   └── (vazio, próximo épico cria)
│   ├── tests/
│   │   └── (vazio, próximos épicos criam)
│   └── seed.sql                          # Task 10
├── tests/
│   └── unit/
│       └── env.test.ts                   # Task 9
├── e2e/
│   └── smoke.spec.ts                     # Task 12
├── vitest.config.ts                      # Task 11
├── playwright.config.ts                  # Task 12
├── .github/
│   └── workflows/
│       └── ci.yml                        # Task 13
├── CLAUDE.md                             # Task 14
└── README.md                             # Task 14
```

Arquivo já existente:
- `.gitignore` (criado na sessão de brainstorming)
- `docs/superpowers/specs/...` (criado na sessão de brainstorming)
- `docs/superpowers/plans/...` (este arquivo e os outros épicos)

---

## Task 1: Scaffolding Next.js 16

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Consultar context7 sobre Next.js 16 App Router**

Usar o MCP `context7` para resolver a library `next` e buscar documentação sobre `create-next-app` e convenções do App Router em Next.js 16. Anotar diferenças vs versões anteriores (principalmente: Server Components por default, route groups, parallel routes, middleware).

- [ ] **Step 2: Scaffold do projeto Next.js**

No diretório `ara-barber/` rodar:

```bash
pnpm create next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --use-pnpm --no-eslint
```

Confirmar:
- TypeScript: yes
- Tailwind: yes
- App Router: yes
- src/ directory: yes
- ESLint: **no** (vamos configurar manualmente na task 5)

Se o comando reclamar de diretório não vazio, rodar em um tmp e mover arquivos manualmente.

- [ ] **Step 3: Verificar que build roda**

```bash
pnpm install
pnpm dev
```

Expected: servidor em `http://localhost:3000` carrega página inicial Next.js sem erros. Parar com Ctrl+C.

- [ ] **Step 4: Fixar versões principais**

Editar `package.json` para garantir versões esperadas. O comando `create-next-app` já usa versões atuais; confirmar que:

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Se vier versão diferente, atualizar com `pnpm add next@latest react@latest react-dom@latest`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold next.js 16 + react 19 + tailwind 4"
```

---

## Task 2: Tailwind 4 com tokens CSS

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/styles/tokens.css`
- Modify: `postcss.config.mjs` (se necessário)

- [ ] **Step 1: Criar arquivo de tokens**

Criar `src/styles/tokens.css`:

```css
/*
 * CSS custom properties neutras — valores default do theme Aralabs.
 * O layout (public) e (salon) sobrescreve --color-primary/secondary/accent
 * com os valores do tenant atual em runtime.
 */
:root {
  --color-primary: #111827;
  --color-primary-fg: #ffffff;
  --color-secondary: #6b7280;
  --color-accent: #2563eb;
  --color-bg: #ffffff;
  --color-fg: #0f172a;
  --color-muted: #f3f4f6;
  --color-border: #e5e7eb;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  --spacing-touch: 2.75rem; /* 44px — target touch mínimo */
}
```

- [ ] **Step 2: Ajustar globals.css**

Substituir o conteúdo de `src/app/globals.css` por:

```css
@import "tailwindcss";
@import "../styles/tokens.css";

@theme {
  --color-primary: var(--color-primary);
  --color-primary-fg: var(--color-primary-fg);
  --color-secondary: var(--color-secondary);
  --color-accent: var(--color-accent);
  --color-bg: var(--color-bg);
  --color-fg: var(--color-fg);
  --color-muted: var(--color-muted);
  --color-border: var(--color-border);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
}

html, body {
  background: var(--color-bg);
  color: var(--color-fg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html, body, #__next {
  height: 100%;
}
```

- [ ] **Step 3: Verificar build**

```bash
pnpm dev
```

Abrir `http://localhost:3000` — cores devem seguir os tokens (fundo branco, texto escuro). Parar com Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/styles/
git commit -m "style: configura tailwind 4 com tokens CSS neutros"
```

---

## Task 3: Variáveis de ambiente

**Files:**
- Create: `.env.local.example`
- Create: `.env.local` (não comitar)

- [ ] **Step 1: Criar `.env.local.example`**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Hosts
NEXT_PUBLIC_APP_BASE_HOST=aralabs.com.br
NEXT_PUBLIC_PLATFORM_HOST=admin.aralabs.com.br
NEXT_PUBLIC_DEV_BASE_HOST=lvh.me

# Env marker (development | preview | production)
NEXT_PUBLIC_ENV=development
```

- [ ] **Step 2: Criar `.env.local` localmente (não comitado)**

Copiar `.env.local.example` para `.env.local`. Os valores de Supabase serão preenchidos na Task 10.

```bash
cp .env.local.example .env.local
```

- [ ] **Step 3: Verificar `.gitignore`**

Conferir que `.env.local` está listado em `.gitignore`. Rodar:

```bash
git check-ignore .env.local
```

Expected: saída imprime `.env.local` (significa que está ignorado). Se não aparecer, adicionar no `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git add .env.local.example
git commit -m "chore: adiciona .env.local.example"
```

---

## Task 4: Dependências principais (@supabase + zod)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Adicionar deps de runtime**

```bash
pnpm add @supabase/supabase-js @supabase/ssr zod date-fns date-fns-tz nanoid lucide-react
```

- [ ] **Step 2: Adicionar deps de dev**

```bash
pnpm add -D @types/node vitest @vitejs/plugin-react happy-dom @testing-library/react @testing-library/jest-dom @playwright/test prettier eslint@9 eslint-config-next typescript-eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

- [ ] **Step 3: Verificar `package.json` final**

Ler `package.json` e confirmar que as duas listas acima foram adicionadas. `next`, `react`, `react-dom`, `tailwindcss` e `@tailwindcss/postcss` devem já estar lá do scaffold.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: adiciona supabase, zod, vitest, playwright e lint deps"
```

---

## Task 5: Lint + format

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Criar `eslint.config.mjs`**

```js
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    ignores: [
      "node_modules",
      ".next",
      "out",
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
    ],
  },
];
```

- [ ] **Step 2: Criar `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": []
}
```

- [ ] **Step 3: Adicionar scripts ao `package.json`**

Adicionar em `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:rls": "supabase db test"
  }
}
```

- [ ] **Step 4: Rodar lint e corrigir**

```bash
pnpm lint
```

Se houver erros residuais do scaffold, rodar:

```bash
pnpm lint:fix
pnpm format
```

Expected: `pnpm lint` termina sem erros.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs .prettierrc package.json
git commit -m "chore: configura eslint 9 + prettier + scripts"
```

---

## Task 6: Simplificar layout raiz e home

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Substituir `layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ara-barber',
  description: 'SaaS multi-tenant para barbearias e salões',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111827',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Substituir `page.tsx`**

```tsx
export default function RootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">ara-barber</h1>
        <p className="mt-2 text-sm opacity-70">
          Esta é a raiz. A aplicação responde por subdomínio.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Rodar e verificar**

```bash
pnpm dev
```

Abrir `http://localhost:3000` — ver a tela limpa com "ara-barber".

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "chore: simplifica layout raiz e home"
```

---

## Task 7: Middleware esqueleto

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Criar middleware esqueleto**

O tenant resolution completo vem no Épico 2. Neste épico cria-se apenas o esqueleto com logging que identifica a área com base no host, sem fazer queries ainda.

```ts
import { NextResponse, type NextRequest } from 'next/server'

const PLATFORM_HOST = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? 'admin.aralabs.com.br'
const APP_BASE_HOST = process.env.NEXT_PUBLIC_APP_BASE_HOST ?? 'aralabs.com.br'
const DEV_BASE_HOST = process.env.NEXT_PUBLIC_DEV_BASE_HOST ?? 'lvh.me'

function resolveArea(host: string): 'platform' | 'tenant' | 'root' {
  if (host === PLATFORM_HOST) return 'platform'
  if (host.endsWith(`.${APP_BASE_HOST}`)) return 'tenant'
  if (host.endsWith(`.${DEV_BASE_HOST}`)) return 'tenant'
  return 'root'
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const area = resolveArea(host.split(':')[0])

  const res = NextResponse.next()
  res.headers.set('x-ara-area', area)
  res.headers.set('x-ara-host', host)
  return res
}

export const config = {
  matcher: [
    /*
     * Match todos os paths exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagem)
     * - favicon.ico
     * - api/health (se existir)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
}
```

- [ ] **Step 2: Rodar e verificar headers**

Rodar `pnpm dev` e testar:

```bash
curl -I http://localhost:3000/ | grep ara
```

Expected: ver header `x-ara-area: root`.

Testar subdomínio dev:

```bash
curl -H "Host: teste.lvh.me" -I http://localhost:3000/
```

Expected: ver header `x-ara-area: tenant`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware esqueleto que identifica área por host"
```

---

## Task 8: Clientes Supabase (server / browser / service-role)

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/service-role.ts`

- [ ] **Step 1: Consultar context7 sobre `@supabase/ssr`**

Usar MCP `context7` para documentação atual de `@supabase/ssr` e confirmar assinaturas de `createServerClient`, `createBrowserClient`. Confirmar como passar cookies em Next.js 16 App Router.

- [ ] **Step 2: Criar cliente browser**

```ts
// src/lib/supabase/browser.ts
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 3: Criar cliente server (com cookies)**

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Ignorado em contexto de server component (read-only).
            // Necessário em server actions e route handlers.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 4: Criar cliente service-role**

```ts
// src/lib/supabase/service-role.ts
import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com SERVICE ROLE — ignora RLS. Uso apenas em jobs, webhooks,
 * leituras públicas intencionais ou operações administrativas. Nunca no
 * cliente, nunca exposto via API.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
```

- [ ] **Step 5: Instalar `server-only`**

```bash
pnpm add server-only
```

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/ package.json pnpm-lock.yaml
git commit -m "feat: clientes supabase (browser, server, service-role)"
```

---

## Task 9: Helper de env + teste unitário

**Files:**
- Create: `src/lib/utils/env.ts`
- Create: `tests/unit/env.test.ts`

- [ ] **Step 1: Escrever teste que falha**

Criar `tests/unit/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireEnv } from '@/lib/utils/env'

describe('requireEnv', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL }
  })

  afterEach(() => {
    process.env = ORIGINAL
  })

  it('retorna o valor quando a variável está definida', () => {
    process.env.TEST_VAR = 'hello'
    expect(requireEnv('TEST_VAR')).toBe('hello')
  })

  it('lança erro quando a variável está ausente', () => {
    delete process.env.TEST_VAR
    expect(() => requireEnv('TEST_VAR')).toThrow(/Missing env var TEST_VAR/)
  })

  it('lança erro quando a variável é string vazia', () => {
    process.env.TEST_VAR = ''
    expect(() => requireEnv('TEST_VAR')).toThrow(/Missing env var TEST_VAR/)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
pnpm test -- tests/unit/env.test.ts
```

Expected: FAIL com erro de importação (módulo não existe).

- [ ] **Step 3: Implementar `env.ts`**

Criar `src/lib/utils/env.ts`:

```ts
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.length === 0) {
    throw new Error(`Missing env var ${name}`)
  }
  return value
}

export const env = {
  supabaseUrl: () => requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  appBaseHost: () => requireEnv('NEXT_PUBLIC_APP_BASE_HOST'),
  platformHost: () => requireEnv('NEXT_PUBLIC_PLATFORM_HOST'),
  devBaseHost: () => requireEnv('NEXT_PUBLIC_DEV_BASE_HOST'),
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
pnpm test -- tests/unit/env.test.ts
```

Expected: PASS — 3 testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/env.ts tests/unit/env.test.ts
git commit -m "feat: helper requireEnv com testes unitários"
```

---

## Task 10: Supabase local + migrations bootstrap

**Files:**
- Create: `supabase/config.toml` (pelo comando `supabase init`)
- Create: `supabase/seed.sql`
- Modify: `.env.local` (não comitar)

- [ ] **Step 1: Inicializar projeto Supabase**

No root do projeto:

```bash
supabase init
```

Expected: cria pasta `supabase/` com `config.toml`, `seed.sql` vazio, `.gitignore` próprio.

- [ ] **Step 2: Ajustar `supabase/config.toml`**

Abrir `supabase/config.toml` e confirmar que tem pelo menos:

```toml
[api]
enabled = true
port = 54321

[db]
port = 54322

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "http://*.lvh.me:3000/**"]
jwt_expiry = 3600
enable_signup = true
```

Ajustar diferenças que aparecerem; manter o resto como padrão.

- [ ] **Step 3: Subir Supabase local**

```bash
supabase start
```

Expected: primeira vez baixa imagens Docker (pode demorar). Ao final imprime:
- API URL: `http://localhost:54321`
- DB URL: `postgresql://postgres:postgres@localhost:54322/postgres`
- Studio URL: `http://localhost:54323`
- **anon key** e **service_role key**

- [ ] **Step 4: Preencher `.env.local` com credenciais locais**

Copiar anon key e service_role key do output acima para `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key do output>
NEXT_PUBLIC_APP_BASE_HOST=aralabs.com.br
NEXT_PUBLIC_PLATFORM_HOST=admin.aralabs.com.br
NEXT_PUBLIC_DEV_BASE_HOST=lvh.me
NEXT_PUBLIC_ENV=development
```

- [ ] **Step 5: Verificar `seed.sql` existe**

Confirmar que `supabase/seed.sql` existe (pode estar vazio). O próximo épico vai popular.

- [ ] **Step 6: Commit (sem incluir keys)**

```bash
git add supabase/config.toml supabase/seed.sql supabase/.gitignore
git commit -m "chore: bootstrap supabase local (config + seed vazio)"
```

---

## Task 11: Configurar Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'supabase/**', '.next/**'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Criar `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Rodar testes**

```bash
pnpm test
```

Expected: roda `tests/unit/env.test.ts` e passa (3 testes).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "chore: configura vitest + setup de testes"
```

---

## Task 12: Configurar Playwright + smoke E2E

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Instalar browsers do Playwright**

```bash
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Criar `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 3: Escrever smoke test**

Criar `e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('home page carrega e mostra o nome do produto', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ara-barber' })).toBeVisible()
})

test('middleware marca header x-ara-area', async ({ request }) => {
  const res = await request.get('/')
  expect(res.headers()['x-ara-area']).toBe('root')
})
```

- [ ] **Step 4: Rodar smoke**

```bash
pnpm test:e2e
```

Expected: dois testes PASS em chromium e mobile-safari (4 total).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts
git commit -m "test: configura playwright + smoke E2E"
```

---

## Task 13: GitHub Actions — CI básico

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Criar workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: Lint + Typecheck + Unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test

  e2e:
    name: Playwright smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
          SUPABASE_SERVICE_ROLE_KEY: dummy
          NEXT_PUBLIC_APP_BASE_HOST: aralabs.com.br
          NEXT_PUBLIC_PLATFORM_HOST: admin.aralabs.com.br
          NEXT_PUBLIC_DEV_BASE_HOST: lvh.me
          NEXT_PUBLIC_ENV: test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: github actions com lint/typecheck/unit/e2e"
```

---

## Task 14: CLAUDE.md + README.md

**Files:**
- Create: `CLAUDE.md`
- Create: `README.md`

- [ ] **Step 1: Criar `CLAUDE.md`**

```markdown
# ara-barber — Guia para Agents

## Antes de escrever código

1. **Consulte context7** (MCP) para documentação atual de Next.js 16, Tailwind 4 e `@supabase/ssr`. Essas libs estão depois do training-cutoff e têm breaking changes.
2. **Use o MCP `supabase`** para gerar migrations, aplicar schema e gerar tipos TypeScript. Evite SQL manual.
3. **Leia o spec primeiro:** `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md`.

## Convenções do projeto

- **Mobile-first + PWA app-like.** Toda UI nasce pensada em celular; PWA é core, não extra.
- **RLS do Postgres é isolamento primário.** Middleware e validação de app são defesa em profundidade.
- **Server Actions default.** Route Handlers (`/api/*`) só quando Server Action não serve (manifest dinâmico, webhooks).
- **3 clientes Supabase:**
  - `createClient()` (browser) — client components.
  - `createClient()` (server) — server components, server actions, route handlers.
  - `createServiceClient()` — jobs, leitura pública, bypass de RLS. **Server-only**.
- **Nunca confiar em `tenantId` vindo do cliente** — usar sempre o resolvido pelo middleware.
- **Toda mutation passa por Zod** antes de tocar o banco.
- **Toda tabela com `tenantId` tem 4 policies RLS** (platform admin / staff / customer read / customer write) e teste pgTAP correspondente.

## Comandos principais

\```bash
pnpm dev              # Next.js dev server
pnpm test             # Vitest (unit)
pnpm test:e2e         # Playwright
pnpm test:rls         # pgTAP (quando épico 1 adicionar)
pnpm lint             # ESLint
pnpm typecheck        # TSC
supabase start        # Supabase local (Docker)
supabase db push      # Aplicar migrations
supabase gen types typescript --local > src/lib/supabase/types.ts
\```

## Arquitetura (resumo)

- 1 Next.js app, 3 áreas lógicas: `(public)/`, `(salon)/`, `(platform)/` — separadas por route groups e middleware de host.
- Middleware resolve tenant por host (subdomínio `.aralabs.com.br` ou `.lvh.me` em dev).
- Platform admin mora em `admin.aralabs.com.br` (sem tenant).
- Supabase: Postgres + Auth + Storage + Realtime + pg_cron.
- Billing parametrizado em DB (trial + assinatura + taxa por transação); na Fase 1 sem cobrança real.

## Fases

- Fase 1 (atual): Core operável sem pagamento real.
- Fase 2+: Pagamento, comunicação, premium.
```

- [ ] **Step 2: Criar `README.md`**

```markdown
# ara-barber

SaaS multi-tenant para barbearias e salões — Fase 1 (Core Operável).

## Setup local

### Pré-requisitos
- Node.js 20+
- pnpm 9+
- Docker Desktop rodando
- Supabase CLI: `brew install supabase/tap/supabase`

### Instalação

\```bash
pnpm install
cp .env.local.example .env.local
supabase start
# copiar anon key e service_role key para .env.local
pnpm dev
\```

Acessar `http://localhost:3000`.

Para testar subdomínios em dev, acessar `http://qualquercoisa.lvh.me:3000` (lvh.me resolve para 127.0.0.1 com qualquer subdomain).

### Comandos

\```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm lint             # ESLint
pnpm typecheck        # TypeScript check
supabase db push      # aplicar migrations
\```

## Estrutura

Ver [CLAUDE.md](./CLAUDE.md) para guia de arquitetura e convenções.

Ver [docs/superpowers/specs/](./docs/superpowers/specs/) para specs de produto.

Ver [docs/superpowers/plans/](./docs/superpowers/plans/) para planos de implementação por épico.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: adiciona CLAUDE.md e README.md"
```

---

## Task 15: Sanity check final

- [ ] **Step 1: Rodar tudo em sequência**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Expected: todos passam sem erro.

- [ ] **Step 2: Rodar E2E com Supabase rodando**

```bash
supabase status   # confirma que está up
pnpm test:e2e
```

Expected: smoke tests passam.

- [ ] **Step 3: Verificar estrutura de pastas**

Listar o projeto:

```bash
tree -L 3 -I "node_modules|.next|.git" .
```

Conferir que o layout segue o spec (seção 13.1).

- [ ] **Step 4: Commit final (se houver alterações residuais)**

```bash
git status
# se houver mudanças de auto-format ou lint:
git add .
git commit -m "chore: sanity check final do bootstrap"
```

---

## Critério de aceitação do épico 0

- ✅ Projeto Next.js 16 + React 19 + TypeScript + Tailwind 4 scaffold completo.
- ✅ Supabase local rodando com `supabase start`; anon/service keys em `.env.local`.
- ✅ Middleware esqueleto identifica área (platform/tenant/root) por host.
- ✅ 3 clientes Supabase definidos (browser, server, service-role).
- ✅ Vitest + 3 testes unitários passam.
- ✅ Playwright + 2 smoke E2E passam em chromium e mobile-safari.
- ✅ ESLint + Prettier configurados, `pnpm lint` e `pnpm format:check` limpos.
- ✅ `pnpm typecheck` e `pnpm build` limpos.
- ✅ CI do GitHub Actions verde.
- ✅ `CLAUDE.md` e `README.md` documentam as convenções.
- ✅ Git limpo na `main`, ~12 commits pequenos.

**Output do épico:** projeto que roda, builda, testa e está pronto para receber migrations de schema + auth no Épico 1.
