/**
 * Registry central das entidades mockadas. Cada entrada liga:
 * - chave de storage (entity name)
 * - schema Zod da coleção
 * - função de seed
 *
 * Páginas usam `useMockStore(tenantSlug, ENTITY.professionals.key, ENTITY.professionals.schema, ENTITY.professionals.seed)`.
 */

import {
  appointmentsSchema,
  availabilityBlocksSchema,
  availabilitySchema,
  businessHoursSchema,
  currentCustomerSchema,
  customersSchema,
  operationModeSchema,
  payoutsSchema,
  professionalServicesSchema,
  professionalsSchema,
  servicesSchema,
  tenantProfileSchema,
} from './schemas'

import {
  buildAppointmentsSeed,
  buildAvailabilitySeed,
  buildBlocksSeed,
  buildBusinessHoursSeed,
  buildCustomersSeed,
  buildOperationModeSeed,
  buildPayoutsSeed,
  buildProfessionalServicesSeed,
  buildProfessionalsSeed,
  buildServicesSeed,
  buildTenantProfileSeed,
} from './seed'

export const ENTITY = {
  professionals: {
    key: 'professionals',
    schema: professionalsSchema,
    seed: buildProfessionalsSeed,
  },
  services: {
    key: 'services',
    schema: servicesSchema,
    seed: buildServicesSeed,
  },
  customers: {
    key: 'customers',
    schema: customersSchema,
    seed: buildCustomersSeed,
  },
  businessHours: {
    key: 'business_hours',
    schema: businessHoursSchema,
    seed: buildBusinessHoursSeed,
  },
  professionalServices: {
    key: 'professional_services',
    schema: professionalServicesSchema,
    seed: buildProfessionalServicesSeed,
  },
  availability: {
    key: 'availability',
    schema: availabilitySchema,
    seed: buildAvailabilitySeed,
  },
  availabilityBlocks: {
    key: 'availability_blocks',
    schema: availabilityBlocksSchema,
    seed: buildBlocksSeed,
  },
  appointments: {
    key: 'appointments',
    schema: appointmentsSchema,
    seed: buildAppointmentsSeed,
  },
  payouts: {
    key: 'payouts',
    schema: payoutsSchema,
    seed: buildPayoutsSeed,
  },
  operationMode: {
    key: 'operation_mode',
    schema: operationModeSchema,
    seed: buildOperationModeSeed,
  },
  currentCustomer: {
    key: 'current_customer',
    schema: currentCustomerSchema,
    seed: (): { customerId: string | null; email: string | null } => ({
      customerId: null,
      email: null,
    }),
  },
} as const

export const TENANT_PROFILE_ENTITY = {
  key: 'tenant_profile',
  schema: tenantProfileSchema,
  seed: (name: string) => () => buildTenantProfileSeed(name),
}
