# Rebrand `ara-barber` → `ara-agenda` — Design Spec

**Data:** 2026-04-26
**Autor:** Thiago + Claude
**Status:** aprovado, em execução

## 1. Motivação

O produto começou como SaaS de barbearia, mas a tese real é **agenda online + presença digital pra qualquer SMB que vende tempo por horário** — barbearia, salão, estética, clínica, oficina, mecânico, etc. O codebase ainda carrega o nome `ara-barber` e vocabulário "salão/barbearia" em vários lugares. Isso precisa sumir antes do produto ganhar tração e o débito virar custo de migração de dados/branding/marketing.

**Beachhead atual:** beleza & estética (barbearia/salão). Mas nada na arquitetura, schema ou copy deve travar essa expansão.

## 2. Decisões (já tomadas em brainstorming)

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Role enum: `SALON_OWNER` → `BUSINESS_OWNER` | Termo neutro cobre qualquer vertical. `STAFF`, `PLATFORM_ADMIN` ficam |
| 2 | URL path: `/salon/*` → `/admin/*` | Já é a área autenticada do dono. `/admin` é universal |
| 3 | Copy PT-BR: "salão" → "empresa" / "estabelecimento" | Por contexto, não busca cega |
| 4 | Docs históricos: surgical (opção A) | Specs/plans antigos ganham 1 linha de nota; conteúdo intacto |
| 5 | Pasta local: renomear filesystem `ara-barber` → `ara-agenda` | Git remote já está em `ara-agenda` |

## 3. Não-objetivos

- Não muda schema do DB além do enum `user_role`
- Não muda nome de tabelas/colunas (já neutros: `tenants`, `tenant_id`, `user_profiles`)
- Não reescreve histórico git
- Não muda domínio (`aralabs.com.br` permanece)
- Não muda branding visual (logo AraLabs, paleta, fontes)
- Não toca migrations antigas
- Não muda nada em `aralabs-storefront` (outro repo)

## 4. Escopo do código

### 4.1 Filesystem

```
ara-barber/                    →   ara-agenda/        (rename pasta)
└── src/app/salon/             →   src/app/admin/     (git mv)
```

`src/app/salon/` contém:
- `(authenticated)/` — dashboard staff
- `forgot-password/`
- `login/`
- `reset-password/`

Tudo move atomicamente.

### 4.2 Enum + role

```sql
ALTER TYPE user_role RENAME VALUE 'SALON_OWNER' TO 'BUSINESS_OWNER';
```

Postgres resolve enum por OID, então RLS policies que referenciam o valor não precisam ser reescritas.

**TS literais a substituir:**
- `'SALON_OWNER'` → `'BUSINESS_OWNER'`
- Comentários mencionando "salon owner" / "dono do salão" → "business owner" / "dono da empresa"

**Arquivos confirmados (do grep):**
- `src/lib/auth/roles.ts` — fonte do enum + arrays helpers (`STAFF_ROLES`)
- `src/lib/customers/ensure.ts:25`
- `src/lib/supabase/types.ts` — auto-gerado, vai ser regenerado pós-migration
- `tests/unit/auth/roles.test.ts`
- `tests/unit/auth/guards.test.ts`
- `supabase/functions/_shared/channels/push.ts` — edge function precisa redeploy

### 4.3 URL paths `/salon/*` → `/admin/*`

Inclui:
- Imports `@/app/salon/*` em components
- Strings literais em `redirect()`, `Link href`, `router.push()`
- `emailRedirectTo` em forgot-password actions
- `bottom-tab-nav.tsx`, `global-fab.tsx`, layouts
- `out-of-pilot-stub.tsx` (CTAs)
- Server actions de listagem que retornam paths

**Proxy redirect:** adicionar em `src/proxy.ts` redirect 302 de `/salon/*` → `/admin/*` por 30 dias para preservar bookmarks/links externos. Após 30 dias, remover.

### 4.4 Copy PT-BR

Substituição contextual (não busca cega):

| Contexto | "salão" → |
|---|---|
| Entidade jurídica/conta | "empresa" |
| Local físico | "estabelecimento" |
| Possessivo genérico | reformular ("a equipe", "o negócio", omitir) |

**Arquivos confirmados (do grep):**
- `src/lib/booking/slots.ts` (comentários)
- `src/components/nav/global-fab.tsx`
- `supabase/functions/_shared/templates/booking-canceled.ts`
- `src/app/perfil/actions.ts`
- `src/app/salon/login/login-form.tsx`
- `src/app/salon/(authenticated)/loading.tsx`
- `src/app/salon/forgot-password/forgot-password-form.tsx`

### 4.5 Docs ativos (rewrite completo)

- `AGENTS.md` — rewrite: nome do produto, escopo (`/admin/*`), exemplos genéricos. Mantém a lista de tenants seedados como "negócios de exemplo"
- `README.md` — title, descrição
- `package.json#name` — `"ara-barber"` → `"ara-agenda"`
- `docs/smoke-test-pilot.md` — todas URLs `/salon/*` → `/admin/*`, copy

### 4.6 Auto-memory

- `MEMORY.md` (índice) — atualizar hook lines que mencionam "salão"
- `project_money_flow.md` — body
- `project_salon_login_branding_tech_debt.md` — renomear arquivo + conteúdo + pointer no índice

### 4.7 Docs históricos (surgical, opção A)

Adicionar 1 linha no topo de cada um:

```markdown
> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.
```

Aplica em:
- `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md`
- `docs/superpowers/specs/2026-04-19-platform-admin-handoff.md`
- `docs/superpowers/specs/2026-04-19-preview-tracks.md`
- `docs/superpowers/specs/2026-04-19-spec-01-operacao-agenda-design.md`
- `docs/superpowers/specs/2026-04-20-notifications-design.md`
- `docs/superpowers/specs/2026-04-25-staff-password-recovery-design.md`
- `docs/superpowers/plans/2026-04-18-epic-01-auth-base.md`
- `docs/superpowers/plans/2026-04-18-epic-05-public-booking.md`
- `docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md`
- `docs/superpowers/plans/2026-04-19-spec-01-operacao-agenda.md`
- `docs/superpowers/plans/2026-04-20-notifications.md`
- `docs/superpowers/plans/2026-04-25-staff-password-recovery.md`

## 5. Não-mexer (deliberado)

- Tabelas/colunas DB (`tenant_id`, `tenants`, `user_profiles`) — neutros
- Migrations antigas — imutáveis por convenção
- Git log / commit messages — histórico imutável
- `aralabs.com.br` domain
- Nomes de tenants seedados (`barbearia-teste`, `casa-do-corte`, `barba-preta`, `bela-imagem`) — são fixtures de exemplo

## 6. Ordem de execução

```
1. Filesystem: rename pasta local ara-barber → ara-agenda
2. Codebase TS:
   2.1. git mv src/app/salon → src/app/admin
   2.2. find/replace literais 'SALON_OWNER' → 'BUSINESS_OWNER'
   2.3. find/replace paths /salon/ → /admin/
   2.4. STAFF_ROLES, comments, helpers
   2.5. emailRedirectTo: /admin/reset-password
   2.6. copy PT-BR (salão → empresa)
3. Docs ativos: AGENTS.md, README.md, package.json#name, smoke-test-pilot.md
4. Validação local: pnpm typecheck && pnpm lint && pnpm test (TEM que passar)
5. DB migration via apply_migration MCP:
   ALTER TYPE user_role RENAME VALUE 'SALON_OWNER' TO 'BUSINESS_OWNER'
6. Regenerate types via generate_typescript_types MCP
7. Re-typecheck (confirma TS bate com enum novo)
8. Edge functions redeploy se referenciam SALON_OWNER
9. Memory files + docs históricos com nota de rebrand
10. Proxy redirect /salon/* → /admin/* 302 (TTL 30 dias)
11. Commit local (NÃO pushar)
12. Pendente: Supabase dashboard add /admin/reset-password em allowlist (manual)
13. User decide quando deployar
```

## 7. Riscos + mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Hardcoded `'SALON_OWNER'` em TS escapou do grep | Média | Grep duplo + typecheck pega o resto após `generate_typescript_types` |
| Edge function continua referenciando enum antigo | Alta se não redeploy | Step 8 obrigatório |
| RLS policy quebra | Baixa (Postgres resolve enum por OID) | Verificar `get_advisors({type: 'security'})` pós-migration |
| URL antiga `/salon/*` em bookmark/email | Certa | Proxy redirect 302 por 30 dias |
| Email recovery já enviado com link `/salon/reset-password` | Possível durante deploy | Mesmo redirect resolve. Links expiram em 1h |
| Supabase Auth redirect URLs allowlist | Nenhum | URL real enviado é `/auth/callback?next=...` — não muda. Query params não vão pra allowlist |

## 8. Rollback

**Cenário A — quebrou no build local (pré-deploy):**
- `git reset --hard` no commit pré-rebrand
- Reverter migration: `ALTER TYPE user_role RENAME VALUE 'BUSINESS_OWNER' TO 'SALON_OWNER'`
- Sem perda de dados

**Cenário B — deployou e quebrou em prod:**
- Vercel rollback pro deploy anterior (1 click)
- Reverter migration (mesmo comando)
- ETA: <5 min

**Cenário C — DB renomeado mas TS antigo:**
- Não deve acontecer se ordem da seção 6 for seguida
- Se acontecer: rename reverso no DB, regenerate types, decidir se prossegue

## 9. Testing strategy

**Antes do migration DB:**
- `pnpm typecheck` — zero erros
- `pnpm lint` — zero erros
- `pnpm test` — todos verdes
- `rg -i "salon"` em src/ + docs ativos — só aparece em comentários históricos / docs antigos com nota de rebrand

**Depois do migration DB:**
- Login em `barbearia-teste.lvh.me:3008/admin/login` com user staff existente (PRECISA funcionar — RLS depende do enum)
- Listar agendamentos (RLS check)
- Forgot password → email chega → link `/admin/reset-password` → reset funciona
- `get_advisors({type: 'security'})` — sem novos warnings

**Após deploy prod:**
- Smoke test completo (`docs/smoke-test-pilot.md` atualizado)
- Verificar `barbearia-teste.aralabs.com.br/admin/dashboard` carrega
- URL antiga `/salon/dashboard` redireciona 302 pra `/admin/dashboard`

## 10. Ações manuais necessárias

- **Supabase dashboard:** nada. URL enviado pelo `resetPasswordForEmail` é `/auth/callback?next=/admin/reset-password` — a base `/auth/callback` já está na allowlist e o `next` é query param (não vai pra allowlist).
- **Vercel:** nada — rebuild automático no push (quando user autorizar)
- **DNS:** nada
