import 'server-only'

import { getSessionUser, type SessionUser } from '@/lib/auth/session'
import { isStaffRole } from '@/lib/auth/roles'

export type AuthErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'TENANT_MISMATCH'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

type AuthenticatedUser = SessionUser & { profile: NonNullable<SessionUser['profile']> }

export async function assertStaff(opts?: {
  expectedTenantId?: string | null
}): Promise<AuthenticatedUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHORIZED')
  if (!user.profile) throw new AuthError('UNAUTHORIZED')
  if (!isStaffRole(user.profile.role)) throw new AuthError('FORBIDDEN')

  if (opts?.expectedTenantId !== undefined && user.profile.tenantId !== opts.expectedTenantId) {
    throw new AuthError('TENANT_MISMATCH')
  }

  return user as AuthenticatedUser
}
