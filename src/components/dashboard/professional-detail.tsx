'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type FormEvent } from 'react'
import {
  CalendarX,
  ChevronLeft,
  Phone,
  Plus,
  Power,
  Trash2,
  User,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useConfirm } from '@/components/ui/confirm/provider'
import { formatBrPhone } from '@/lib/format'
import {
  toggleProfessionalActive,
  updateProfessional,
} from '@/app/admin/(authenticated)/actions/professionals'
import { toggleProfessionalService } from '@/app/admin/(authenticated)/actions/professional-services'
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  saveWeeklyAvailability,
} from '@/app/admin/(authenticated)/actions/availability'

const DAYS_LONG = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

export type DetailPro = {
  id: string
  name: string
  displayName: string | null
  phone: string | null
  isActive: boolean
}

export type DetailService = { id: string; name: string; isActive: boolean }

export type DetailAvailability = {
  weekday: number
  startTime: string
  endTime: string
}

export type DetailBlock = {
  id: string
  startAt: string
  endAt: string
  reason: string | null
}

type Props = {
  pro: DetailPro
  services: DetailService[]
  linkedServiceIds: string[]
  availability: DetailAvailability[]
  blocks: DetailBlock[]
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
  const dateFmt: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
  }
  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  }
  return `${a.toLocaleDateString('pt-BR', dateFmt)} ${a.toLocaleTimeString('pt-BR', timeFmt)} → ${b.toLocaleDateString('pt-BR', dateFmt)} ${b.toLocaleTimeString('pt-BR', timeFmt)}`
}

export function ProfessionalDetail({
  pro,
  services,
  linkedServiceIds,
  availability,
  blocks,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/admin/dashboard/profissionais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Equipe
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Profissional
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            {pro.displayName || pro.name}
          </h1>
          <ActiveBadge pro={pro} />
        </div>
      </header>

      <div className="space-y-8">
        <InfoSection pro={pro} />
        <ServicesSection
          proId={pro.id}
          services={services}
          linkedServiceIds={linkedServiceIds}
        />
        <JourneySection proId={pro.id} entries={availability} />
        <BlocksSection proId={pro.id} blocks={blocks} />
      </div>
    </main>
  )
}

function ActiveBadge({ pro }: { pro: DetailPro }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      await toggleProfessionalActive({ id: pro.id, isActive: !pro.isActive })
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide transition-colors disabled:opacity-50 ${
        pro.isActive
          ? 'bg-success-bg text-success hover:bg-success-bg/80'
          : 'bg-bg-subtle text-fg-subtle hover:bg-border'
      }`}
      aria-label={pro.isActive ? 'Desativar' : 'Ativar'}
    >
      <span className="inline-flex items-center gap-1">
        <Power className="h-3 w-3" />
        {pro.isActive ? 'Ativo' : 'Inativo'}
      </span>
    </button>
  )
}

function InfoSection({ pro }: { pro: DetailPro }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [phone, setPhone] = useState(pro.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    const displayName = String(fd.get('displayName') ?? '').trim() || undefined
    if (!name) {
      setError('Nome é obrigatório.')
      return
    }
    setError(null)
    setOk(false)
    startTransition(async () => {
      const result = await updateProfessional({
        id: pro.id,
        name,
        displayName,
        phone: phone || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOk(true)
      router.refresh()
    })
  }

  return (
    <section>
      <SectionTitle>Informações</SectionTitle>
      <Card className="shadow-xs">
        <CardContent className="py-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Nome"
              name="name"
              required
              maxLength={200}
              defaultValue={pro.name}
              leftIcon={<User className="h-4 w-4" />}
            />
            <Input
              label="Nome curto"
              name="displayName"
              maxLength={100}
              defaultValue={pro.displayName ?? ''}
              hint="Exibido no booking, se preenchido."
            />
            <Input
              label="Telefone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={16}
              value={phone}
              onChange={(e) => setPhone(formatBrPhone(e.target.value))}
              leftIcon={<Phone className="h-4 w-4" />}
            />
            {error ? <Alert variant="error">{error}</Alert> : null}
            {ok ? <Alert variant="success">Dados atualizados.</Alert> : null}
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

function ServicesSection({
  proId,
  services,
  linkedServiceIds,
}: {
  proId: string
  services: DetailService[]
  linkedServiceIds: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState<Set<string>>(
    () => new Set(linkedServiceIds),
  )
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(() => services.filter((s) => s.isActive), [services])

  function toggle(serviceId: string) {
    const currentlyLinked = optimistic.has(serviceId)
    const next = new Set(optimistic)
    if (currentlyLinked) next.delete(serviceId)
    else next.add(serviceId)
    setOptimistic(next)
    setError(null)

    startTransition(async () => {
      const result = await toggleProfessionalService({
        professionalId: proId,
        serviceId,
        link: !currentlyLinked,
      })
      if (!result.ok) {
        setError(result.error)
        const rollback = new Set(next)
        if (currentlyLinked) rollback.add(serviceId)
        else rollback.delete(serviceId)
        setOptimistic(rollback)
        return
      }
      router.refresh()
    })
  }

  return (
    <section>
      <SectionTitle>Serviços que atende</SectionTitle>
      <Card className="shadow-xs">
        <CardContent className="py-4">
          {active.length === 0 ? (
            <p className="text-[0.875rem] text-fg-muted">
              Nenhum serviço ativo no catálogo. Cadastre em{' '}
              <Link
                href="/admin/dashboard/servicos"
                className="font-medium text-brand-primary hover:underline"
              >
                Serviços
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {active.map((s) => {
                const on = optimistic.has(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-pressed={on}
                    disabled={pending}
                    className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-60 ${
                      on
                        ? 'bg-brand-primary text-brand-primary-fg'
                        : 'bg-bg-subtle text-fg-muted hover:bg-surface-raised hover:text-fg'
                    }`}
                  >
                    {s.name}
                  </button>
                )
              })}
            </div>
          )}
          {error ? (
            <Alert variant="error" className="mt-3">
              {error}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}

function JourneySection({
  proId,
  entries,
}: {
  proId: string
  entries: DetailAvailability[]
}) {
  type Draft = {
    weekday: number
    startTime: string
    endTime: string
    active: boolean
  }
  const initial: Draft[] = Array.from({ length: 7 }, (_, w) => {
    const match = entries.find((e) => e.weekday === w)
    return {
      weekday: w,
      startTime: (match?.startTime ?? '09:00').slice(0, 5),
      endTime: (match?.endTime ?? '19:00').slice(0, 5),
      active: !!match,
    }
  })

  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const dirty = useMemo(
    () =>
      drafts.some((d, i) => {
        const ref = initial[i]
        if (!ref) return true
        return (
          d.active !== ref.active ||
          d.startTime !== ref.startTime ||
          d.endTime !== ref.endTime
        )
      }),
    [drafts, initial],
  )

  function update(i: number, patch: Partial<Draft>) {
    setOk(false)
    setError(null)
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
      const result = await saveWeeklyAvailability({
        professionalId: proId,
        entries: out,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOk(true)
      router.refresh()
    })
  }

  return (
    <section>
      <SectionTitle>Jornada semanal</SectionTitle>
      <Card className="shadow-xs">
        <CardContent className="space-y-2 py-4">
          {drafts.map((d, i) => (
            <div
              key={d.weekday}
              className="rounded-lg bg-bg-subtle/50 px-3 py-2"
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
                    className="h-10 rounded-lg border border-transparent bg-surface px-3 text-[0.875rem] text-fg focus:border-brand-primary focus:outline-none"
                  />
                  <input
                    type="time"
                    value={d.endTime}
                    onChange={(e) => update(i, { endTime: e.target.value })}
                    className="h-10 rounded-lg border border-transparent bg-surface px-3 text-[0.875rem] text-fg focus:border-brand-primary focus:outline-none"
                  />
                </div>
              ) : null}
            </div>
          ))}
          {error ? <Alert variant="error">{error}</Alert> : null}
          {ok ? <Alert variant="success">Jornada atualizada.</Alert> : null}
          {dirty ? (
            <div className="pt-1">
              <Button type="button" loading={pending} onClick={save}>
                Salvar jornada
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}

function BlocksSection({
  proId,
  blocks,
}: {
  proId: string
  blocks: DetailBlock[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultStart] = useState(() => toDateTimeInput(new Date()))
  const [defaultEnd] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 2 * 86400000)),
  )

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const startAtStr = String(fd.get('startAt') ?? '')
    const endAtStr = String(fd.get('endAt') ?? '')
    const reason = String(fd.get('reason') ?? '').trim() || undefined

    if (!startAtStr || !endAtStr) {
      setError('Preencha período.')
      return
    }
    if (new Date(startAtStr) >= new Date(endAtStr)) {
      setError('Início deve ser antes do fim.')
      return
    }

    startTransition(async () => {
      const result = await createAvailabilityBlock({
        professionalId: proId,
        startAt: new Date(startAtStr).toISOString(),
        endAt: new Date(endAtStr).toISOString(),
        reason,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSheetOpen(false)
      setError(null)
      form.reset()
      router.refresh()
    })
  }

  async function remove(id: string) {
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

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <SectionTitle noMargin>Bloqueios futuros</SectionTitle>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setError(null)
            setSheetOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Novo bloqueio
        </Button>
      </div>
      <Card className="shadow-xs">
        <CardContent className="py-4">
          {blocks.length === 0 ? (
            <p className="text-[0.875rem] text-fg-muted">
              Nenhum bloqueio agendado.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {blocks.map((b) => (
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
                    onClick={() => remove(b.id)}
                    disabled={pending}
                    className="shrink-0 rounded-md p-1 text-fg-subtle hover:bg-error-bg hover:text-error disabled:opacity-50"
                    aria-label="Remover bloqueio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setError(null)
        }}
        title="Novo bloqueio"
        description="Folga, férias, consulta etc."
      >
        <form onSubmit={handleSubmit} className="space-y-3">
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
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setSheetOpen(false)
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
    </section>
  )
}

function SectionTitle({
  children,
  noMargin,
}: {
  children: React.ReactNode
  noMargin?: boolean
}) {
  return (
    <h2
      className={`${noMargin ? '' : 'mb-2'} px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle`}
    >
      {children}
    </h2>
  )
}
