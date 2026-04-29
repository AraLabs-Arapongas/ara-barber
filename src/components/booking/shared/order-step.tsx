'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BookingService } from '@/lib/booking/queries'
import { formatCentsToBrl } from '@/lib/money'

/**
 * Reordena lista de serviços pra combo. Cliente decide a ordem em
 * que vão acontecer (manicure→cabelo vs cabelo→manicure).
 *
 * Setas ↑↓ em vez de drag-and-drop pra simplicidade mobile e
 * acessibilidade (drag em mobile com leitor de tela é horrível).
 */
export function OrderStep({
  services,
  order,
  onReorder,
  onBack,
  onNext,
}: {
  /** Mapa de serviços disponíveis. */
  services: BookingService[]
  /** Lista ordenada de serviceIds — define a ordem visual. */
  order: string[]
  onReorder: (newOrder: string[]) => void
  onBack: () => void
  onNext: () => void
}) {
  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...order]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onReorder(next)
  }
  function moveDown(idx: number) {
    if (idx === order.length - 1) return
    const next = [...order]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onReorder(next)
  }

  return (
    <section className="space-y-4">
      <ul className="space-y-2">
        {order.map((sid, idx) => {
          const svc = services.find((s) => s.id === sid)
          if (!svc) return null
          const isFirst = idx === 0
          const isLast = idx === order.length - 1
          return (
            <li key={sid}>
              <Card className="shadow-xs">
                <CardContent className="flex items-center gap-2 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[0.8125rem] font-semibold text-brand-primary-fg">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{svc.name}</p>
                    <p className="text-[0.8125rem] text-fg-muted">
                      {svc.durationMinutes} min · {formatCentsToBrl(svc.priceCents)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveUp(idx)}
                      disabled={isFirst}
                      aria-label={`Subir ${svc.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-fg hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(idx)}
                      disabled={isLast}
                      aria-label={`Descer ${svc.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-fg hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={onNext}>
          Continuar
        </Button>
      </div>
    </section>
  )
}
