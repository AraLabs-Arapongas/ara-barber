import { z } from 'zod'

const uuid = z.string().uuid()
const nonEmptyString = z.string().trim().min(1).max(200)
const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))
const optionalEmail = z
  .string()
  .trim()
  .email()
  .nullish()
  .transform((v) => (v ? v : null))

export const professionalSchema = z.object({
  name: nonEmptyString,
  displayName: optionalString(100),
  photoUrl: z.string().trim().url().nullish().transform((v) => (v ? v : null)),
  phone: optionalString(30),
  isActive: z.boolean().default(true),
})

export const customerSchema = z.object({
  name: nonEmptyString,
  phone: z.string().trim().min(8).max(30),
  whatsapp: optionalString(30),
  email: optionalEmail,
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish()
    .transform((v) => (v ? v : null)),
  notes: optionalString(1000),
  isActive: z.boolean().default(true),
})

export const serviceSchema = z
  .object({
    name: nonEmptyString,
    description: optionalString(1000),
    durationMinutes: z.number().int().min(5).max(480),
    priceCents: z.number().int().min(0),
    depositRequired: z.boolean().default(false),
    depositType: z.enum(['FIXED', 'PERCENTAGE']).nullish(),
    depositValueCents: z.number().int().min(0).nullish(),
    depositPercentage: z.number().int().min(0).max(10000).nullish(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (v) => !v.depositRequired || (v.depositType !== null && v.depositType !== undefined),
    { message: 'Depósito exigido sem tipo definido' },
  )

export const professionalServiceLinkSchema = z.object({
  professionalId: uuid,
  serviceId: uuid,
})

export const businessHoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isOpen: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, { message: 'startTime deve ser menor que endTime' })

export const professionalAvailabilitySchema = z
  .object({
    professionalId: uuid,
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, { message: 'startTime deve ser menor que endTime' })

export const availabilityBlockSchema = z
  .object({
    professionalId: uuid,
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: optionalString(200),
  })
  .refine((v) => v.startAt < v.endAt, { message: 'startAt deve ser menor que endAt' })

export type ProfessionalInput = z.infer<typeof professionalSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type ServiceInput = z.infer<typeof serviceSchema>
export type ProfessionalServiceLinkInput = z.infer<typeof professionalServiceLinkSchema>
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>
export type ProfessionalAvailabilityInput = z.infer<typeof professionalAvailabilitySchema>
export type AvailabilityBlockInput = z.infer<typeof availabilityBlockSchema>
