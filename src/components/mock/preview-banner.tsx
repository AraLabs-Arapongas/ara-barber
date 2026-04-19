'use client'

import { RefreshCw, FlaskConical } from 'lucide-react'
import { resetTenantMockData } from '@/lib/mock/store'

type Props = {
  tenantSlug: string
}

export function PreviewBanner({ tenantSlug }: Props) {
  function handleReset() {
    const ok = window.confirm(
      'Apaga todos os dados salvos localmente deste salão e volta ao seed inicial. Continuar?',
    )
    if (!ok) return
    resetTenantMockData(tenantSlug)
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-warning-border bg-warning-bg/90 px-4 py-2 text-[0.75rem] text-fg backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
        <span className="truncate">
          <strong className="font-semibold">Modo preview</strong> · dados salvos só no seu navegador
        </span>
      </div>
      <button
        type="button"
        onClick={handleReset}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Reset
      </button>
    </div>
  )
}
