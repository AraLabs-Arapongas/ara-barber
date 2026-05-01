# Cache de queries — convenções

Usamos `unstable_cache` (legacy mas estável) pra memoizar queries RSC com
invalidação por tag. Cache Components do Next 16 (`'use cache'` + `cacheLife`
+ `cacheTag`) exige Suspense everywhere — refactor invasivo demais pro app
atual. Reabilitar `cacheComponents: true` quando a árvore inteira for
suspense-first.

## Quando cachear

Cacheia se a query:

- Roda em RSC (server component).
- Lê dados que **não mudam a cada request** (ex: lista de profs, agenda do dia).
- A invalidação tem trigger claro (mutation explícita OU evento realtime).

**Não cacheie** se:

- Os dados mudam por timing fora do nosso controle (ex: `now()` calculado
  server-side a cada request).
- A query depende de cookies/sessão — `unstable_cache` não vê cookies. Use
  `createSecretClient()` (bypass RLS) e garanta auth no caller.

## Pattern de leitura

```ts
import 'server-only'
import { unstable_cache } from 'next/cache'
import { createSecretClient } from '@/lib/supabase/secret'
import { cacheTags } from '@/lib/cache/tags'

export async function getAgendaForDay(tenantId: string, dateISO: string, tz: string) {
  return unstable_cache(
    async () => {
      const supabase = createSecretClient()
      // ... query
      return data
    },
    ['getAgendaForDay', tenantId, dateISO, tz],
    { tags: [cacheTags.agendaDay(tenantId, dateISO)], revalidate: 86400 },
  )()
}
```

Notas:

- A cache key array (`['getAgendaForDay', tenantId, dateISO, tz]`) precisa
  conter todos os args que diferenciam o resultado — senão dá cache hit
  cruzado entre tenants/datas.
- `revalidate: 86400` (1 dia) é o fallback de TTL. Invalidação real vem por
  tag. Use `60` (1min) ou `3600` (1h) pra dados mais voláteis.
- O `()` final invoca o wrapper retornado por `unstable_cache`.

## Pattern de invalidação

### 1. Em server actions (mutation explícita)

Use `updateTag` (single-arg, read-your-own-writes — em Next 16 é o
primitivo recomendado pra server actions; `revalidateTag` agora exige
profile e é melhor pra route handlers):

```ts
import { updateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'

export async function createAppointment(...) {
  // ... insert no DB
  updateTag(cacheTags.agendaDay(tenantId, dateISO))
  updateTag(cacheTags.agendaPending(tenantId))
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
re-fetch desnecessário entre navegações, envolve a query em
`unstable_cache` e adiciona `updateTag` na mutation correspondente.

## Roadmap: voltar pra Cache Components

Quando o app virar suspense-first (todas as boundaries com `<Suspense>` em
volta de leituras async), reabilitar `cacheComponents: true` em
`next.config.ts` e migrar de volta pro trio `'use cache'` + `cacheLife` +
`cacheTag`. Isso desbloqueia PPR e granularidade fina por componente.
