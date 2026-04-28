import type {
  AvailabilityBlock,
  BookingProfessional,
  BookingService,
  BusinessHour,
  ProfessionalAvailabilityEntry,
} from '@/lib/booking/queries'

/**
 * Shape mínimo que os step components compartilhados (ServiceStep,
 * ProfessionalStep, DateTimeStep) precisam pra funcionar.
 *
 * Tanto `BookingContext` (staff, em booking-context.ts) quanto
 * `CustomerBookingContext` (cliente, em customer-context.ts) satisfazem
 * esta shape. Mantém os steps neutros sem coupling com nenhum dos dois.
 */
export type SharedBookingContext = {
  tenantTimezone: string
  services: BookingService[]
  professionals: BookingProfessional[]
  professionalServices: Array<{ professionalId: string; serviceId: string }>
  businessHours: BusinessHour[]
  availability: ProfessionalAvailabilityEntry[]
  blocks: AvailabilityBlock[]
  existingAppointments: Array<{
    professionalId: string
    startAt: string
    endAt: string
  }>
}

/** Sentinel pra "qualquer profissional" — usado em fluxo cliente. */
export const ANY_PROFESSIONAL = 'any' as const
export type ProfessionalSelection = string // UUID ou 'any'
