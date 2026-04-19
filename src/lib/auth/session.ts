import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/auth/roles'

export type SessionUser = {
  id: string
  email: string | null
  profile: {
    id: string
    name: string
    role: UserRole
    tenantId: string | null
  } | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, role, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          role: profile.role,
          tenantId: profile.tenant_id,
        }
      : null,
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('NOT_AUTHENTICATED')
  }
  return user
}
