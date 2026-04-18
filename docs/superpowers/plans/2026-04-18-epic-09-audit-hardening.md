# Épico 9 — Audit Log + Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar tabela `audit_log` com triggers automáticos nas entidades sensíveis (appointments, tenants, user_profiles, plans), endurecer segurança (headers, CSP), adicionar error boundaries e rate limit mínimo, criar GitHub Action de backup semanal do banco, E2E de regressão para os fluxos principais.

**Architecture:** `audit_log` armazena (tenantId?, userId?, action, entityType, entityId, beforeJson, afterJson, createdAt). Trigger genérico `log_audit_change()` é anexado às tabelas sensíveis — capture nome da tabela, nome da operação (INSERT/UPDATE/DELETE), `auth.uid()`, e snapshots `row_to_json(OLD)` / `row_to_json(NEW)`. Headers de segurança (CSP, HSTS, X-Frame-Options) via Next.js middleware/config. Backup via GitHub Actions cron rodando `pg_dump` contra URL de produção + upload para Cloudflare R2 ou S3.

**Tech Stack:** Postgres triggers, Next.js `next.config.ts` headers, GitHub Actions cron, `pg_dump`, AWS CLI / rclone.

**Referência:** Spec — Seções 15 (segurança), 16.2 (audit log), 15.6 (backup).

**Dependências:** Épicos 0–8.

---

## File Structure

```
ara-barber/
├── supabase/
│   └── migrations/
│       ├── 0022_audit_log.sql
│       └── 0023_audit_triggers.sql
├── src/
│   ├── app/
│   │   ├── error.tsx                       # error boundary global
│   │   └── not-found.tsx                   # já existe
│   └── components/
│       └── errors/
│           └── error-card.tsx
├── next.config.ts                           # Task 3 — headers
├── .github/workflows/
│   └── backup.yml                           # Task 6
└── e2e/
    ├── regression/
    │   ├── onboarding.spec.ts
    │   ├── booking-flow.spec.ts
    │   └── status-transitions.spec.ts
```

---

## Task 1: Migration — tabela `audit_log`

**Files:**
- Create: `supabase/migrations/0022_audit_log.sql`

- [ ] **Step 1: Criar**

```bash
supabase migration new audit_log
```

```sql
-- supabase/migrations/0022_audit_log.sql

create table public.audit_log (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,             -- 'INSERT' | 'UPDATE' | 'DELETE'
  entity_type text not null,        -- 'appointments' | 'tenants' | ...
  entity_id text,                   -- id da linha afetada (texto para cobrir FKs compostas)
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_user_idx on public.audit_log (user_id);

alter table public.audit_log enable row level security;

-- Platform admin lê tudo
create policy "audit_log_platform_admin_read" on public.audit_log
  for select using (auth.is_platform_admin());

-- Staff do tenant lê apenas do próprio tenant
create policy "audit_log_tenant_staff_read" on public.audit_log
  for select using (tenant_id = auth.current_tenant_id());

-- Writes apenas via trigger (definer). Sem policies de INSERT permitindo cliente direto.
```

- [ ] **Step 2: Aplicar + commit**

```bash
supabase db reset
git add supabase/migrations/0022_audit_log.sql
git commit -m "feat(db): tabela audit_log + policies de leitura"
```

---

## Task 2: Migration — triggers genéricos

**Files:**
- Create: `supabase/migrations/0023_audit_triggers.sql`

- [ ] **Step 1: Criar**

```bash
supabase migration new audit_triggers
```

```sql
-- supabase/migrations/0023_audit_triggers.sql

-- Função genérica de audit, anexável a qualquer tabela.
-- Assume que a tabela tem coluna tenant_id (pode ser null).
create or replace function public.log_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_tenant := (row_to_json(old)::jsonb)->>'tenant_id';
    v_entity_id := (row_to_json(old)::jsonb)->>'id';
    v_before := to_jsonb(old);
    v_after := null;
  elsif tg_op = 'INSERT' then
    v_tenant := (row_to_json(new)::jsonb)->>'tenant_id';
    v_entity_id := (row_to_json(new)::jsonb)->>'id';
    v_before := null;
    v_after := to_jsonb(new);
  else
    v_tenant := (row_to_json(new)::jsonb)->>'tenant_id';
    v_entity_id := (row_to_json(new)::jsonb)->>'id';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  end if;

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, before_json, after_json)
  values (
    case when v_tenant ~ '^[0-9a-f-]{36}$' then v_tenant::uuid else null end,
    auth.uid(),
    tg_op,
    tg_table_name,
    v_entity_id,
    v_before,
    v_after
  );

  return coalesce(new, old);
end $$;

-- Entidades com audit
create trigger appointments_audit
  after insert or update or delete on public.appointments
  for each row execute function public.log_audit_change();

create trigger tenants_audit
  after insert or update or delete on public.tenants
  for each row execute function public.log_audit_change();

create trigger user_profiles_audit
  after insert or update or delete on public.user_profiles
  for each row execute function public.log_audit_change();

create trigger plans_audit
  after insert or update or delete on public.plans
  for each row execute function public.log_audit_change();
```

- [ ] **Step 2: Aplicar + commit**

```bash
supabase db reset
git add supabase/migrations/0023_audit_triggers.sql
git commit -m "feat(db): triggers genéricos de audit_log em entidades sensíveis"
```

---

## Task 3: Headers de segurança

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Configurar headers**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321'

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `connect-src 'self' ${supabaseOrigin} wss://*.supabase.co https://*.supabase.co`,
      "img-src 'self' https: data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'", // Tailwind + CSS vars inline
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js dev + inline theme
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Verificar CSP em dev**

```bash
pnpm dev
curl -I http://localhost:3000/ | grep -i content-security-policy
```

Expected: header presente.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "security: headers CSP, HSTS, X-Frame-Options, Permissions-Policy"
```

---

## Task 4: Error boundary global + página de erro

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/components/errors/error-card.tsx`

- [ ] **Step 1: Error card reutilizável**

```tsx
// src/components/errors/error-card.tsx
'use client'

export function ErrorCard({
  title = 'Algo deu errado',
  description = 'Tente recarregar a página. Se continuar, avise o suporte.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm opacity-70">{description}</p>
        {onRetry ? (
          <button
            onClick={onRetry}
            className="h-11 rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)]"
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: App-level error boundary**

```tsx
// src/app/error.tsx
'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/errors/error-card'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Logging estruturado para console (Vercel capta).
    console.error('[GlobalError]', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return <ErrorCard onRetry={reset} />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/error.tsx src/components/errors/
git commit -m "feat(errors): error boundary global + card reutilizável"
```

---

## Task 5: Rate limit básico no login

**Files:**
- Create: `src/lib/utils/rate-limit.ts`
- Modify: `src/app/(salon)/login/actions.ts` e `src/app/(platform)/login/actions.ts` (consumir)

**Nota:** Implementação simples em memória (process-level). Para prod com múltiplos workers/edge, trocar por Redis/Upstash no futuro. Fase 1 = melhor que nada.

- [ ] **Step 1: Implementar**

```ts
// src/lib/utils/rate-limit.ts
import 'server-only'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (b.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  b.count += 1
  return { allowed: true, remaining: limit - b.count }
}
```

- [ ] **Step 2: Consumir em login do salão**

```ts
// src/app/(salon)/login/actions.ts (modificar loginStaffAction)
import { rateLimit } from '@/lib/utils/rate-limit'
import { headers } from 'next/headers'

export async function loginStaffAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const email = String(formData.get('email') ?? '')

  const { allowed } = rateLimit(`login:salon:${ip}:${email}`, 5, 60_000)
  if (!allowed) return { error: 'Muitas tentativas. Tente novamente em 1 minuto.' }

  const parsed = loginSchema.safeParse({
    email,
    password: formData.get('password'),
  })
  // ... resto igual ...
}
```

Repetir a mesma mudança em `src/app/(platform)/login/actions.ts` (chave `login:platform:...`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/rate-limit.ts src/app/\(salon\)/login/actions.ts src/app/\(platform\)/login/actions.ts
git commit -m "security: rate limit básico em login (5 tentativas/min por IP+email)"
```

---

## Task 6: Backup semanal via GitHub Actions

**Files:**
- Create: `.github/workflows/backup.yml`

**Nota:** Só funciona quando tiver tenant real em produção + secrets configurados. Hoje, só ativar o workflow depois do primeiro cliente.

- [ ] **Step 1: Workflow**

```yaml
# .github/workflows/backup.yml
name: Supabase Weekly Backup

on:
  schedule:
    - cron: '0 4 * * 0'   # toda semana, domingo 04:00 UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install PostgreSQL client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client

      - name: Dump database
        env:
          DATABASE_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          TIMESTAMP=$(date -u +"%Y-%m-%dT%H%M%SZ")
          FILE="backup-${TIMESTAMP}.sql.gz"
          echo "Dumping into $FILE"
          pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip > "$FILE"
          ls -lh "$FILE"
          echo "BACKUP_FILE=$FILE" >> $GITHUB_ENV

      - name: Upload to Cloudflare R2
        uses: shallwefootball/s3-upload-action@v1.3.3
        with:
          aws_key_id: ${{ secrets.R2_ACCESS_KEY_ID }}
          aws_secret_access_key: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          aws_bucket: ${{ secrets.R2_BUCKET }}
          source_dir: .
          destination_dir: ara-barber-backups
          endpoint: ${{ secrets.R2_ENDPOINT }}
```

**Secrets necessários (configurar no Settings → Secrets do repo antes de ativar):**
- `SUPABASE_DB_URL` — string `postgres://postgres:...@db.xxx.supabase.co:5432/postgres`.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/backup.yml
git commit -m "ci: backup semanal do Supabase para Cloudflare R2"
```

---

## Task 7: E2E de regressão (fluxos principais)

**Files:**
- Create: `e2e/regression/onboarding.spec.ts`
- Create: `e2e/regression/booking-flow.spec.ts`
- Create: `e2e/regression/status-transitions.spec.ts`

- [ ] **Step 1: E2E de onboarding**

```ts
// e2e/regression/onboarding.spec.ts
import { test, expect } from '@playwright/test'

// Pré-requisito: platform admin seedado e plano default ativo.
test('platform admin cria novo tenant + owner é convidado', async ({ page, baseURL }) => {
  const adminUrl = baseURL!.replace('localhost', 'admin.lvh.me')

  // Login platform admin
  await page.goto(`${adminUrl}/login`)
  await page.getByLabel('E-mail').fill('admin@aralabs.test')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: /entrar/i }).click()

  await expect(page).toHaveURL(/\/platform/)

  // Criar tenant
  await page.goto(`${adminUrl}/platform/tenants/new`)
  const slug = `test-${Date.now()}`
  await page.getByLabel('Nome do salão').fill('Salão E2E')
  await page.getByLabel('Slug (subdomínio)').fill(slug)
  await page.getByLabel('E-mail do owner').fill(`owner-${slug}@test.com`)
  await page.getByLabel('Nome do owner').fill('Owner E2E')
  await page.getByRole('button', { name: /criar tenant/i }).click()

  // Redirect para detalhe
  await expect(page).toHaveURL(/\/platform\/tenants\//)
  await expect(page.getByRole('heading', { name: 'Salão E2E' })).toBeVisible()
})
```

- [ ] **Step 2: E2E smoke booking (reusa seed do Épico 3/5)**

```ts
// e2e/regression/booking-flow.spec.ts
import { test, expect } from '@playwright/test'

test('cliente completa booking público até horário', async ({ page, baseURL }) => {
  test.skip(!process.env.SEED_PUBLIC_TENANT, 'requer seed completo')

  const url = baseURL!.replace('localhost', 'barbearia-teste.lvh.me')

  await page.goto(`${url}/book`)
  await page.locator('a').first().click()
  await page.locator('a').first().click()
  await page.locator('a').first().click()
  await expect(page.getByRole('heading', { name: /escolha o horário/i })).toBeVisible()
})
```

- [ ] **Step 3: E2E status transitions**

```ts
// e2e/regression/status-transitions.spec.ts
import { test, expect } from '@playwright/test'

test('staff faz check-in de um appointment CONFIRMED', async ({ page, baseURL }) => {
  test.skip(!process.env.SEED_SALON_WITH_APPOINTMENT, 'requer seed com appointment')

  const url = baseURL!.replace('localhost', 'barbearia-teste.lvh.me')

  await page.goto(`${url}/login`)
  await page.getByLabel('E-mail').fill('owner@barbearia-teste.aralabs.test')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto(`${url}/dashboard/agenda`)
  await page.getByRole('button', { name: 'Check-in' }).first().click()

  // Agenda atualiza; badge deve refletir
  await expect(page.getByText('CHECKED_IN').first()).toBeVisible()
})
```

- [ ] **Step 4: Commit**

```bash
git add e2e/regression/
git commit -m "test(e2e): suite de regressão (onboarding, booking, transitions)"
```

---

## Task 8: Documentação final — `README.md` atualizado

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Atualizar**

Adicionar na seção "Comandos":

```markdown
### Observabilidade

- Audit log em `public.audit_log` — toda mudança em appointments, tenants, user_profiles e plans é registrada automaticamente.
- Billing events em `public.billing_events` — histórico de todo ajuste de billing por tenant.

### Backup

GitHub Actions faz `pg_dump` semanal + upload para Cloudflare R2. Secrets necessários:
- `SUPABASE_DB_URL`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`

### Segurança

- CSP, HSTS, X-Frame-Options configurados em `next.config.ts`.
- Rate limit 5/min por IP+email no login.
- RLS em todas as tabelas com tenant_id; funções helper em schema `auth`.
- Service role key **nunca** no cliente — apenas em server actions marcadas com `server-only`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: atualiza README com observabilidade, backup e segurança"
```

---

## Task 9: Sanity check final (Fase 1)

- [ ] **Step 1: Rodar tudo**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
supabase db reset && supabase db test
pnpm build
pnpm test:e2e
```

Expected: tudo verde.

- [ ] **Step 2: Conferir lista de migrations**

```bash
ls -1 supabase/migrations/
```

Esperado: 0001 a 0023 (23 migrations em 9 épicos + bootstrap).

- [ ] **Step 3: Tag + commit final**

```bash
git tag v0.1.0-fase1
git log --oneline | head -20
```

---

## Critério de aceitação do épico 9

- ✅ `audit_log` com trigger genérico em `appointments`, `tenants`, `user_profiles`, `plans`.
- ✅ Staff lê apenas audit_log do próprio tenant; platform admin lê tudo.
- ✅ Headers de segurança (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) configurados.
- ✅ Error boundary global (`app/error.tsx`).
- ✅ Rate limit em login (5 tentativas/minuto por IP+email).
- ✅ Workflow de backup semanal pronto (aguardando secrets).
- ✅ Suite E2E de regressão cobrindo onboarding, booking e transitions.
- ✅ README atualizado.

---

## Critério de aceitação — Fase 1 completa

Ao concluir o Épico 9, a Fase 1 está entregue:

- ✅ 23 migrations SQL versionadas (enums, entidades, RLS, helpers, triggers, pg_cron, audit).
- ✅ Multi-tenant funcional — tenant resolvido por host, RLS isolando cross-tenant, branding dinâmico.
- ✅ Auth 3 públicos (customer OAuth+Magic, staff email/senha, platform admin email/senha) + guards.
- ✅ Cadastros completos (profissionais, clientes, serviços, horários, disponibilidade, bloqueios).
- ✅ Agenda com views mobile e tablet landscape + criação manual + realtime.
- ✅ Booking público PWA-ready (wizard 6 passos + login inline + confirmação).
- ✅ Status transitions (check-in → iniciar → finalizar / cancelar / no-show).
- ✅ Platform admin completo (tenants, plans, billing detalhado com 5 ações, dashboard MRR).
- ✅ Billing estrutural completo (trial + assinatura + taxa parametrizáveis, billing_events, pg_cron) — **sem cobrança real** (Fase 2+).
- ✅ Modo Operação com Wake Lock + PIN + layout simplificado.
- ✅ PWA instalável (manifest dinâmico por tenant + service worker + install prompt + ícones default).
- ✅ Audit log automático.
- ✅ Segurança (CSP, HSTS, rate limit, RLS + pgTAP, service role contido).
- ✅ Testes: Vitest (unit), Playwright (E2E + regressão), pgTAP (RLS + transitions + overlap).
- ✅ Backup semanal configurado.
- ✅ CI verde em todos os planos.

**Output:** SaaS multi-tenant completo, pronto para o primeiro cliente real em trial — sem cobrança ainda, mas com toda a estrutura para ativar Fase 2 (Pix + gateway + webhook) sem refatorações.
