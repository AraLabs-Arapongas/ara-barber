import { assertStaff } from '@/lib/auth/guards'
import { createSecretClient } from '@/lib/supabase/secret'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { UsersManager, type StaffRow } from '@/components/dashboard/users-manager'

export default async function UsuariosPage() {
  const me = await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const admin = createSecretClient()

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, user_id, role, name, created_at')
    .eq('tenant_id', tenant.id)
    .in('role', ['BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'])
    .order('created_at', { ascending: true })

  const userIds = (profiles ?? []).map((p) => p.user_id)
  // listUsers paginado — perPage:200 cobre folga pra Phase 1 (tenants pequenos).
  const { data: usersList } =
    userIds.length > 0
      ? await admin.auth.admin.listUsers({ perPage: 200 })
      : { data: { users: [] as Array<{ id: string; email?: string | null }> } }

  const emailById = new Map(
    (usersList?.users ?? [])
      .filter((u) => userIds.includes(u.id))
      .map((u) => [u.id, u.email ?? '']),
  )

  const rows: StaffRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    name: p.name,
    email: emailById.get(p.user_id) ?? '',
    role: p.role as StaffRow['role'],
    createdAt: p.created_at,
    isMe: p.id === me.profile.id,
  }))

  const canManage = me.profile.role === 'BUSINESS_OWNER'

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Usuários e permissões
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Quem tem acesso ao painel do seu negócio.
        </p>
      </header>
      <UsersManager users={rows} canManage={canManage} />
    </main>
  )
}
