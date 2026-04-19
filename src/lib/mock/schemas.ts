import { z } from 'zod'

// Entidades (scoped por tenant no localStorage)

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  phone: z.string().nullable(),
  photoUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int(),
  priceCents: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

export const customerSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

export const businessHoursRowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isOpen: z.boolean(),
})

export const professionalServiceLinkSchema = z.object({
  professionalId: z.string(),
  serviceId: z.string(),
})

export const availabilityEntrySchema = z.object({
  id: z.string(),
  professionalId: z.string(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
})

export const availabilityBlockSchema = z.object({
  id: z.string(),
  professionalId: z.string(),
  startAt: z.string(), // ISO
  endAt: z.string(),
  reason: z.string().nullable(),
})

export const appointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELED',
  'NO_SHOW',
])

export const appointmentSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  professionalId: z.string(),
  serviceId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: appointmentStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export const payoutSchema = z.object({
  id: z.string(),
  periodStart: z.string(), // YYYY-MM-DD
  periodEnd: z.string(),
  grossCents: z.number().int(),
  feeCents: z.number().int(),
  netCents: z.number().int(),
  status: z.enum(['PENDING', 'PAID']),
  paidAt: z.string().nullable(),
})

export const tenantProfileSchema = z.object({
  name: z.string(),
  tagline: z.string().nullable(),
  address: z.string().nullable(),
  whatsapp: z.string().nullable(),
  timezone: z.string(),
})

export const operationModeSchema = z.object({
  pinHash: z.string().nullable(),
  enabled: z.boolean(),
})

// Collections

export const professionalsSchema = z.array(professionalSchema)
export const servicesSchema = z.array(serviceSchema)
export const customersSchema = z.array(customerSchema)
export const businessHoursSchema = z.array(businessHoursRowSchema)
export const professionalServicesSchema = z.array(professionalServiceLinkSchema)
export const availabilitySchema = z.array(availabilityEntrySchema)
export const availabilityBlocksSchema = z.array(availabilityBlockSchema)
export const appointmentsSchema = z.array(appointmentSchema)
export const payoutsSchema = z.array(payoutSchema)

export type Professional = z.infer<typeof professionalSchema>
export type Service = z.infer<typeof serviceSchema>
export type Customer = z.infer<typeof customerSchema>
export type BusinessHoursRow = z.infer<typeof businessHoursRowSchema>
export type ProfessionalServiceLink = z.infer<typeof professionalServiceLinkSchema>
export type AvailabilityEntry = z.infer<typeof availabilityEntrySchema>
export type AvailabilityBlock = z.infer<typeof availabilityBlockSchema>
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>
export type Appointment = z.infer<typeof appointmentSchema>
export type Payout = z.infer<typeof payoutSchema>
export type TenantProfile = z.infer<typeof tenantProfileSchema>
export type OperationMode = z.infer<typeof operationModeSchema>
