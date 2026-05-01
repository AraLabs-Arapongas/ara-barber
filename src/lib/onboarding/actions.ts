'use server'

import { z } from 'zod'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const BusinessHourDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    start_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
    end_time: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
  })
  .refine(
    (d) => !d.is_open || d.start_time < d.end_time,
    { message: 'start_time deve ser menor que end_time quando aberto' },
  )

export const BusinessHoursStepSchema = z.object({
  days: z.array(BusinessHourDaySchema).length(7, 'Exatamente 7 dias'),
})

export const ServicesStepSchema = z.object({
  services: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(120),
        duration_minutes: z.coerce.number().int().positive('Duração > 0'),
        price_cents: z.coerce.number().int().nonnegative('Preço >= 0'),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 serviço'),
})

export const ProfessionalsStepSchema = z.object({
  professionals: z
    .array(
      z.object({
        name: z.string().min(1, 'Nome obrigatório').max(80),
      }),
    )
    .min(1, 'Cadastre pelo menos 1 profissional'),
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const LinksStepSchema = z.object({
  links: z
    .array(
      z.object({
        service_id: z.string().regex(UUID_REGEX, 'UUID inválido'),
        professional_id: z.string().regex(UUID_REGEX, 'UUID inválido'),
      }),
    )
    .min(1, 'Marque pelo menos 1 vínculo'),
})
