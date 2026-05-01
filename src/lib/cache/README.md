# Cache Components — convenções

Habilitamos `cacheComponents: true` no `next.config.ts` (Next 16). Toda query
RSC que valha cachear segue este padrão.

## Quando cachear

Cacheia se a query:

- Roda em RSC (server component) — não mistura cache em route handlers.
- Lê dados que **não mudam a cada request** (ex: lista de profs, agenda do dia).
- A invalidação tem um trigger claro (mutation explícita OU evento realtime).

**Não cacheie** se:

- Os dados mudam por timing/conjunto que muda fora do nosso controle (ex:
  `now()` calculado server-side).
- A query depende de cookies/sessão de modo crítico (use `cookies()` antes do
  `'use cache'` ou separe as camadas).

## Pattern de leitura

```ts
'use cache'
import { cacheLife, cacheTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'

export async function getAgendaForDay(tenantId: string, dateISO: string, tz: string) {
  'use cache'
  cacheLife('days')
  cacheTag(cacheTags.agendaDay(tenantId, dateISO))

  // ... query supabase aqui
}
```

`cacheLife('days')` = duração long; relying on tag invalidation pra freshness.
Use `'minutes'` ou `'seconds'` só pra dados que precisam fallback de TTL além
da invalidação por tag.

## Pattern de invalidação

### 1. Em server actions (mutation explícita)

```ts
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'

export async function createAppointment(...) {
  // ... insert no DB
  revalidateTag(cacheTags.agendaDay(tenantId, dateISO))
  revalidateTag(cacheTags.agendaPending(tenantId))
}
```

### 2. Via realtime (client → server action)

Hook `RealtimeAppointmentsRefresh` recebe postgres_changes do Supabase e
chama `invalidateAgendaForDay(tenantId, dateISO)` antes de `router.refresh()`.
Isso garante que o re-fetch RSC venha do DB e não do cache.

Server actions de invalidação ficam em `src/lib/cache/invalidations.ts`.
Toda exige `assertStaff()` porque seriam endpoints públicos abusáveis.

## Convenção de tags

Ver `src/lib/cache/tags.ts`. Tags são scoped por tenant pra evitar
invalidação cruzada. Granular onde a granularidade compensa (1 tag por dia
de agenda em vez de 1 pra agenda inteira).

## Migração incremental

Refactor inicial cobriu **agenda + professionals + services**. Outros
módulos (clientes, financeiro, reports) ficam pra demanda — quando notar
re-fetch desnecessário entre navegações, adiciona o trio (`use cache` +
`cacheLife` + `cacheTag`) na query e `revalidateTag` na mutation.
