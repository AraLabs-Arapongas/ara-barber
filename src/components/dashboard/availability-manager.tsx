'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, CalendarX, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useConfirm } from '@/components/ui/confirm/provider'
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  saveWeeklyAvailability,
} from '@/app/admin/(authenticated)/actions/availability'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export type ProfessionalLite = {
  id: string
  name: string
  displayName: string | null
}

export type AvailabilityEntry = {
  id: string
  professionalId: string
  weekday: number
  startTime: string
  endTime: string
}

export type AvailabilityBlock = {
  id: string
  professionalId: string
  startAt: string
  endAt: string
  reason: string | null
}

type Props = {
  professionals: ProfessionalLite[]
  availability: AvailabilityEntry[]
  blocks: AvailabilityBlock[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateTimeInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatRange(startAt: string, endAt: string): string {
  const a = new Date(startAt)
  const b = new Date(endAt)
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  return `${a.toLocaleDateString('pt-BR', opts)} → ${b.toLocaleDateString('pt-BR', opts)}`
}

export function AvailabilityManager({ professionals, availability, blocks }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const confirm = useConfirm()

  const [editingProId, setEditingProId] = useState<string | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [defaultStart] = useState(() => toDateTimeInput(new Date()))
  const [defaultEnd] = useState(() => toDateTimeInput(new Date(Date.now() + 2 * 86400000)))

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre sheet vinda do FAB global
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
    const reason = String(fd.get('reason') ?? '').trim() || undefined

    if (!professionalId || !startAtStr || !endAtStr) {
      setError('Preencha profissional e período.')
      return
    }
    if (new Date(startAtStr) >= new Date(endAtStr)) {
      setError('Início deve ser antes do fim.')
      return
    }

    startTransition(async () => {
      const result = await createAvailabilityBlock({
        professionalId,
        startAt: new Date(startAtStr).toISOString(),
        endAt: new Date(endAtStr).toISOString(),
        reason,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBlockOpen(false)
      setError(null)
      form.reset()
      router.refresh()
    })
  }

  async function removeBlock(id: string) {
    const ok = await confirm({
      title: 'Remover este bloqueio?',
      description: 'O profissional volta a aceitar reservas no período.',
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await deleteAvailabilityBlock({ id })
      router.refresh()
    })
  }

  const editingPro = professionals.find((p) => p.id === editingProId)

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
        <Link
          href="/admin/dashboard/mais"
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
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setError(null)
              setBlockOpen(true)
            }}
            className="mt-3"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo bloqueio
          </Button>
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
                              disabled={pending}
                              className="shrink-0 rounded-md p-1 text-fg-subtle hover:bg-error-bg hover:text-error disabled:opacity-50"
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
            required
          />
          <Input
            label="Fim"
            name="endAt"
            type="datetime-local"
            defaultValue={defaultEnd}
            required
          />
          <Input
            label="Motivo"
            name="reason"
            placeholder="Férias, médico, ..."
            maxLength={200}
          />

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
            <Button type="submit" fullWidth loading={pending}>
              Adicionar
            </Button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet
        open={editingProId !== null}
        onClose={() => setEditingProId(null)}
        title={
          editingPro
            ? `Jornada — ${editingPro.displayName || editingPro.name}`
            : 'Jornada'
        }
        description="Marque os dias e horários em que este profissional atende."
      >
        {editingPro ? (
          <WeeklyEditor
            professionalId={editingPro.id}
            entries={byProf.get(editingPro.id) ?? []}
            onSaved={() => {
              setEditingProId(null)
              router.refresh()
            }}
            onCancel={() => setEditingProId(null)}
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
  onSaved,
  onCancel,
}: {
  professionalId: string
  entries: AvailabilityEntry[]
  onSaved: () => void
  onCancel: () => void
}) {
  type Draft = { weekday: number; startTime: string; endTime: string; active: boolean }
  const initialDrafts: Draft[] = Array.from({ length: 7 }, (_, w) => {
    const match = entries.find((e) => e.weekday === w)
    return {
      weekday: w,
      startTime: (match?.startTime ?? '09:00').slice(0, 5),
      endTime: (match?.endTime ?? '19:00').slice(0, 5),
      active: !!match,
    }
  })
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function save() {
    const out = drafts
      .filter((d) => d.active && d.startTime < d.endTime)
      .map((d) => ({
        weekday: d.weekday,
        startTime: d.startTime,
        endTime: d.endTime,
      }))
    setError(null)
    startTransition(async () => {
      const result = await saveWeeklyAvailability({ professionalId, entries: out })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSaved()
    })
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
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="flex gap-2 pt-3">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" fullWidth loading={pending} onClick={save}>
          Salvar jornada
        </Button>
      </div>
    </div>
  )
}
