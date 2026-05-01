/**
 * Convenções de tags pra Cache Components do Next 16.
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
 *   async function getFoo(tenantId: string) {
 *     'use cache'
 *     cacheLife('days')
 *     cacheTag(cacheTags.foo(tenantId))
 *     // ...
 *   }
 *   ```
 *
 * Pattern de invalidação em mutations:
 *   ```
 *   import { revalidateTag } from 'next/cache'
 *   revalidateTag(cacheTags.foo(tenantId))
 *   ```
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
