import type { ReactNode } from 'react'
import { CustomerBottomTabNav } from './bottom-tab-nav'
import { PwaInstallPrompt } from '@/components/pwa/install-prompt'

/**
 * Wrapper de páginas tenant-facing (cliente): aplica padding bottom
 * considerando o safe-area + altura da tab nav, e renderiza a nav fixa.
 *
 * Não injeta tema / provider — isso fica nos layouts específicos que
 * já resolvem o tenant via `getCurrentTenantOrNotFound()`.
 *
 * Quando `showTabBar=false`, a tab bar some e o padding bottom vira só
 * o safe-area. Útil na home pública pra visitantes deslogados, onde a
 * tab bar adianta navegação que ainda não faz sentido.
 */
export function CustomerShell({
  children,
  showTabBar = true,
}: {
  children: ReactNode
  showTabBar?: boolean
}) {
  return (
    <>
      <div
        className={
          showTabBar
            ? 'pb-[calc(env(safe-area-inset-bottom)+4.5rem)]'
            : 'pb-[env(safe-area-inset-bottom)]'
        }
      >
        {children}
      </div>
      {showTabBar ? <CustomerBottomTabNav /> : null}
      <PwaInstallPrompt />
    </>
  )
}
