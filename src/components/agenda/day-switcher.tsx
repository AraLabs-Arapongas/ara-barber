'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  dateISO: string
  tenantTimezone: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function shiftISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + days)
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`
}

function todayISO(tenantTimezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

export function DaySwitcher({ dateISO, tenantTimezone }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function goto(next: string) {
    const params = new URLSearchParams(searchParams)
    if (next === todayISO(tenantTimezone)) {
      params.delete('date')
    } else {
      params.set('date', next)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const today = todayISO(tenantTimezone)
  const diff = daysBetween(today, dateISO)
  const label =
    diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : diff === -1 ? 'Ontem' : longLabel(dateISO, tenantTimezone)
  const sublabel = longLabel(dateISO, tenantTimezone)

  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface p-1 shadow-xs">
      <button
        type="button"
        onClick={() => goto(shiftISO(dateISO, -1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg"
        aria-label="Dia anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => goto(today)}
        className="flex-1 rounded-lg px-3 py-2 text-center"
      >
        <p className="font-display text-[1.125rem] font-semibold capitalize leading-tight tracking-tight text-fg">
          {label}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{sublabel}</p>
      </button>
      <button
        type="button"
        onClick={() => goto(shiftISO(dateISO, 1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg"
        aria-label="Próximo dia"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function daysBetween(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((b - a) / 86400000)
}

function longLabel(dateISO: string, tenantTimezone: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const noon = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(noon)
}
