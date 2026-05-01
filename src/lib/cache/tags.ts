/**
 * Convenções de tags pra `unstable_cache` do Next.
 *
 * Toda tag é scoped por tenant pra evitar invalidação cruzada (mudar
 * profissional do tenant A NÃO deve invalidar cache do tenant B).
 *
 * Hierarquia:
 *   tenant:{id}:{recurso}                ← coleção (ex: lista de profs)
 *   tenant:{id}:{recurso}:{itemId}       ← item específico
 *   tenant:{id}:agenda:{dateISO}         ← agenda de 1 dia
 *
 * Pattern de uso em queries:
 *   ```
 *   import { unstable_cache } from 'next/cache'
 *   async function getFoo(tenantId: string) {
 *     return unstable_cache(
 *       async () => { ... },
 *       ['getFoo', tenantId],
 *       { tags: [cacheTags.foo(tenantId)], revalidate: 86400 },
 *     )()
 *   }
 *   ```
 *
 * Pattern de invalidação em server actions (read-your-own-writes):
 *   ```
 *   import { updateTag } from 'next/cache'
 *   updateTag(cacheTags.foo(tenantId))
 *   ```
 *
 * Em route handlers ou contextos non-action use
 * `revalidateTag(tag, 'max')` (Next 16 exige profile).
 */

const t = (tenantId: string) => `tenant:${tenantId}`

export const cacheTags = {
  // Agenda — granular por dia. Realtime invalida via server action.
  agendaDay: (tenantId: string, dateISO: string) => `${t(tenantId)}:agenda:${dateISO}`,
  agendaWeek: (tenantId: string, weekStartISO: string) =>
    `${t(tenantId)}:agenda:week:${weekStartISO}`,
  agendaPending: (tenantId: string) => `${t(tenantId)}:agenda:pending`,

  // Profissionais
  professionals: (tenantId: string) => `${t(tenantId)}:professionals`,
  professional: (tenantId: string, profId: string) =>
    `${t(tenantId)}:professional:${profId}`,

  // Serviços
  services: (tenantId: string) => `${t(tenantId)}:services`,
  service: (tenantId: string, serviceId: string) =>
    `${t(tenantId)}:service:${serviceId}`,

  // Disponibilidade (jornada de trabalho dos profs)
  availability: (tenantId: string) => `${t(tenantId)}:availability`,
  availabilityFor: (tenantId: string, profId: string) =>
    `${t(tenantId)}:availability:${profId}`,

  // Settings tenant-level (raramente mudam — cache long-lived)
  businessHours: (tenantId: string) => `${t(tenantId)}:business_hours`,
  tenantSettings: (tenantId: string) => `${t(tenantId)}:settings`,

  // Vínculos serviço × profissional
  professionalServices: (tenantId: string) =>
    `${t(tenantId)}:professional_services`,
} as const
