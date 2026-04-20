'use server'

import { z } from 'zod'
import { createAppointment } from '@/lib/appointments/server-actions'
import {
  ensureCustomerForTenant,
  updateMyCustomerProfile,
} from '@/lib/customers/ensure'

const Input = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  priceCentsSnapshot: z.number().int().nonnegative(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(10),
})

export type ConfirmBookingInput = z.infer<typeof Input>
export type ConfirmBookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string }

export async function confirmBookingAction(
  raw: ConfirmBookingInput,
): Promise<ConfirmBookingResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }
  const input = parsed.data

  const customer = await ensureCustomerForTenant(input.tenantId)
  if (!customer) return { ok: false, error: 'Você precisa estar logado como cliente.' }

  if (customer.name !== input.customerName || customer.phone !== input.customerPhone) {
    await updateMyCustomerProfile(customer.id, {
      name: input.customerName,
      phone: input.customerPhone,
    })
  }

  return await createAppointment({
    tenantId: input.tenantId,
    customerId: customer.id,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    startAt: input.startAt,
    endAt: input.endAt,
    customerNameSnapshot: input.customerName,
    priceCentsSnapshot: input.priceCentsSnapshot,
  })
}
