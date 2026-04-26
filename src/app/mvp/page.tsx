import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCurrentArea } from '@/lib/tenant/context'
import { LAUNCH_CHECKLIST } from './data'
import { MvpChecklistView } from './checklist-view'

export const metadata: Metadata = {
  title: 'MVP — Launch checklist',
  robots: { index: false, follow: false },
}

/**
 * Checklist interno de launch. Não renderiza em subdomínio de tenant —
 * visível só no apex (dev e prod AraLabs). Uso: acompanhar o que falta
 * pra liberar o piloto. Estado persiste em localStorage do browser.
 */
export default async function MvpPage() {
  const area = await getCurrentArea()
  if (area === 'tenant') notFound()

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-12 sm:px-6">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Interno · AraLabs
        </p>
        <h1 className="font-display text-[1.875rem] font-semibold leading-tight tracking-tight text-fg sm:text-[2.25rem]">
          Launch checklist do MVP
        </h1>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-fg-muted">
          O que falta pra soltar o primeiro tenant piloto em produção. Blockers em vermelho,
          decisões suas em amarelo, limitações pra alinhar com o cliente em azul, nice-to-haves em
          verde, ordem sugerida em roxo.
        </p>
      </header>

      <MvpChecklistView sections={LAUNCH_CHECKLIST} />
    </main>
  )
}
