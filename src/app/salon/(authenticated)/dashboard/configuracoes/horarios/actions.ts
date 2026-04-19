'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'

const rowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isOpen: z.boolean(),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'Horário de abertura deve ser menor que o de fechamento',
  })

const payloadSchema = z.object({
  hours: z.array(rowSchema).length(7),
})

export type SaveHoursState = { error?: string; success?: boolean }

const INITIAL: SaveHoursState = {}

export async function saveBusinessHoursAction(
  _prev: SaveHoursState,
  formData: FormData,
): Promise<SaveHoursState> {
  const user = await assertStaff()
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return { error: 'Payload ausente' }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return { error: 'Payload inválido' }
  }

  const parsed = payloadSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const rows = parsed.data.hours.map((h) => ({
    tenant_id: user.profile.tenantId!,
    weekday: h.weekday,
    start_time: h.startTime,
    end_time: h.endTime,
    is_open: h.isOpen,
  }))

  const { error } = await supabase
    .from('business_hours')
    .upsert(rows, { onConflict: 'tenant_id,weekday' })

  if (error) return { error: error.message }

  revalidatePath('/salon/dashboard/configuracoes/horarios')
  return { success: true }
}

export { INITIAL as INITIAL_HOURS_STATE }
