'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

export type DeleteAccountResult = { ok: true } | { ok: false; error: string }

/**
 * Soft-delete LGPD: anonimiza a linha de `customers` do usuário para ESTE tenant,
 * cancela futuros appointments e marca deleted_at. Mantém appointments antigos
 * (com snapshot anonimizado) pra histórico do salão, sem vínculo com identidade.
 */
export async function deleteMyAccountForTenant(): Promise<DeleteAccountResult> {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!customer) return { ok: false, error: 'Cadastro não encontrado.' }

  const admin = createSecretClient()
  const nowISO = new Date().toISOString()

  // 1. Cancela futuros appointments
  const { error: cancelErr } = await admin
    .from('appointments')
    .update({
      status: 'CANCELED',
      canceled_at: nowISO,
      canceled_by: user.id,
      cancel_reason: 'Conta apagada pelo cliente (LGPD).',
      customer_name_snapshot: 'Cliente removido',
    })
    .eq('customer_id', customer.id)
    .gte('start_at', nowISO)
    .in('status', ['SCHEDULED', 'CONFIRMED'])
  if (cancelErr) return { ok: false, error: 'Falha ao cancelar reservas futuras.' }

  // 2. Anonimiza snapshots dos appointments antigos (preserva estatística, não identidade)
  await admin
    .from('appointments')
    .update({ customer_name_snapshot: 'Cliente removido' })
    .eq('customer_id', customer.id)

  // 3. Soft-delete customer — zera PII e desvincula do auth user
  const { error: delErr } = await admin
    .from('customers')
    .update({
      name: null,
      phone: null,
      whatsapp: null,
      email: null,
      notes: null,
      is_active: false,
      deleted_at: nowISO,
      user_id: null,
    })
    .eq('id', customer.id)
  if (delErr) return { ok: false, error: 'Falha ao remover cadastro.' }

  // 4. Sign out desta sessão (outros tenants mantêm seus próprios customers)
  await supabase.auth.signOut()
  return { ok: true }
}

export async function deleteAndRedirect(): Promise<void> {
  const result = await deleteMyAccountForTenant()
  if (!result.ok) return
  redirect('/')
}
