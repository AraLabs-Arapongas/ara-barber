'use client'

import Link from 'next/link'
import { useState, useMemo, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Appointment } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Fab } from '@/components/nav/fab'
import {
  STATUS_LABELS,
  STATUS_TONE,
  appointmentsOnDay,
  atMidnight,
  formatDayLabel,
  timeLabel,
} from '@/lib/mock/helpers'

function buildLookup<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export default function AgendaPage() {
  const tenantSlug = useTenantSlug()
  const { data: appointments, setData: setAppointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: customers, setData: setCustomers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )

  const [selectedDay, setSelectedDay] = useState<Date>(() => atMidnight(new Date()))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proById = useMemo(() => buildLookup(professionals), [professionals])
  const svcById = useMemo(() => buildLookup(services), [services])
  const custById = useMemo(() => buildLookup(customers), [customers])

  const dayAppts = appointmentsOnDay(appointments, selectedDay)

  function shiftDay(n: number) {
    const next = new Date(selectedDay)
    next.setDate(next.getDate() + n)
    setSelectedDay(atMidnight(next))
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)

    const serviceId = String(fd.get('serviceId') ?? '')
    const professionalId = String(fd.get('professionalId') ?? '')
    const dateStr = String(fd.get('date') ?? '')
    const timeStr = String(fd.get('time') ?? '')
    const customerId = String(fd.get('customerId') ?? '')
    const guestName = String(fd.get('guestName') ?? '').trim()
    const notes = String(fd.get('notes') ?? '').trim() || null

    if (!serviceId || !professionalId || !dateStr || !timeStr) {
      setError('Preencha serviço, profissional, data e horário.')
      return
    }
    const svc = svcById.get(serviceId)
    if (!svc) {
      setError('Serviço inválido.')
      return
    }
    let finalCustomerId = customerId
    if (customerId === '__new__') {
      if (!guestName) {
        setError('Informe o nome do novo cliente.')
        return
      }
      finalCustomerId = mockId('c')
      setCustomers((prev) => [
        ...prev,
        {
          id: finalCustomerId,
          name: guestName,
          email: null,
          phone: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ])
    } else if (!customerId) {
      setError('Escolha um cliente (ou adicione um avulso).')
      return
    }

    const startAt = new Date(`${dateStr}T${timeStr}`)
    const endAt = new Date(startAt.getTime() + svc.durationMinutes * 60000)

    const newAppt: Appointment = {
      id: mockId('a'),
      customerId: finalCustomerId,
      professionalId,
      serviceId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: 'SCHEDULED',
      notes,
      createdAt: new Date().toISOString(),
    }
    setAppointments((prev) => [...prev, newAppt])
    setSheetOpen(false)
    setError(null)
    form.reset()
    setSelectedDay(atMidnight(startAt))
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
        <header className="mb-4">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Operação
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Agenda
          </h1>
        </header>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface p-1 shadow-xs">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDay(atMidnight(new Date()))}
            className="flex-1 rounded-lg px-3 py-2 text-center"
          >
            <p className="font-display text-[1.125rem] font-semibold capitalize leading-tight tracking-tight text-fg">
              {formatDayLabel(selectedDay)}
            </p>
            <p className="text-[0.75rem] text-fg-muted">
              {selectedDay.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </button>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg"
            aria-label="Próximo dia"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {dayAppts.length > 0 ? (
          <ul className="space-y-2">
            {dayAppts.map((a) => {
              const prof = proById.get(a.professionalId)
              const svc = svcById.get(a.serviceId)
              const cust = custById.get(a.customerId)
              return (
                <li key={a.id}>
                  <Link href={`/salon/dashboard/agenda/${a.id}`}>
                    <Card className="shadow-xs transition-colors hover:bg-bg-subtle">
                      <CardContent className="flex items-center gap-3 py-3">
                        <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-bg-subtle">
                          <span className="font-display text-[0.9375rem] font-semibold text-fg">
                            {timeLabel(a.startAt)}
                          </span>
                          <span className="text-[0.6875rem] text-fg-muted">
                            {svc?.durationMinutes ?? 0}min
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-fg">{svc?.name ?? 'Serviço'}</p>
                          <p className="truncate text-[0.8125rem] text-fg-muted">
                            {cust?.name ?? cust?.email ?? 'Cliente'} · {prof?.displayName || prof?.name}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[a.status]}`}
                        >
                          {STATUS_LABELS[a.status]}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <Card className="shadow-xs">
            <CardContent className="py-10 text-center">
              <p className="text-[0.9375rem] text-fg-muted">
                Nenhum agendamento neste dia.
              </p>
              <p className="mt-1 text-[0.8125rem] text-fg-subtle">
                Toque no <strong>+</strong> pra criar.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <Fab srLabel="Novo agendamento" onClick={() => setSheetOpen(true)} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setError(null)
        }}
        title="Novo agendamento"
        description="Marque um horário manualmente."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <SelectField label="Serviço" name="serviceId" required>
            <option value="">Selecione</option>
            {services
              .filter((s) => s.isActive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMinutes}min
                </option>
              ))}
          </SelectField>

          <SelectField label="Profissional" name="professionalId" required>
            <option value="">Selecione</option>
            {professionals
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName || p.name}
                </option>
              ))}
          </SelectField>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data"
              name="date"
              type="date"
              defaultValue={toDateInput(selectedDay)}
              required
            />
            <Input label="Horário" name="time" type="time" defaultValue="09:00" required />
          </div>

          <CustomerSelect customers={customers} />

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-fg">Observações</span>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="(opcional)"
              className="w-full rounded-lg border border-transparent bg-bg-subtle px-3 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </label>

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
                setSheetOpen(false)
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Criar
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  )
}

function SelectField({
  label,
  name,
  required,
  children,
}: {
  label: string
  name: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium text-fg">
        {label}
        {required ? <span className="text-fg-subtle"> *</span> : null}
      </span>
      <select
        name={name}
        required={required}
        className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}

function CustomerSelect({ customers }: { customers: Array<{ id: string; name: string | null; email: string | null }> }) {
  const [choice, setChoice] = useState('')
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium text-fg">
          Cliente <span className="text-fg-subtle">*</span>
        </span>
        <select
          name="customerId"
          required
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
        >
          <option value="">Selecione</option>
          {customers
            .filter((c) => c.name || c.email)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.email ?? '—'}
              </option>
            ))}
          <option value="__new__">+ Cliente avulso (walk-in)</option>
        </select>
      </label>
      {choice === '__new__' ? (
        <Input label="Nome do cliente" name="guestName" placeholder="Ex: João" required />
      ) : null}
    </div>
  )
}
