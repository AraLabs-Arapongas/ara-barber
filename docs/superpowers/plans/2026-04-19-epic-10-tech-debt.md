# Épico 10 — Tech Debt Acumulado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar débitos técnicos acumulados durante os Épicos 0-2 (e posteriores). Este épico é "vivo" — novos débitos descobertos em épicos seguintes devem ser anexados aqui em vez de bloquear a entrega corrente.

**Natureza:** Não-linear. As tasks são independentes; executa na ordem que fizer sentido na hora. Priorizado por risco (segurança/isolamento primeiro, ergonomia depois).

**Referência:** `~/.claude/projects/-Users-thiagotavares-Projects-a-labs-tech-ara-barber/memory/MEMORY.md` — índice de memories que documentam cada débito.

---

## Índice de débitos

| # | Task | Origem | Prioridade |
|---|---|---|---|
| 1 | pgTAP RLS isolation tests | Épico 1 / Task 7 adiada | Alta |
| 2 | Rotação de credenciais expostas em chat | Sessão 2026-04-18 | Alta |
| 3 | Proxy unit tests | Coverage gap desde Épico 0 | Média |
| 4 | Custom `not-found.tsx` tematizado | Descoberto em 2026-04-19 (login E2E manual) | Baixa |
| 5 | Script automatizado `pnpm db:types` via MCP/API | Ergonomia — hoje é manual | Média |
| 6 | Seed idempotente de platform admin via Admin API | Épico 1 / Task 17 adiada (parte 1) | Média |
| 7 | E2E auth flows + reativar job CI | Épico 1 / Task 17 adiada (parte 2) + Épico 0 tech debt | Média |
| 8 | Accessibility audit (contraste, focus, ARIA) | Compromisso da Rodada 1 de design | Média |
| 9 | Documentar setup do MCP Supabase no README/AGENTS.md | Experiência de onboarding solo | Baixa |
| 10 | Consolidar `src/app/page.tsx` branch por area | Pode virar rewrite via proxy | Baixa |

---

## Task 1: pgTAP tests de RLS isolation

**Origem:** Épico 1 / Task 7. Arquivo foi planejado em `supabase/tests/rls_auth.test.sql` com 6 asserts (platform admin vê tudo, owner vê só próprio tenant, anon nada, etc).

**Files:**
- Create: `supabase/tests/rls_auth.test.sql`
- Create: `scripts/run-pgtap.ts` (opcional — runner sem CLI local)

**Steps:**

- [ ] **Step 1: Ativar extensão pgTAP no cloud**

  ```sql
  create extension if not exists pgtap with schema extensions;
  ```

  Aplicar via `mcp__supabase__apply_migration` com nome `0009_enable_pgtap`.

- [ ] **Step 2: Escrever o arquivo de testes**

  Seguir o template do plano Épico 1 (Task 7 Step 2), **com ajustes:**
  - `auth.current_tenant_id()` → `public.current_tenant_id()`
  - `auth.is_platform_admin()` → `public.is_platform_admin()`
  - `auth.current_role()` → `public.current_user_role()`
  - `crypt(...)` + `gen_salt('bf')` — pgcrypto já está instalado
  - Os 8 campos de token de `auth.users` devem ser `''`, não NULL

- [ ] **Step 3: Rodar via `execute_sql`**

  Como não temos CLI local, ler o arquivo e rodar blocos pgTAP via MCP. Opcionalmente, um pequeno script Node `scripts/run-pgtap.ts` que lê o `.sql`, roda via Supabase REST e imprime resultado TAP formatado.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/0009_enable_pgtap.sql supabase/tests/rls_auth.test.sql scripts/run-pgtap.ts
  git commit -m "test(db): pgTAP RLS isolation (tenants/user_profiles/plans)"
  ```

**Aceite:** 6+ asserts passando. Isolation cross-tenant documentado mesmo sem usuário UI.

---

## Task 2: Rotação de credenciais expostas em chat

**Origem:** Em 2026-04-18 foram pastadas em chat:
- DB password do projeto `ara-barber-dev` (ver histórico do chat / password manager até rotacionar)
- Secret key `sb_secret_*` (ver `.env.local` até rotacionar)

Os valores literais foram omitidos deste plano de propósito para não aparecerem em secret scanners e na busca de código.

**Steps:**

- [ ] **Step 1: DB password**

  Dashboard → Project Settings → Database → "Reset database password". Gerar nova, anotar em password manager, atualizar `docs/accounts.md`. Conexões diretas Postgres que venham a ser usadas (jobs, backup, psql local) usam a nova.

- [ ] **Step 2: Secret key**

  Dashboard → Project Settings → API Keys → "Secret default" → rotate/revoke. Gerar nova, atualizar `.env.local` e (quando houver) GitHub secrets do CI/Vercel env.

- [ ] **Step 3: Validar**

  Rodar `pnpm test` (unit) + abrir `/platform/login` e logar de novo. Nada deve quebrar (publishable key + URL não mudam).

- [ ] **Step 4: Atualizar memory**

  Remover referência à senha antiga de `memory/project_supabase.md` e `docs/accounts.md`. Confirmar que senhas atuais só existem no password manager.

**Aceite:** DB password e secret key rotacionadas. Nenhuma credencial válida pastada em chat anterior serve.

---

## Task 3: Proxy unit tests

**Origem:** `src/proxy.ts` tem lógica não-trivial (host parsing, area resolution, futuramente tenant resolution do Épico 2). Zero testes hoje.

**Files:**
- Create: `tests/unit/proxy/resolve-area.test.ts`

**Steps:**

- [ ] **Step 1: Extrair `resolveArea` pra módulo testável**

  Se o proxy ainda mantiver a função inline após Épico 2, mover para `src/lib/tenant/resolve.ts` (onde já tem `parseHostToSlug`) ou módulo dedicado `src/lib/proxy/resolve-area.ts`.

- [ ] **Step 2: Escrever testes**

  Casos:
  - `admin.aralabs.com.br` → `platform`
  - `x.aralabs.com.br` → `tenant`
  - `x.lvh.me` → `tenant`
  - `aralabs.com.br` / `localhost` → `root`
  - host com porta → ignorada
  - case-insensitive

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "test(proxy): unit tests de resolveArea + parseHostToSlug"
  ```

**Aceite:** Cobertura >90% das funções puras do proxy.

---

## Task 4: Custom `not-found.tsx` tematizado

**Origem:** Hoje a 404 usa tema default do Next (fundo preto). Quebra a consistência visual com o tema creme AraLabs.

**Files:**
- Create: `src/app/not-found.tsx`

**Steps:**

- [ ] **Step 1: Página 404 tematizada**

  Seguir design system — fundo `bg-bg`, Wordmark no topo, mensagem amigável em Fraunces, botão secondary pra voltar pro `/`. Mobile-first.

- [ ] **Step 2: (opcional) 404 por área**

  Se faz sentido, `src/app/platform/not-found.tsx` com variant sóbria e `src/app/salon/not-found.tsx` (tenant-aware quando Épico 2 injetar branding).

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "feat(ui): 404 tematizada com paleta Ara Barber"
  ```

**Aceite:** Navegar para `/qualquer-coisa` renderiza 404 creme + Wordmark + CTA voltar.

---

## Task 5: Script `pnpm db:types` automático

**Origem:** Hoje regenerar tipos TS exige chamar `mcp__supabase__generate_typescript_types` na sessão Claude. Devs humanos não têm essa via.

**Files:**
- Create: `scripts/gen-types.ts`
- Modify: `package.json`

**Steps:**

- [ ] **Step 1: Script Node**

  Usar Supabase Management API (`https://api.supabase.com/v1/projects/<ref>/types/typescript`) com personal access token em `SUPABASE_ACCESS_TOKEN` (env var local). Escreve em `src/lib/supabase/types.ts`.

- [ ] **Step 2: Adicionar `tsx` como devDep e script**

  ```json
  "db:types": "tsx scripts/gen-types.ts"
  ```

- [ ] **Step 3: Atualizar AGENTS.md**

  Substituir a linha `supabase gen types typescript --local` por `pnpm db:types`.

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(db): pnpm db:types regenera tipos via Management API"
  ```

**Aceite:** `pnpm db:types` regenera `types.ts` em <5s, alinhado com o que o MCP devolve.

---

## Task 6: Seed idempotente de platform admin via Admin API

**Origem:** Hoje criamos o primeiro admin via `execute_sql` direto em `auth.users` (e pegamos o pitfall dos tokens NULL). Próximos ambientes (preview, prod) devem ter script repeatable.

**Files:**
- Create: `scripts/seed-admin.ts`

**Steps:**

- [ ] **Step 1: Script usando Admin API**

  `createSecretClient()` + `supabase.auth.admin.createUser({ email, password, email_confirm: true })`. Depois, insere/upserta em `public.user_profiles` com role `PLATFORM_ADMIN`. Idempotente: se user já existe, só garante o profile.

  Parâmetros via env var ou CLI args: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`.

- [ ] **Step 2: Script npm**

  ```json
  "db:seed-admin": "tsx scripts/seed-admin.ts"
  ```

- [ ] **Step 3: Documentar**

  AGENTS.md — seção "Primeiro uso / novo ambiente": `SEED_ADMIN_EMAIL=... pnpm db:seed-admin`.

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat(db): seed idempotente de platform admin via Auth Admin API"
  ```

**Aceite:** Rodar 2× o script com mesmo email não cria duplicado nem quebra; só confirma profile.

---

## Task 7: E2E auth flows + reativar job CI

**Origem:** Épico 1 / Task 17 adiada + memory `project_e2e_deferred.md`.

**Depende de:** Task 6 (seed idempotente) deve rodar antes dos testes.

**Files:**
- Create: `e2e/auth/platform-login.spec.ts`
- Create: `e2e/auth/salon-login.spec.ts` (quando Épico 2 tiver tenant real)
- Modify: `.github/workflows/ci.yml` (descomentar job `e2e`)

**Steps:**

- [ ] **Step 1: Secrets no GitHub**

  `Settings → Secrets → Actions`, adicionar: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

- [ ] **Step 2: Setup step no workflow**

  Antes do `pnpm test:e2e`, rodar `pnpm db:seed-admin` e (se houver) `pnpm db:seed-tenant`.

- [ ] **Step 3: Escrever os specs**

  Plano original (Épico 1 Task 17 Step 2-3) adaptado para URLs atuais: `/platform/login` e `/salon/login` em host de tenant (`barbearia-teste.lvh.me:3008`).

- [ ] **Step 4: Descomentar job e2e do CI**

- [ ] **Step 5: Commit**

  ```bash
  git commit -m "test(e2e): reativa E2E auth flows + seed fixture"
  ```

**Aceite:** CI verde com E2E rodando em PR + push.

---

## Task 8: Accessibility audit inicial

**Origem:** Rodada 1 de design listou acessibilidade nas guidelines mas não fez audit real.

**Files:**
- Create: `docs/a11y-audit.md`
- Modify: componentes conforme necessário

**Steps:**

- [ ] **Step 1: Checklist**

  - Contraste: paleta atual OKLCH — validar ratio ≥ 4.5:1 pra texto, ≥ 3:1 pra UI. Checar com Chrome DevTools Audit (Lighthouse) ou [contrast-ratio.com](https://contrast-ratio.com/).
  - Focus visível em todos os interativos: já cuidamos no `*:focus-visible`, validar por teclado.
  - Tamanho mínimo de toque: 44×44px (spec §13). Validar inputs, botões.
  - `role`/`aria-*` corretos em Alert, Input error, Button loading.
  - Navegação por teclado em `/platform/login` e `/salon/login`.
  - Prefers-reduced-motion respeitado (já implementado).

- [ ] **Step 2: Lighthouse CI (opcional)**

  Plugin pra CI que roda Lighthouse em cada PR com score mínimo 95 pra Accessibility.

- [ ] **Step 3: Commit + documentar achados**

  ```bash
  git commit -m "docs(a11y): audit inicial + ajustes de contraste/focus"
  ```

**Aceite:** Documento `docs/a11y-audit.md` com checklist por página + issues corrigidas.

---

## Task 9: Documentar setup do MCP Supabase

**Origem:** Qualquer dev novo (ou futuro-eu numa máquina nova) precisa autenticar o MCP. Nenhum doc atual cobre.

**Files:**
- Modify: `AGENTS.md` e/ou `README.md`

**Steps:**

- [ ] **Step 1: Seção "Primeiro uso" em AGENTS.md**

  Cobrir:
  - `.mcp.json` já commitado aponta pro project ref `sixgkgiirifigoiqbyow`.
  - No primeiro uso, Claude Code vai pedir OAuth — o agente dispara `mcp__supabase__authenticate`, você abre a URL no navegador, autoriza, e os tools ficam disponíveis.
  - Se mudar de projeto, atualizar `.mcp.json` (não `.env.local`).

- [ ] **Step 2: Commit**

  ```bash
  git commit -m "docs(agents): documenta setup MCP Supabase + OAuth flow"
  ```

**Aceite:** Próxima pessoa (ou sessão fresca sua) consegue subir o MCP só lendo AGENTS.md.

---

## Task 10: Consolidar `src/app/page.tsx` branch por area

**Origem:** No Épico 2 resolvemos conflito entre root marketing e tenant home colocando lógica condicional no `page.tsx`. Pode ficar feio com tempo.

**Files:**
- Modify: `src/proxy.ts` (rewrite)
- Modify: `src/app/page.tsx`
- Create: `src/app/tenant-home/page.tsx` (ou equivalente)

**Steps:**

- [ ] **Step 1: Avaliar se dor é real**

  Se `src/app/page.tsx` continuar com ≤50 linhas e `if (area === 'tenant') { … } else { … }` legível, não fazer nada. YAGNI.

- [ ] **Step 2: Se for complicar, rewrite**

  - Proxy rewrite `/` → `/tenant-home` quando `area === 'tenant'`.
  - `src/app/page.tsx` fica só com o marketing root.
  - `src/app/tenant-home/page.tsx` puxa `getCurrentTenantOrNotFound()` e renderiza o salão.

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "refactor(proxy): separa root marketing de tenant home via rewrite"
  ```

**Aceite:** `/` externo continua funcionando idêntico; código interno mais limpo.

---

## Regra: novo débito = linha no índice

Quando descobrir um novo débito durante outro épico:
1. Cria memory em `~/.claude/projects/-Users-thiagotavares-Projects-a-labs-tech-ara-barber/memory/` (tipo `project`).
2. Anexa uma linha no **índice** deste arquivo.
3. Cria uma task nova aqui embaixo se for concreta o suficiente.

Não para a entrega do épico corrente.
