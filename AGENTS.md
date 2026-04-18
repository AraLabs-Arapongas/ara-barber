<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# ara-barber — Guia para Agents

## Antes de escrever código

1. **Consulte context7** (MCP) para docs atuais de Next.js 16, Tailwind 4, `@supabase/ssr` e outras libs fora do training-cutoff.
2. **Use o MCP `supabase`** para gerar migrations, aplicar schema e gerar tipos TypeScript. Evite SQL manual.
3. **Leia o spec primeiro:** `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md`.
4. **Plans por épico:** `docs/superpowers/plans/2026-04-18-epic-*.md`.

## Convenções do projeto

- **Mobile-first + PWA app-like.** Toda UI nasce pensada em celular; PWA é core, não extra.
- **RLS do Postgres é isolamento primário.** Proxy e validação de app são defesa em profundidade.
- **Server Actions default.** Route Handlers (`/api/*`) só quando Server Action não serve (manifest dinâmico, webhooks).
- **3 clientes Supabase:**
  - `createClient()` de `@/lib/supabase/browser` — client components.
  - `createClient()` de `@/lib/supabase/server` — server components, server actions, route handlers.
  - `createSecretClient()` de `@/lib/supabase/secret` — jobs, leitura pública, bypass de RLS. **Server-only**.
- **Keys Supabase:** usar o esquema novo `publishable` (client) + `secret` (server). Env vars: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`. Não usar mais `anon` / `service_role`.
- **Proxy (não middleware):** Next 16 renomeou a convenção. Arquivo é `src/proxy.ts` e função `proxy()`.
- **Nunca confiar em `tenantId` vindo do cliente** — usar sempre o resolvido pelo proxy.
- **Toda mutation passa por Zod** antes de tocar o banco.
- **Toda tabela com `tenantId` tem 4 policies RLS** (platform admin / staff / customer read / customer write) e teste pgTAP correspondente.

## Comandos principais

```bash
pnpm dev              # Next.js dev server
pnpm build            # production build
pnpm test             # Vitest (unit)
pnpm test:e2e         # Playwright
pnpm test:rls         # pgTAP (quando épico 1 adicionar)
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # TSC
supabase start        # Supabase local (Docker)
supabase db push      # Aplicar migrations
supabase gen types typescript --local > src/lib/supabase/types.ts
```

## Arquitetura (resumo)

- 1 Next.js app, 3 áreas lógicas: `(public)/`, `(salon)/`, `(platform)/` — separadas por route groups e proxy de host.
- Proxy resolve tenant por host (subdomínio `.aralabs.com.br` ou `.lvh.me` em dev).
- Platform admin mora em `admin.aralabs.com.br` (sem tenant).
- Supabase: Postgres + Auth + Storage + Realtime + pg_cron.
- Billing parametrizado em DB (trial + assinatura + taxa por transação); na Fase 1 sem cobrança real.

## Fases

- Fase 1 (atual): Core operável sem pagamento real.
- Fase 2+: Pagamento, comunicação, premium.
