'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, CalendarX, Trash2 } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { AvailabilityBlock, AvailabilityEntry } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateTimeInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatRange(startAt: string, endAt: string): string {
  const a = new Date(startAt)
  const b = new Date(endAt)
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
  }
  return `${a.toLocaleDateString('pt-BR', opts)} → ${b.toLocaleDateString('pt-BR', opts)}`
}

export default function DisponibilidadePage() {
  const tenantSlug = useTenantSlug()
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: availability, setData: setAvailability } = useMockStore(
    tenantSlug,
    ENTITY.availability.key,
    ENTITY.availability.schema,
    ENTITY.availability.seed,
  )
  const { data: blocks, setData: setBlocks } = useMockStore(
    tenantSlug,
    ENTITY.availabilityBlocks.key,
    ENTITY.availabilityBlocks.schema,
    ENTITY.availabilityBlocks.seed,
  )

  const [editingProId, setEditingProId] = useState<string | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultStart] = useState(() => toDateTimeInput(new Date()))
  const [defaultEnd] = useState(() => toDateTimeInput(new Date(Date.now() + 2 * 86400000)))

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlockOpen(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  const byProf = useMemo(() => {
    const map = new Map<string, AvailabilityEntry[]>()
    for (const e of availability) {
      const list = map.get(e.professionalId) ?? []
      list.push(e)
      map.set(e.professionalId, list)
    }
    return map
  }, [availability])

  const blocksByProf = useMemo(() => {
    const map = new Map<string, AvailabilityBlock[]>()
    for (const b of blocks) {
      const list = map.get(b.professionalId) ?? []
      list.push(b)
      map.set(b.professionalId, list)
    }
    return map
  }, [blocks])

  function handleBlockCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const professionalId = String(fd.get('professionalId') ?? '')
    const startAtStr = String(fd.get('startAt') ?? '')
    const endAtStr = String(fd.get('endAt') ?? '')
    const reason = String(fd.get('reason') ?? '').trim() || null

    if (!professionalId || !startAtStr || !endAtStr) {
      setError('Preencha profissional e período.')
      return
    }
    if (new Date(startAtStr) >= new Date(endAtStr)) {
      setError('Início deve ser antes do fim.')
      return
    }

    setBlocks((prev) => [
      ...prev,
      {
        id: mockId('bl'),
        professionalId,
        startAt: new Date(startAtStr).toISOString(),
        endAt: new Date(endAtStr).toISOString(),
        reason,
      },
    ])
    setBlockOpen(false)
    setError(null)
    form.reset()
  }

  function removeBlock(id: string) {
    if (!window.confirm('Remover este bloqueio?')) return
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const editingPro = professionals.find((p) => p.id === editingProId)

  return (
    <>
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
            Agenda
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Disponibilidade da equipe
          </h1>
          <p className="mt-1 text-[0.875rem] text-fg-muted">
            Jornada semanal recorrente e bloqueios pontuais.
          </p>
        </header>

        <ul className="space-y-3">
          {professionals.map((p) => {
            const entries = byProf.get(p.id) ?? []
            const profBlocks = blocksByProf.get(p.id) ?? []
            return (
              <li key={p.id}>
                <Card className="shadow-xs">
                  <CardContent className="py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">
                          {p.displayName || p.name}
                        </p>
                        <p className="text-[0.8125rem] text-fg-muted">
                          {entries.length} janelas semanais
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingProId(p.id)}
                        className="text-[0.8125rem] font-medium text-brand-primary hover:underline"
                      >
                        Editar jornada
                      </button>
                    </div>
                    <WeeklyGrid entries={entries} />
                    {profBlocks.length > 0 ? (
                      <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                        {profBlocks.map((b) => (
                          <li
                            key={b.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-bg-subtle px-3 py-2 text-[0.8125rem]"
                          >
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <CalendarX className="h-3.5 w-3.5 shrink-0 text-warning" />
                              <span className="truncate">
                                <strong className="font-medium text-fg">
                                  {b.reason ?? 'Bloqueio'}
                                </strong>{' '}
                                <span className="text-fg-muted">
                                  · {formatRange(b.startAt, b.endAt)}
                                </span>
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeBlock(b.id)}
                              className="shrink-0 rounded-md p-1 text-fg-subtle hover:bg-error-bg hover:text-error"
                              aria-label="Remover bloqueio"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      </main>

      <BottomSheet
        open={blockOpen}
        onClose={() => {
          setBlockOpen(false)
          setError(null)
        }}
        title="Novo bloqueio"
        description="Folga, férias, consulta etc."
      >
        <form onSubmit={handleBlockCreate} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-fg">
              Profissional <span className="text-fg-subtle">*</span>
            </span>
            <select
              name="professionalId"
              required
              className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            >
              <option value="">Selecione</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName || p.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Início"
            name="startAt"
            type="datetime-local"
            defaultValue={defaultStart}
            key={`start-${defaultStart}`}
            required
          />
          <Input
            label="Fim"
            name="endAt"
            type="datetime-local"
            defaultValue={defaultEnd}
            key={`end-${defaultEnd}`}
            required
          />
          <Input label="Motivo" name="reason" placeholder="Férias, médico, ..." maxLength={200} />

          {error ? (
            <Alert variant="error" title="Não foi possível criar">
              {error}
            </Alert>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setBlockOpen(false)
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Adicionar
            </Button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet
        open={editingProId !== null}
        onClose={() => setEditingProId(null)}
        title={editingPro ? `Jornada — ${editingPro.displayName || editingPro.name}` : 'Jornada'}
        description="Marque os dias e horários em que este profissional atende."
      >
        {editingPro ? (
          <WeeklyEditor
            professionalId={editingPro.id}
            entries={byProf.get(editingPro.id) ?? []}
            onChange={(next) => {
              setAvailability((prev) => {
                const others = prev.filter((e) => e.professionalId !== editingPro.id)
                return [...others, ...next]
              })
            }}
            onClose={() => setEditingProId(null)}
          />
        ) : null}
      </BottomSheet>
    </>
  )
}

function WeeklyGrid({ entries }: { entries: AvailabilityEntry[] }) {
  const byWeekday = new Map<number, AvailabilityEntry>()
  for (const e of entries) {
    byWeekday.set(e.weekday, e)
  }
  return (
    <div className="flex gap-1">
      {DAYS.map((label, w) => {
        const active = byWeekday.has(w)
        return (
          <div
            key={w}
            className={`flex flex-1 flex-col items-center rounded-md px-1 py-2 text-[0.6875rem] font-medium uppercase tracking-wide ${
              active ? 'bg-brand-primary/15 text-brand-primary' : 'bg-bg-subtle text-fg-subtle'
            }`}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}

function WeeklyEditor({
  professionalId,
  entries,
  onChange,
  onClose,
}: {
  professionalId: string
  entries: AvailabilityEntry[]
  onChange: (next: AvailabilityEntry[]) => void
  onClose: () => void
}) {
  type Draft = { id?: string; weekday: number; startTime: string; endTime: string; active: boolean }
  const initialDrafts: Draft[] = Array.from({ length: 7 }, (_, w) => {
    const match = entries.find((e) => e.weekday === w)
    return {
      id: match?.id,
      weekday: w,
      startTime: match?.startTime ?? '09:00',
      endTime: match?.endTime ?? '19:00',
      active: !!match,
    }
  })
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts)

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function save() {
    const out: AvailabilityEntry[] = drafts
      .filter((d) => d.active && d.startTime < d.endTime)
      .map((d) => ({
        id: d.id ?? mockId('av'),
        professionalId,
        weekday: d.weekday,
        startTime: d.startTime,
        endTime: d.endTime,
      }))
    onChange(out)
    onClose()
  }

  return (
    <div className="space-y-2">
      {drafts.map((d, i) => (
        <div
          key={d.weekday}
          className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">{DAYS_LONG[d.weekday]}</span>
            <input
              type="checkbox"
              aria-label={`${DAYS_LONG[d.weekday]} — atende`}
              checked={d.active}
              onChange={(e) => update(i, { active: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-brand-primary"
            />
          </div>
          {d.active ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="time"
                value={d.startTime}
                onChange={(e) => update(i, { startTime: e.target.value })}
                className="h-10 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.875rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
              />
              <input
                type="time"
                value={d.endTime}
                onChange={(e) => update(i, { endTime: e.target.value })}
                className="h-10 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.875rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
              />
            </div>
          ) : null}
        </div>
      ))}
      <div className="flex gap-2 pt-3">
        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" fullWidth onClick={save}>
          Salvar jornada
        </Button>
      </div>
    </div>
  )
}
