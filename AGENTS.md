<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# ara-barber — Guia para Agents

## Escopo deste repo

**Apenas produto tenant-facing.**

- `<slug>.aralabs.com.br/` — home pública do salão (cliente final).
- `<slug>.aralabs.com.br/salon/*` — área autenticada do staff do salão.
- `<slug>.aralabs.com.br/api/manifest/[slug]` — manifest PWA dinâmico.

**Fora do escopo** (migrado para `aralabs-storefront`): painel administrativo da plataforma. Veja `docs/superpowers/specs/2026-04-19-platform-admin-handoff.md`.

## Antes de escrever código

1. **Consulte context7** (MCP) para docs atuais de Next.js 16, Tailwind 4, `@supabase/ssr` e outras libs fora do training-cutoff.
2. **Use o MCP `supabase`** para aplicar migrations, gerar tipos TypeScript, consultar advisors e rodar SQL. Evite SQL manual direto no dashboard.
3. **Leia o spec primeiro:** `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md`.
4. **Plans por épico:** `docs/superpowers/plans/2026-04-18-epic-*.md`.

## Convenções do projeto

- **Mobile-first + PWA app-like.** Toda UI nasce pensada em celular; PWA é core, não extra.
- **RLS do Postgres é isolamento primário.** Proxy e validação de app são defesa em profundidade.
- **Server Actions default.** Route Handlers (`/api/*`) só quando Server Action não serve (manifest dinâmico, webhooks).
- **3 clientes Supabase:**
  - `createClient()` de `@/lib/supabase/browser` — client components.
  - `createClient()` de `@/lib/supabase/server` — server components, server actions, route handlers.
  - `createSecretClient()` de `@/lib/supabase/secret` — jobs, leitura pública do manifest, bypass de RLS. **Server-only**.
- **Keys Supabase:** esquema novo `publishable` (client) + `secret` (server). Env vars: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`.
- **Proxy (não middleware):** Next 16 renomeou a convenção. Arquivo é `src/proxy.ts` e função `proxy()`.
- **Nunca confiar em `tenantId` vindo do cliente** — usar sempre o resolvido pelo proxy (`x-ara-tenant-id` header).
- **Toda mutation passa por Zod** antes de tocar o banco.
- **Toda tabela com `tenant_id` tem policies RLS** cobrindo platform admin, staff, customer read, customer write; role `PLATFORM_ADMIN` fica definida mesmo que a UI correspondente more em outro repo.

## Comandos principais

```bash
pnpm dev              # Next.js dev server (porta 3008)
pnpm build            # production build
pnpm test             # Vitest (unit)
pnpm test:e2e         # Playwright (desativado no CI — ver Épico 10)
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # TSC
```

**Operações Supabase (via MCP na sessão Claude):**

- `apply_migration(name, query)` para DDL.
- `execute_sql(query)` para dados/consultas.
- `generate_typescript_types()` para regenerar `src/lib/supabase/types.ts`.
- `get_advisors({type: 'security' | 'performance'})` após mudanças DDL.

## Arquitetura (resumo)

- 1 Next.js app cobrindo 2 áreas: `tenant` (subdomínio `.aralabs.com.br` ou `.lvh.me` em dev) e `root` (landing dev / redirect pra storefront AraLabs em prod).
- Proxy resolve tenant por host. Subdomínios reservados (`admin`, `www`, `api`, `app`) caem em `root`.
- Tenant-facing code mora em `src/app/salon/*` (autenticado, guard via `assertStaff`) e `src/app/page.tsx` (home pública do tenant quando area=tenant).
- Supabase cloud (projeto `sixgkgiirifigoiqbyow`): Postgres + Auth + Storage + Realtime + pg_cron.
- Branding por tenant: `ThemeInjector` em layouts injeta `--brand-*` CSS vars sobrescrevendo defaults do design system.
- Billing parametrizado em DB (trial + assinatura + taxa por transação); Fase 1 sem cobrança real.

## Tenants de dev

Já seedados no projeto Supabase:

| slug              | nome                         | primary   | accent    |
| ----------------- | ---------------------------- | --------- | --------- |
| `barbearia-teste` | Barbearia Teste              | `#17343f` | `#b9945a` |
| `casa-do-corte`   | Casa do Corte                | `#2d5447` | `#d4a574` |
| `barba-preta`     | Barba Preta                  | `#1a1a1a` | `#c8102e` |
| `bela-imagem`     | Bela Imagem Centro de Beleza | `#9d4d6e` | `#e6c8a0` |

Acessar em dev: `http://<slug>.lvh.me:3008/`.

## Fases

- Fase 1 (atual): Core operável sem pagamento real.
- Fase 2+: Pagamento, comunicação, premium.
