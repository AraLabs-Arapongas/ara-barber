'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { saveBusinessHours } from '@/app/salon/(authenticated)/actions/business-hours'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export type BusinessHoursRow = {
  weekday: number
  isOpen: boolean
  startTime: string
  endTime: string
}

type Props = {
  initial: BusinessHoursRow[]
}

export function BusinessHoursEditor({ initial }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<BusinessHoursRow[]>(initial)
  const [dirty, setDirty] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function update(i: number, patch: Partial<BusinessHoursRow>) {
    setOk(false)
    setError(null)
    setDirty(true)
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveBusinessHours({ rows })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDirty(false)
      setOk(true)
      router.refresh()
    })
  }

  function discard() {
    setRows(initial)
    setDirty(false)
    setError(null)
    setOk(false)
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Configurações
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Horários de funcionamento
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Quando seu negócio abre e fecha em cada dia da semana.
        </p>
      </header>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.weekday}
            className="rounded-xl border border-border bg-surface px-4 py-3 shadow-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-fg">{DAYS[r.weekday]}</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] text-fg-muted">
                <input
                  type="checkbox"
                  checked={r.isOpen}
                  onChange={(e) => update(i, { isOpen: e.target.checked })}
                  className="h-4 w-4 accent-brand-primary"
                />
                {r.isOpen ? 'Aberto' : 'Fechado'}
              </label>
            </div>

            {r.isOpen ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                    Abre
                  </span>
                  <input
                    type="time"
                    value={r.startTime.slice(0, 5)}
                    onChange={(e) => update(i, { startTime: e.target.value })}
                    className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                    Fecha
                  </span>
                  <input
                    type="time"
                    value={r.endTime.slice(0, 5)}
                    onChange={(e) => update(i, { endTime: e.target.value })}
                    className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
                  />
                </label>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <Alert variant="error" title="Não foi possível salvar" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert variant="success" className="mt-4">
          Horários atualizados.
        </Alert>
      ) : null}

      {dirty ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] mt-6 flex gap-2">
          <Button type="button" variant="secondary" fullWidth onClick={discard}>
            Descartar
          </Button>
          <Button type="button" fullWidth onClick={save} loading={pending}>
            Salvar horários
          </Button>
        </div>
      ) : null}
    </main>
  )
}
