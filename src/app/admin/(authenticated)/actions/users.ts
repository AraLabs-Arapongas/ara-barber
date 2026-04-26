'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertStaff, AuthError } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getTenantPublicUrl } from '@/lib/tenant/public-url'

/**
 * Roles que podem ser atribuídas a staff de um tenant. PLATFORM_ADMIN e
 * CUSTOMER ficam de fora propositalmente — esta UI só gerencia staff.
 */
const StaffRole = z.enum(['BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'])

const InviteInput = z.object({
  email: z.string().email('E-mail inválido.').max(200),
  role: StaffRole,
})

export type InviteStaffInput = z.infer<typeof InviteInput>

export type ActionResult = { ok: true } | { ok: false; error: string }

const ONLY_OWNER_MSG = 'Apenas o dono do negócio pode gerenciar usuários.'

/**
 * Convida um novo membro do staff por e-mail. Restrito a BUSINESS_OWNER
 * (defense in depth — RLS também bloqueia escrita em user_profiles fora
 * do próprio tenant para outras roles).
 *
 * Usa Supabase Admin API (`auth.admin.inviteUserByEmail`) via secret client
 * porque (a) a API exige service-role key, e (b) o profile é criado logo
 * em seguida pra um user que ainda não tem sessão (nem JWT ativo no tenant).
 */
export async function inviteStaff(raw: InviteStaffInput): Promise<ActionResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return { ok: false, error: ONLY_OWNER_MSG }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = InviteInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  const publicUrl = await getTenantPublicUrl(tenant)
  const admin = createSecretClient()

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${publicUrl}/auth/callback`,
    data: { tenant_id: tenant.id, tenant_name: tenant.name },
  })
  if (error || !invited?.user) {
    return { ok: false, error: error?.message ?? 'Falha ao enviar convite.' }
  }

  // O user_profiles tem `name` NOT NULL — usa o local-part do e-mail como
  // placeholder; o convidado pode atualizar depois.
  const fallbackName = parsed.data.email.split('@')[0] || parsed.data.email

  const { error: profileError } = await admin.from('user_profiles').insert({
    user_id: invited.user.id,
    tenant_id: tenant.id,
    role: parsed.data.role,
    name: fallbackName,
  })
  if (profileError) return { ok: false, error: profileError.message }

  revalidatePath('/admin/dashboard/conta/usuarios')
  return { ok: true }
}

const UpdateRoleInput = z.object({
  userProfileId: z.string().uuid(),
  role: StaffRole,
})

export type UpdateStaffRoleInput = z.infer<typeof UpdateRoleInput>

/**
 * Muda a role de um membro do staff. Restrito a BUSINESS_OWNER. A query
 * filtra por `tenant_id` do caller pra impedir cross-tenant write mesmo
 * que o ID do profile seja de outro tenant.
 */
export async function updateStaffRole(raw: UpdateStaffRoleInput): Promise<ActionResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return { ok: false, error: ONLY_OWNER_MSG }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = UpdateRoleInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Input inválido.' }
  }

  // Defense em profundidade: UI já bloqueia, mas request direto poderia rebaixar
  // o próprio dono e perder acesso à área de Usuários (lock-out).
  if (parsed.data.userProfileId === user.profile.id) {
    return { ok: false, error: 'Você não pode alterar a sua própria permissão.' }
  }

  const admin = createSecretClient()
  const { data, error } = await admin
    .from('user_profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userProfileId)
    .eq('tenant_id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Usuário não encontrado neste negócio.' }
  }

  revalidatePath('/admin/dashboard/conta/usuarios')
  return { ok: true }
}

const DeactivateInput = z.object({ userProfileId: z.string().uuid() })

export type DeactivateStaffInput = z.infer<typeof DeactivateInput>

/**
 * Remove o profile de staff do tenant (hard delete). Restrito a
 * BUSINESS_OWNER. Não toca em `auth.users` — o usuário continua existindo,
 * mas perde o vínculo com o tenant.
 *
 * Bloqueia o caller de remover o próprio profile pra evitar lock-out.
 */
export async function deactivateStaff(raw: DeactivateStaffInput): Promise<ActionResult> {
  let user
  try {
    user = await assertStaff()
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'Sem permissão.' }
    throw e
  }

  if (user.profile.role !== 'BUSINESS_OWNER') {
    return { ok: false, error: ONLY_OWNER_MSG }
  }

  const tenant = await getCurrentTenantOrNotFound()
  const parsed = DeactivateInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Input inválido.' }
  }

  if (parsed.data.userProfileId === user.profile.id) {
    return { ok: false, error: 'Você não pode remover seu próprio acesso.' }
  }

  const admin = createSecretClient()
  const { data, error } = await admin
    .from('user_profiles')
    .delete()
    .eq('id', parsed.data.userProfileId)
    .eq('tenant_id', tenant.id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Usuário não encontrado neste negócio.' }
  }

  revalidatePath('/admin/dashboard/conta/usuarios')
  return { ok: true }
}
