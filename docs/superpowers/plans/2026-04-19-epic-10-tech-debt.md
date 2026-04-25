> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

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
| 4 | Custom `not-found.tsx` tematizado | Descoberto em 2026-04-19 | ✅ **Parcial** — not-found.tsx genérico criado; tenant-missing render inline em page.tsx (ver Task 13) |
| 5 | Script automatizado `pnpm db:types` via MCP/API | Ergonomia — hoje é manual | Média |
| 6 | Seed idempotente de platform admin via Admin API | Épico 1 / Task 17 adiada (parte 1) | Média |
| 7 | E2E auth flows + reativar job CI | Épico 1 / Task 17 adiada (parte 2) + Épico 0 tech debt | Média |
| 8 | Accessibility audit (contraste, focus, ARIA) | Compromisso da Rodada 1 de design | Média |
| 9 | Documentar setup do MCP Supabase no README/AGENTS.md | Experiência de onboarding solo | Baixa |
| 10 | Consolidar `src/app/page.tsx` branch por area | Pode virar rewrite via proxy | Baixa |
| 11 | Script CLI `pnpm create-tenant` | Permite onboarding manual sem UI; reusável pelo admin storefront | Média |
| 12 | API HTTP `/api/admin/*` para consumo do storefront | Alternativa a expor secret key no storefront; audit/rate limit | Baixa (Fase 2+) |
| 13 | Status HTTP 404 correto no tenant-not-found | Hoje `page.tsx` renderiza inline com 200; corrigir via `NextResponse.rewrite` no proxy | Média |
| 14 | Executar migração da UI platform admin pra aralabs-storefront | Spec escrito (§handoff 2026-04-19); implementação em outro repo | Média (blocker pra prod) |
| 15 | pgTAP RLS tests dos cadastros (professionals, customers, services, joins, hours) | Épico 3 / Task 13 adiada | Alta |
| 16 | Google OAuth provider no Supabase Auth (customer login) | Decisão 2026-04-19: Fase 1 = OTP email + Google OAuth juntos | Média |
| 17 | Edição/soft-delete completo dos cadastros (edit profissional, edit serviço, deactivate) | Épico 3: hoje só cria; toggle/edit é débito UX | Baixa |
| 18 | `professional_services` join UI (marcar quais serviços cada profissional faz) | Épico 3: tabela existe, UI não | Média (bloqueia filtros de booking no Épico 5) |
| 19 | `professional_availability` e `availability_blocks` UIs | Épico 3: tabelas existem, UIs não. Blocker da agenda no Épico 4 | Alta |
| 20 | Otimizar RLS policies — wrap `auth.uid()` em `(select auth.uid())` | Advisor `auth_rls_initplan` (4 ocorrências: plans, user_profiles, customers×2) | Média |
| 21 | Consolidar policies permissivas múltiplas por tabela | Advisor `multiple_permissive_policies` (170 ocorrências — desenho atual mantém 2 policies `*_platform_admin_all` + `*_tenant_staff_all` por tabela) | Baixa |
| 22 | Cobrir FKs sem índice (`availability_blocks.tenant_id`, `professionals.user_id`, `tenants.current_plan_id`) | Advisor `unindexed_foreign_keys` | Média |
| 23 | Habilitar "Leaked Password Protection" no Supabase Auth + avaliar ListBucket do `tenant-assets` | Advisor security WARN — manual no dashboard | Baixa |
| 24 | Exibir `tenants.city` (já existe) na home no lugar do `timezone` + UI de edição no perfil | Hoje a home hardcoda "Arapongas"; coluna já existe, só falta popular + renderizar | Baixa |
| 25 | Home do tenant quando cliente está logado: repensar UX | Hoje mostra "Bem-vindo X" + "Meus agendamentos" acima do CTA, mas bottom nav já tem tab "Meus" — duplicado. Sugestão: mostrar próximo agendamento, ou quick re-booking | Média |
| 26 | Consertar Supabase Site URL global (Dashboard "Send recovery/magic link" caem em aralabs.com.br/storefront) | Sessão 2026-04-25 staff password recovery | Média (suporte interno) |
| 27 | Templates de email per-tenant (logo, cores, fonts próprios do salão) — exige custom email sender via Auth Hook + edge function | Sessão 2026-04-25 staff password recovery | Baixa (Fase 2) |
| 28 | Sync automático `tenants.name → user_metadata.tenant_name` em todos staff users do tenant (trigger SQL on update) | Sessão 2026-04-25 staff password recovery | Baixa |
| 29 | Migrar `tenant_name` de `user_metadata` (user-writable) pra `app_metadata` (service_role only) — checar se Supabase template syntax suporta `{{ .AppData }}` | Sessão 2026-04-25 staff password recovery | Baixa |
| 30 | Captcha em `/salon/forgot-password` antes de scale (>100 tenants) | Sessão 2026-04-25 staff password recovery | Baixa |

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

## Task 11: Script CLI `pnpm create-tenant`

**Origem:** Discutido em 2026-04-19 ao decidir migrar admin pra aralabs-storefront. Mesmo sem UI, precisa onboarding repeatable.

**Files:**
- Create: `scripts/create-tenant.ts`
- Modify: `package.json` (script)

**Steps:**

- [ ] **Step 1: Script Node**

  Recebe args: `--slug`, `--name`, `--owner-email`, `--plan` (default STARTER). Usa `createSecretClient()` + `supabase.auth.admin.createUser({ email, email_confirm: true })` + insert em `public.tenants` + insert em `public.user_profiles` com role `SALON_OWNER`. Idempotente: se slug já existe, só confirma owner.

- [ ] **Step 2: Script npm**

  ```json
  "create-tenant": "tsx scripts/create-tenant.ts"
  ```

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "feat(ops): pnpm create-tenant — onboarding CLI de barbershop"
  ```

**Aceite:** Rodar `pnpm create-tenant --slug=joao-barber --name="João Barber" --owner-email=joao@x.com` cria tudo em ~2s. Segunda execução não duplica.

---

## Task 12: API HTTP `/api/admin/*` para consumo externo

**Origem:** `docs/superpowers/specs/2026-04-19-platform-admin-handoff.md` §3.3. Alternativa mais segura que expor secret key diretamente no storefront.

**Files:**
- Create: `src/app/api/admin/tenants/route.ts`, etc.
- Create: `src/lib/admin-api-auth.ts` (valida `x-admin-api-key` header)
- Modify: `.env.local.example` (adiciona `ADMIN_API_KEY`)

**Steps:**

- [ ] **Step 1: Middleware de auth por API key**

  Header `x-admin-api-key` comparado contra `process.env.ADMIN_API_KEY`. Timing-safe compare.

- [ ] **Step 2: Endpoints mínimos**

  - `GET /api/admin/tenants` — lista + filtros.
  - `POST /api/admin/tenants` — cria (reaproveita lógica do Task 11).
  - `PATCH /api/admin/tenants/:id` — update branding/billing.
  - `GET /api/admin/plans` / `POST` / `PATCH`.

- [ ] **Step 3: OpenAPI / tipos compartilhados**

  Exportar `src/lib/admin-api/types.ts` que o storefront pode copiar ou consumir via OpenAPI.

- [ ] **Step 4: Rate limit + audit log**

- [ ] **Step 5: Commit**

**Aceite:** Storefront consegue listar/criar tenant sem secret key do Supabase direto, com audit trail.

---

## Task 13: Status HTTP 404 real no tenant-not-found

**Origem:** Commit `91dd9d5` (2026-04-19). `src/app/page.tsx` renderiza `<TenantNotFound />` inline via header `x-ara-tenant-missing`, retornando status 200. O `notFound()` nativo do Next 16 dev aciona o error shell em vez de `not-found.tsx` — daí o workaround inline.

**Files:**
- Modify: `src/proxy.ts`
- Create: `src/app/tenant-not-found/page.tsx` (ou reaproveitar)
- Modify: `src/app/page.tsx` (remove TenantNotFound inline)

**Steps:**

- [ ] **Step 1: Investigar comportamento em prod**

  Build + start + curl `http://barba-ruiva.lvh.me:3008`. Se em prod `notFound()` funcionar normal (renderiza `not-found.tsx`), a solução é só ajustar o condicional no page.tsx.

- [ ] **Step 2: Se dev continuar ruim, usar rewrite**

  ```ts
  // proxy.ts
  if (!tenantId) {
    const rewriteUrl = new URL('/tenant-not-found', req.url)
    return NextResponse.rewrite(rewriteUrl, { status: 404 })
  }
  ```

  Criar `src/app/tenant-not-found/page.tsx` com o conteúdo atual de `TenantNotFound`.

- [ ] **Step 3: Limpar**

  Remove `TenantNotFound` inline de `src/app/page.tsx`. Atualiza comentário do proxy.

- [ ] **Step 4: Commit**

**Aceite:** `curl -I http://barba-ruiva.lvh.me:3008` devolve `404 Not Found` + HTML com design system correto.

---

## Task 14: Executar migração da UI platform admin

**Origem:** Decisão 2026-04-19 de mover platform admin pro aralabs-storefront (`docs/superpowers/specs/2026-04-19-platform-admin-handoff.md`). Blocker pra prod — sem admin, não onboarding de clientes reais.

**Fora deste repo** — implementação ocorre no aralabs-storefront. Task aqui é:

- [ ] **Step 1: Compartilhar spec com time/self**

  Link o doc de handoff no ticket/plano do storefront.

- [ ] **Step 2: Esperar storefront implementar admin MVP**

  Screens mínimas: dashboard, tenants CRUD, plans CRUD.

- [ ] **Step 3: Validar integração**

  Storefront lê/escreve no DB ara-barber via secret key (ou Task 12 quando existir).

- [ ] **Step 4: Remover `PLATFORM_ADMIN` user daqui (se opção A de auth)**

  Se storefront for autoridade de auth (§3.1 opção A do spec), deletar `thiago@aralabs.com.br` de `ara-barber.auth.users` e simplificar RLS.

**Aceite:** É possível operar ara-barber em prod sem tocar no DB diretamente.

---

## Task 15: pgTAP RLS tests dos cadastros

**Origem:** Épico 3 / Task 13 adiada. Sem tests, cross-tenant isolation dos cadastros (`professionals`, `customers`, `services`, `professional_services`, `business_hours`, `professional_availability`, `availability_blocks`) fica só documentada no SQL.

**Depende de:** Task 1 (ativar extensão pgTAP) já ter sido feita.

**Files:**
- Create: `supabase/tests/rls_cadastros.test.sql`

**Steps:**

- [ ] **Step 1: Escrever asserts cross-tenant**

  Padrão: inserir 2 tenants + 2 owners + 1 row em cada tabela em cada tenant. Como anon, afirma leitura vazia (app 100% autenticado pós-migration 0016). Como owner A, afirma só vê tenant A. Afirma insert em tenant errado viola RLS.

- [ ] **Step 2: Rodar via execute_sql em loop**

- [ ] **Step 3: Commit + atualizar índice**

**Aceite:** ~20 asserts passando cobrindo as 7 tabelas novas.

---

## Task 16: Google OAuth provider no Supabase Auth

**Origem:** Decisão 2026-04-19: Fase 1 tem **OTP email + Google OAuth** como métodos de login do customer. OTP nativo, Google exige config.

**Passos manuais (fora do código):**
- [ ] **Step 1**: Google Cloud Console → criar projeto "ara-barber-dev" (e outro "ara-barber-prod" depois).
- [ ] **Step 2**: OAuth consent screen → External → preencher app name, support email, scopes `email` + `profile` + `openid`.
- [ ] **Step 3**: Credentials → Create OAuth Client ID → Web → adicionar `https://sixgkgiirifigoiqbyow.supabase.co/auth/v1/callback` como redirect URI.
- [ ] **Step 4**: Supabase Dashboard → Authentication → Providers → Google → colar client ID + secret → enable.
- [ ] **Step 5**: No código, adicionar botão "Continuar com Google" no `/book` (Épico 5) — `supabase.auth.signInWithOAuth({ provider: 'google' })`.

**Manual-action flag:** user precisa do acesso admin do Google Cloud + Supabase Dashboard. Prod terá credencial separada.

**Aceite:** Cliente clica botão Google no booking, redireciona pra consent do Google, volta logado.

---

## Task 17: Edição e soft-delete de cadastros

**Origem:** Épico 3 entregou só **create + list** (mobile-first MVP). Edição, desativar/reativar, e delete não existem ainda.

**Scope:**
- [ ] Profissional: editar nome/telefone/comissão, toggle is_active
- [ ] Serviço: editar nome/descrição/duração/preço, toggle is_active
- [ ] Rota `/profissionais/[id]` e `/servicos/[id]` (ou sheet/drawer inline)
- [ ] Ações server `updateProfessionalAction`, `updateServiceAction`, `toggleProfessionalActiveAction`, `toggleServiceActiveAction`

**Aceite:** Salão consegue editar qualquer cadastro criado anteriormente sem SQL manual.

---

## Task 18: UI do join `professional_services`

**Origem:** Tabela `professional_services` existe (migration 0012) mas não tem UI. Necessário pro Épico 5 filtrar "quais profissionais fazem este serviço".

**UI proposta:** no detalhe do profissional, checklist de serviços do salão. Toggle on/off cria/deleta linha em `professional_services`.

**Aceite:** Configurável pelo staff; afeta a lista de profissionais exibida no booking público.

---

## Task 19: UIs de `professional_availability` e `availability_blocks`

**Origem:** Tabelas existem (migrations 0014 e 0015) mas sem UI. **Blocker do Épico 4** (agenda core) — sem availability definido, não dá pra calcular slots livres.

**UI proposta (availability):** por profissional, editor de 7 dias (similar a `business_hours`) com suporte a múltiplas janelas por dia (ex: manhã + tarde).

**UI proposta (blocks):** lista de folgas/férias/indisponibilidades pontuais do profissional; form inline com `start_at`, `end_at`, `reason`.

**Aceite:** Profissional consegue configurar agenda recorrente + marcar exceções; Épico 4 consegue calcular disponibilidade real.

---

## Task 20: Otimizar policies RLS com `(select auth.uid())`

**Origem:** Advisor `auth_rls_initplan`. Postgres re-avalia `auth.uid()` por linha ao invés de uma vez. Em tabelas pequenas não impacta; quando `appointments` crescer sem esse wrap a query planner sofre.

**Policies afetadas (hoje):**
- `public.plans.plans_read_authenticated`
- `public.user_profiles.user_profiles_self_read`
- `public.customers.customers_self_read`
- `public.customers.customers_self_update`

**Fix:** migration que faz `alter policy ... using ((select auth.uid()) = user_id)` em cada uma.

**Aceite:** 0 ocorrências de `auth_rls_initplan` no advisor.

---

## Task 21: Consolidar policies permissivas duplicadas

**Origem:** Advisor `multiple_permissive_policies` (170 lints). Cada tabela com RLS tem duas policies `FOR ALL`: uma pra platform admin (`is_platform_admin()`) e outra pra staff do tenant (`tenant_id = current_tenant_id()`). Postgres avalia ambas pra cada linha.

**Opções:**
- (a) Consolidar em policy única com `OR`. Perde legibilidade, ganha ~10% em workload pesado.
- (b) Manter como está e suprimir o lint. Código legível > micro-otimização.

**Decisão sugerida:** manter (b) enquanto não houver workload que provoque contenção. Registra o trade-off.

---

## Task 22: Índices cobrindo FKs

**Origem:** Advisor `unindexed_foreign_keys`. DELETEs e JOINs em FK sem índice fazem full scan.

**Fix:** adicionar índices em:
- `public.availability_blocks (tenant_id)`
- `public.professionals (user_id)`
- `public.tenants (current_plan_id)`

**Aceite:** 0 ocorrências no advisor.

---

## Task 23: Endurecimento Supabase Auth + Storage

**Origem:** Advisor security WARN.

**Passos manuais:**
- [ ] **Step 1:** Supabase Dashboard → Authentication → Password protection → enable "Check against HaveIBeenPwned". Protege customer signup/reset quando tivermos password-based (Fase 2).
- [ ] **Step 2 (avaliar):** bucket `tenant-assets` é público com policy `tenant_assets_public_read` que permite **listar** todos os arquivos. Usuários só precisam de URL direta pra carregar logo/favicon. Decidir: (a) deixar como está, (b) trocar policy por `authenticated only` (quebra `<img src>` externos?), (c) renomear arquivos com slug hash pra URLs não-advinháveis.

**Manual-action flag:** depende do dashboard Supabase.

---

## Task 24: Exibir `tenants.city` (já existe) na home + UI de edição

**Origem:** Sessão 2026-04-19. Home do tenant exibe `Barbearia · {tenant.timezone}` no header (`src/app/page.tsx`). Usuário pediu pra mostrar a cidade; foi hardcoded "Arapongas".

**Descoberta posterior (mesma sessão):** a coluna `city text` já existe em `tenants` (+ `state`, `address_line1/2`, `postal_code`). Não precisa de migration. Tenant recém-criado `bela-imagem` já foi populado com `city='Arapongas'`, `state='PR'`.

**Files:**
- Update: `src/lib/tenant/context.ts` — incluir `city` no select (`TenantContext` já pode expor)
- Update: `src/app/page.tsx:132` — trocar `Arapongas` hardcoded por `{tenant.city}` (fallback: esconder linha se null)
- Update: `src/app/salon/(authenticated)/dashboard/perfil/page.tsx` — input de cidade/estado
- Backfill: popular `city` nos 3 tenants antigos (barbearia-teste, casa-do-corte, barba-preta)

**Steps:**

- [ ] **Step 1:** Incluir `city` no select de `getCurrentTenantOrNotFound()` e no tipo `TenantContext`.
- [ ] **Step 2:** Home: `{tenant.city ?? null}`. Se null, esconder o `· <city>` — não mostrar timezone como antes.
- [ ] **Step 3:** Form de edição em `/salon/dashboard/perfil` pra staff atualizar city/state.
- [ ] **Step 4:** Backfill via `mcp__supabase__execute_sql` — UPDATE com city pros 3 tenants antigos.

**Prioridade:** Baixa — afeta só estética do header.

---

## Regra: novo débito = linha no índice

Quando descobrir um novo débito durante outro épico:
1. Cria memory em `~/.claude/projects/-Users-thiagotavares-Projects-a-labs-tech-ara-barber/memory/` (tipo `project`) quando o débito tiver contexto/decisão worth lembrando.
2. Anexa uma linha no **índice** deste arquivo.
3. Cria uma task nova aqui embaixo se for concreta o suficiente.

**Registrar sempre, mesmo sem certeza** — curadoria é feita em revisão periódica; items inválidos recebem status `rejected` e ficam de histórico. Custo de registrar é baixo; custo de esquecer débito que vira bug em prod é alto.

Não para a entrega do épico corrente.
