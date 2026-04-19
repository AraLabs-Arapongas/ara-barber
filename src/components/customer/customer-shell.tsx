import type { ReactNode } from 'react'
import { CustomerBottomTabNav } from './bottom-tab-nav'

/**
 * Wrapper de páginas tenant-facing (cliente): aplica padding bottom
 * considerando o safe-area + altura da tab nav, e renderiza a nav fixa.
 *
 * Não injeta tema / provider — isso fica nos layouts específicos que
 * já resolvem o tenant via `getCurrentTenantOrNotFound()`.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">{children}</div>
      <CustomerBottomTabNav />
    </>
  )
}
