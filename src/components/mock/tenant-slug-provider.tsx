'use client'

import { createContext, useContext, type ReactNode } from 'react'

const Ctx = createContext<string | null>(null)

export function TenantSlugProvider({ slug, children }: { slug: string; children: ReactNode }) {
  return <Ctx.Provider value={slug}>{children}</Ctx.Provider>
}

export function useTenantSlug(): string {
  const slug = useContext(Ctx)
  if (!slug) {
    throw new Error('useTenantSlug deve ser usado dentro de <TenantSlugProvider>')
  }
  return slug
}
