'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const TIME = /^\d{2}:\d{2}(:\d{2})?$/

const Row = z.object({
  weekday: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
})

const Input = z.object({ rows: z.array(Row).length(7) })

export type BusinessHoursResult = { ok: true } | { ok: false; error: string }

/**
 * Upserta as 7 linhas de business_hours do tenant. PK composta (tenant_id, weekday)
 * permite onConflict=tenant_id,weekday, e setamos merge via upsert.
 */
export async function saveBusinessHours(
  raw: z.infer<typeof Input>,
): Promise<BusinessHoursResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  for (const r of parsed.data.rows) {
    if (r.isOpen && r.startTime >= r.endTime) {
      return {
        ok: false,
        error: `Dia ${r.weekday}: abertura deve ser menor que fechamento.`,
      }
    }
  }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()
  const tenantId = user.profile.tenantId

  const rows = parsed.data.rows.map((r) => ({
    tenant_id: tenantId,
    weekday: r.weekday,
    is_open: r.isOpen,
    start_time: r.startTime,
    end_time: r.endTime,
  }))

  const { error } = await supabase
    .from('business_hours')
    .upsert(rows, { onConflict: 'tenant_id,weekday' })

  if (error) return { ok: false, error: 'Falha ao salvar horários.' }

  revalidatePath('/admin/dashboard/configuracoes/horarios')
  return { ok: true }
}
