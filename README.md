# ara-barber

SaaS multi-tenant para barbearias e salões — Fase 1 (Core Operável).

## Setup local

### Pré-requisitos

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker Desktop rodando
- Supabase CLI: `brew install supabase/tap/supabase`

### Instalação

```bash
pnpm install
cp .env.local.example .env.local
supabase start
# copiar publishable key e secret key para .env.local
pnpm dev
```

Acessar `http://localhost:3000`.

Para testar subdomínios em dev, acessar `http://qualquercoisa.lvh.me:3000` (lvh.me resolve para 127.0.0.1 com qualquer subdomain).

### Comandos

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # TypeScript check
supabase db push      # aplicar migrations
```

## Estrutura

- [AGENTS.md](./AGENTS.md) — guia de arquitetura e convenções (para humanos e agents).
- [docs/superpowers/specs/](./docs/superpowers/specs/) — specs de produto.
- [docs/superpowers/plans/](./docs/superpowers/plans/) — planos de implementação por épico.
