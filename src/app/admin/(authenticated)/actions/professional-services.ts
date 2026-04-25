'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff, AuthError } from '@/lib/auth/guards'

const Input = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  link: z.boolean(),
})

export type ProServiceResult = { ok: true } | { ok: false; error: string }

export async function toggleProfessionalService(
  raw: z.infer<typeof Input>,
): Promise<ProServiceResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  const supabase = await createClient()

  if (parsed.data.link) {
    const { error } = await supabase.from('professional_services').insert({
      tenant_id: user.profile.tenantId,
      professional_id: parsed.data.professionalId,
      service_id: parsed.data.serviceId,
    })
    if (error && !error.message.includes('duplicate')) {
      return { ok: false, error: 'Falha ao vincular.' }
    }
  } else {
    const { error } = await supabase
      .from('professional_services')
      .delete()
      .eq('professional_id', parsed.data.professionalId)
      .eq('service_id', parsed.data.serviceId)
    if (error) return { ok: false, error: 'Falha ao desvincular.' }
  }

  revalidatePath('/admin/dashboard/equipe-servicos')
  return { ok: true }
}
