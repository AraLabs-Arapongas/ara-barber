'use client'

import { createContext, useContext, type ReactNode } from 'react'

type CustomerTenantInfo = {
  timezone: string
  cancellationWindowHours: number
}

const Ctx = createContext<CustomerTenantInfo | null>(null)

export function CustomerTenantProvider({
  value,
  children,
}: {
  value: CustomerTenantInfo
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCustomerTenant(): CustomerTenantInfo {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCustomerTenant must be used inside CustomerTenantProvider')
  return v
}
