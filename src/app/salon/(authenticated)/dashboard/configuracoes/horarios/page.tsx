'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { BusinessHoursRow } from '@/lib/mock/schemas'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function HoursPage() {
  const tenantSlug = useTenantSlug()
  const { data: saved, setData } = useMockStore(
    tenantSlug,
    ENTITY.businessHours.key,
    ENTITY.businessHours.schema,
    ENTITY.businessHours.seed,
  )
  const [draft, setDraft] = useState<BusinessHoursRow[] | null>(null)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = draft ?? saved

  function update(i: number, patch: Partial<BusinessHoursRow>) {
    setOk(false)
    setError(null)
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    setDraft(next)
  }

  function save() {
    if (!draft) return
    for (const r of draft) {
      if (r.isOpen && r.startTime >= r.endTime) {
        setError(`${DAYS[r.weekday]}: abertura deve ser menor que fechamento.`)
        return
      }
    }
    setData(draft)
    setDraft(null)
    setOk(true)
    setError(null)
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
          Quando seu salão abre e fecha em cada dia da semana.
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
                    value={r.startTime}
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
                    value={r.endTime}
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
      {ok ? <Alert variant="success" className="mt-4">Horários atualizados.</Alert> : null}

      {draft ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] mt-6 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => {
              setDraft(null)
              setError(null)
            }}
          >
            Descartar
          </Button>
          <Button type="button" fullWidth onClick={save}>
            Salvar horários
          </Button>
        </div>
      ) : null}
    </main>
  )
}
