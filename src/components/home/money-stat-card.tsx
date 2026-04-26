'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STORAGE_KEY = 'ara:money-hidden'

/**
 * Stat card de valor monetário com toggle de visibilidade (estilo Nubank).
 * Persiste em localStorage pra a preferência sobreviver entre sessões.
 *
 * Server-side renderiza valor visível por default (não há localStorage no SSR);
 * o useEffect ajusta no mount sem causar layout shift visível porque o conteúdo
 * mascarado tem largura similar ao valor real (R$ ••••).
 */
export function MoneyStatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  // Default hidden por segurança — staff pode estar com cliente do lado.
  // Revelar é uma ação consciente. Quando o user revelar/ocultar, salva
  // a escolha no localStorage e respeita nas próximas sessões.
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(stored === '1')
    }
  }, [])

  function toggle() {
    setHidden((h) => {
      const next = !h
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // localStorage pode falhar em modo privado; tudo bem, só não persiste.
      }
      return next
    })
  }

  return (
    <Card className="relative">
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {label}
          </p>
          <button
            type="button"
            onClick={toggle}
            className="-m-1 rounded p-1 text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg-muted"
            aria-label={hidden ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
            aria-pressed={hidden}
          >
            {hidden ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="mt-1 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-fg tabular-nums">
          {hidden ? 'R$ ••••' : value}
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{hidden ? '••••' : hint}</p>
      </CardContent>
    </Card>
  )
}
