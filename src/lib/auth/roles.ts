import type { Database } from '@/lib/supabase/types'

export type UserRole = Database['public']['Enums']['user_role']

export const STAFF_ROLES = ['BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export function isStaffRole(role: UserRole): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole)
}

export function isPlatformAdminRole(role: UserRole): role is 'PLATFORM_ADMIN' {
  return role === 'PLATFORM_ADMIN'
}

export function isCustomerRole(role: UserRole): role is 'CUSTOMER' {
  return role === 'CUSTOMER'
}

export function canManageAgenda(role: UserRole): boolean {
  return isStaffRole(role)
}

export function canManageBilling(role: UserRole): boolean {
  return isPlatformAdminRole(role)
}
