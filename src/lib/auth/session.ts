import 'server-only'

import { cache } from 'react'
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
 * Revogação de token (logout forçado, senha trocada) é detectada pelo SELECT
 * em `user_profiles` logo abaixo — é uma query RLS autenticada, então se o
 * JWT estiver inválido ou revogado, ela falha e tratamos como logged out.
 *
 * React.cache() dedupa chamadas dentro do mesmo request RSC: layout, guards
 * e pages compartilham o resultado.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims?.sub) return null

  const userId = claimsData.claims.sub
  const email = claimsData.claims.email ?? null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, role, tenant_id')
    .eq('user_id', userId)
    .maybeSingle()

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
