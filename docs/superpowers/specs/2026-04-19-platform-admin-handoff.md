# Platform Admin — Hand-off para AraLabs Storefront

**Status:** Decisão tomada em 2026-04-19. O painel administrativo da plataforma sai do repo `ara-barber` e passa a viver dentro do repo da **aralabs storefront** (`aralabs.com.br`), virando um módulo admin compartilhado entre todos os produtos AraLabs (ara-barber hoje, outros produtos amanhã).

**Propósito deste documento:** descrever o que o módulo admin da aralabs storefront precisa implementar para operar o ara-barber. Serve de spec para o outro repo e de ponteiro para os épicos do ara-barber que ficam "backend-only" agora (sem UI neste repo).

---

## 1. Arquitetura geral

```
┌──────────────────────────────────────────────────┐
│  aralabs.com.br  (repo: aralabs-storefront)      │
│  ┌────────────────────────────────────────────┐  │
│  │  Public marketing (já existe)              │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  /admin/*   (NOVO — objeto deste spec)     │  │
│  │   - Dashboard multi-produto                │  │
│  │   - Admin ara-barber (este doc)            │  │
│  │   - Admin ara-X (futuro)                   │  │
│  └────────────────────────────────────────────┘  │
│       │                                           │
│       │ Supabase secret key (ara-barber)          │
│       ▼                                           │
│  ┌────────────────────────────────────────────┐  │
│  │  ara-barber Supabase                       │  │
│  │  (sixgkgiirifigoiqbyow.supabase.co)        │  │
│  │   - tenants, user_profiles, plans          │  │
│  │   - RLS com role PLATFORM_ADMIN            │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  *.aralabs.com.br  (repo: ara-barber)            │
│  ┌────────────────────────────────────────────┐  │
│  │  /  (tenant public — cliente final)        │  │
│  │  /salon/* (staff do salão)                 │  │
│  └────────────────────────────────────────────┘  │
│  Sem admin UI aqui. Backend + RLS só.            │
└──────────────────────────────────────────────────┘
```

**Chaves da arquitetura:**
- `ara-barber` expõe DB Supabase com schema + RLS policies. Não tem UI de admin.
- `aralabs-storefront` tem UI de admin que lê/escreve no DB do `ara-barber` via **Supabase secret key** (bypassa RLS porque é servidor-a-servidor).
- Quando nascer o `ara-X`, `aralabs-storefront` adiciona outro painel. Cada produto tem seu próprio projeto Supabase; o storefront colabora com N projetos.

---

## 2. O que já existe no `ara-barber` (backend)

Implementado nos Épicos 1-2. A storefront pode consumir diretamente.

### Tabelas
- `public.tenants` — slug, name, subdomain, branding, billing snapshot, status.
- `public.user_profiles` — `user_id` (FK `auth.users`), `role` (enum `user_role`), `tenant_id` (nullable — null pra PLATFORM_ADMIN e CUSTOMER), `name`, `is_active`.
- `public.plans` — catálogo (STARTER/PRO/PREMIUM já seedados; code, price, trial days, transaction_fee_*).
- `auth.users`, `auth.identities` — Supabase Auth padrão.

### Enums (em `public.*`)
- `user_role`: `PLATFORM_ADMIN | SALON_OWNER | RECEPTIONIST | PROFESSIONAL | CUSTOMER`.
- `tenant_status`: `ACTIVE | SUSPENDED | ARCHIVED`.
- `billing_status`: `TRIALING | ACTIVE | PAST_DUE | SUSPENDED | CANCELED`.
- `billing_model`: `TRIAL | SUBSCRIPTION_WITH_TRANSACTION_FEE`.
- `transaction_fee_type`: `PERCENTAGE | FIXED | NONE`.

### Funções helper (SQL — usadas em RLS)
- `public.current_tenant_id()` → uuid do tenant do usuário logado.
- `public.current_user_role()` → role enum do usuário logado.
- `public.is_platform_admin()` → boolean.
- `public.is_tenant_staff(uuid)` → boolean.

### RLS policies (resumo)
- `plans`: leitura livre pra autenticados; escrita só platform admin.
- `tenants`: platform admin tudo; staff vê só o próprio.
- `user_profiles`: platform admin tudo; self-read; staff lê perfis do mesmo tenant; owner escreve perfis do próprio tenant.

### Storage
- Bucket público `tenant-assets`. Policies permitem platform admin tudo, owner no próprio tenant.

### Tipos TypeScript
- `src/lib/supabase/types.ts` — gerado via MCP. Storefront pode copiar o arquivo ou gerar o seu.

---

## 3. O que o admin da storefront precisa implementar

### 3.1 Autenticação

Duas opções:

**A) Session nativa do storefront.** O admin loga no Supabase Auth do próprio projeto aralabs-storefront. Pra acessar ara-barber, o backend do admin usa **ara-barber secret key** (service-to-service). Admin não precisa ter conta em ara-barber.

**B) Session em ara-barber.** O admin loga em `auth.users` do projeto ara-barber com `user_profiles.role = PLATFORM_ADMIN`. Vantagem: RLS funciona "naturalmente". Desvantagem: quando ara-X existir, admin precisa de conta em cada produto.

**Recomendação: A.** A storefront vira o hub; cada produto tem secret key no env do storefront. Escala melhor.

### 3.2 Telas mínimas (MVP do admin)

Equivalente aos épicos 7 (platform admin billing) e 9 (audit hardening) do `ara-barber`, mas implementados no outro repo.

1. **Dashboard overview**
   - Contagem de tenants por status (ACTIVE/SUSPENDED/ARCHIVED).
   - Tenants em trial, com trial vencendo em 7 dias.
   - MRR estimado (soma `tenants.monthly_price_cents` onde `billing_status=ACTIVE`).

2. **Tenants — listagem + busca**
   - Colunas: name, slug, status, billing_status, plan, trial_ends_at, created_at.
   - Filtros: status, billing_status.
   - Busca por name/slug/email.

3. **Tenants — criar**
   - Form: name, slug (validação regex), owner email, plan escolhido.
   - Operações (transação única):
     1. Cria linha em `public.tenants` com defaults do plan.
     2. Cria linha em `auth.users` + `auth.identities` pro owner (Admin API).
        - **Atenção:** inserir via SQL direto exige tokens `= ''` (não NULL) nos 8 campos do GoTrue. Usar `supabase.auth.admin.createUser()` evita isso.
     3. Cria linha em `public.user_profiles` com `role=SALON_OWNER`, `tenant_id=<novo>`, `name=<owner>`.
     4. Envia magic link ou senha provisória pro owner.
   - `ara-barber` vai expor helper `scripts/create-tenant.ts` (Épico 10 Task 11) que a storefront pode chamar via subprocess OU replicar em JS.

4. **Tenants — editar**
   - Branding (primary/secondary/accent colors, logo_url, favicon_url).
   - Billing (plan_id, monthly_price_cents, trial_ends_at, custom_trial_days).
   - Operação (suspend, archive, reactivate).

5. **Plans — CRUD**
   - 3 planos já seedados. CRUD completo pra criar novos, editar preços.
   - Validação: apenas 1 plano pode ter `is_default=true` (unique index).

6. **Users — visão cross-tenant**
   - Listar `user_profiles` com filtro por tenant_id.
   - Desativar usuário (`is_active=false`).
   - Resetar senha (via Admin API).

7. **Logs de auditoria (Épico 9)**
   - Tabela `audit_log` que ainda não existe — quando Épico 9 criar, storefront consome.
   - Eventos: tenant criado, plan trocado, billing_status mudou, user desativado.

### 3.3 Operações de escrita sensíveis

Usar Supabase secret client do ara-barber. Exemplos:

```ts
// aralabs-storefront/src/lib/ara-barber/client.ts
import { createClient } from '@supabase/supabase-js'

export function createAraBarberAdmin() {
  return createClient(
    process.env.ARA_BARBER_SUPABASE_URL!,
    process.env.ARA_BARBER_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
```

**Env vars necessárias no storefront:**
- `ARA_BARBER_SUPABASE_URL=https://sixgkgiirifigoiqbyow.supabase.co`
- `ARA_BARBER_SECRET_KEY=sb_secret_…` (rotacionada — pegar em password manager)
- `ARA_BARBER_PUBLISHABLE_KEY=sb_publishable_…` (pra operações read-only se quiser)

### 3.4 Permissões dentro do admin storefront

Storefront tem sua própria tabela de usuários admin. Papéis sugeridos:
- `SUPER_ADMIN` — tudo em todos produtos.
- `PRODUCT_ADMIN` — tudo dentro de um produto (ex: ara-barber).
- `SUPPORT` — leitura de tudo + operações específicas de suporte (reset senha de owner, etc).

Cada role no storefront mapeia pra operações no secret client do ara-barber. Controle é no storefront; ara-barber não sabe do mapeamento.

---

## 4. Caminhos de migração — Fase 1 (dev) vs Fase 2 (prod)

### Fase 1 (agora)
- Sem admin UI em lugar nenhum.
- Tenants criados via MCP Supabase (Claude executa `execute_sql` quando solicitado) ou via CLI script `pnpm create-tenant` (Épico 10 Task 11 — pendente).
- 2-3 tenants manuais cobrem dev e primeiros beta-users.

### Fase 2 (pré-prod)
- Storefront implementa o admin MVP (seção 3.2).
- ara-barber expõe API HTTP `/api/admin/*` (Épico 10 Task 12 — pendente) como alternativa ao acesso direto via secret key. Mais seguro a longo prazo.
- Rotação de secret keys procedimentada.

### Fase 3+
- Admin cresce pra atender outros produtos (ara-X, ara-Y).
- Event-driven: ara-barber emite webhooks pra storefront quando algo muda (billing, churn).
- Observability: storefront puxa métricas de cada produto.

---

## 5. O que fica REMOVIDO do `ara-barber` agora (2026-04-19)

- `src/app/platform/*` — todas as páginas platform.
- `src/components/auth/logout-button.tsx` (só usado em platform).
- `src/lib/auth/guards.ts::assertPlatformAdmin` + teste correspondente.
- `src/proxy.ts` simplifica: só 2 áreas (`tenant | root`), sem `platform`.
- `src/lib/tenant/resolve.ts::parseHostToSlug` — remove branch de platform, reserva subdomínio `admin` como root (defensivo).
- `src/app/page.tsx` — remove redirect `platform → /platform`; `DevRootIndex` remove link pra platform login.
- `NEXT_PUBLIC_PLATFORM_HOST` — env var removida.
- `src/lib/utils/env.ts::env.platformHost` — helper removido.

**O que PERMANECE no ara-barber:**
- Schema, enums, RLS, helpers SQL, seeds.
- User `thiago@aralabs.com.br` com `PLATFORM_ADMIN` (usado pelo admin storefront quando existir, caso opção B da §3.1 seja escolhida).
- Tipo `UserRole` inclui `PLATFORM_ADMIN` (TS).
- `isPlatformAdminRole` predicate (utility ainda útil).
- Supabase clients (`browser`, `server`, `secret`) — usados por `/salon/*`.
- Auth: `assertStaff`, `getSessionUser`, `requireSessionUser`.

---

## 6. Referências

- `docs/superpowers/plans/2026-04-18-epic-07-platform-admin-billing.md` — requisitos originais do admin billing (continua valendo como especificação de comportamento; implementação muda de repo).
- `docs/superpowers/plans/2026-04-18-epic-09-audit-hardening.md` — audit trail.
- `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md` — spec original (seções 8 billing, 15 audit).
- `docs/accounts.md` — credenciais e refs (local, gitignorado).

---

## 7. Critério de sucesso desta migração

- `ara-barber` compila, lint/typecheck/test verdes, sem platform UI.
- Fluxo de `/salon/*` e home pública do tenant continuam funcionais.
- Spec deste doc é suficiente pra storefront construir o admin sem voltar a perguntar nada arquitetural.
- Rollback plan: se a migração não rolar dentro de X semanas, revive platform UI no ara-barber restaurando os arquivos do commit anterior (git log vai manter a referência).
