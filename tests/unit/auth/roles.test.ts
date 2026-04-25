import { describe, it, expect } from 'vitest'
import {
  isStaffRole,
  isPlatformAdminRole,
  isCustomerRole,
  canManageAgenda,
  canManageBilling,
} from '@/lib/auth/roles'

describe('roles', () => {
  it('isStaffRole identifica papéis de staff', () => {
    expect(isStaffRole('BUSINESS_OWNER')).toBe(true)
    expect(isStaffRole('RECEPTIONIST')).toBe(true)
    expect(isStaffRole('PROFESSIONAL')).toBe(true)
    expect(isStaffRole('PLATFORM_ADMIN')).toBe(false)
    expect(isStaffRole('CUSTOMER')).toBe(false)
  })

  it('isPlatformAdminRole identifica apenas PLATFORM_ADMIN', () => {
    expect(isPlatformAdminRole('PLATFORM_ADMIN')).toBe(true)
    expect(isPlatformAdminRole('BUSINESS_OWNER')).toBe(false)
  })

  it('isCustomerRole identifica apenas CUSTOMER', () => {
    expect(isCustomerRole('CUSTOMER')).toBe(true)
    expect(isCustomerRole('BUSINESS_OWNER')).toBe(false)
  })

  it('canManageAgenda permite owner/reception/professional', () => {
    expect(canManageAgenda('BUSINESS_OWNER')).toBe(true)
    expect(canManageAgenda('RECEPTIONIST')).toBe(true)
    expect(canManageAgenda('PROFESSIONAL')).toBe(true)
    expect(canManageAgenda('CUSTOMER')).toBe(false)
    expect(canManageAgenda('PLATFORM_ADMIN')).toBe(false)
  })

  it('canManageBilling permite apenas platform admin', () => {
    expect(canManageBilling('PLATFORM_ADMIN')).toBe(true)
    expect(canManageBilling('BUSINESS_OWNER')).toBe(false)
  })
})
