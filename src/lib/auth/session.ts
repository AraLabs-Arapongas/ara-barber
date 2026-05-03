import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
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

/**
 * Resolve o usuário da sessão usando `getClaims()`: a assinatura do JWT é
 * validada localmente contra o JWKS (cached no client do Supabase), sem
 * network toda navegação.
 *
 * Profile é buscado **filtrado pelo tenant atual** (header
 * `x-ara-tenant-id`). Necessário desde 2026-05-02 quando user_profiles
 * deixou de ser UNIQUE(user_id) e virou UNIQUE(user_id, tenant_id) —
 * o mesmo user pode ter profiles em N tenants e a query precisa
 * desambiguar pelo contexto.
 *
 * - Em área de tenant (`x-ara-tenant-id` setado): busca o profile
 *   `(user_id, tenant_id)`. Se o user não tem profile nesse tenant,
 *   `profile` vem null e o layout redireciona pra login.
 * - Em área platform/root (sem header): busca profile com
 *   `tenant_id IS NULL` — só PLATFORM_ADMIN tem.
 *
 * Revogação de token (logout forçado, senha trocada) é detectada pelo
 * SELECT (RLS autenticado falha em JWT inválido).
 *
 * React.cache() dedupa chamadas dentro do mesmo request RSC.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims?.sub) return null

  const userId = claimsData.claims.sub
  const email = claimsData.claims.email ?? null

  const h = await headers()
  const tenantId = h.get('x-ara-tenant-id')

  let query = supabase
    .from('user_profiles')
    .select('id, name, role, tenant_id')
    .eq('user_id', userId)

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  } else {
    query = query.is('tenant_id', null)
  }

  const { data: profile } = await query.maybeSingle()

  return {
    id: userId,
    email,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          role: profile.role,
          tenantId: profile.tenant_id,
        }
      : null,
  }
})

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('NOT_AUTHENTICATED')
  }
  return user
}
