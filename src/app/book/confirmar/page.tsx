'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ChevronLeft, Scissors, User, Clock, Calendar } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Appointment } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'
import { formatCentsToBrl } from '@/lib/money'
import { formatBrPhone } from '@/lib/format'

export default function BookStepConfirm() {
  const tenantSlug = useTenantSlug()
  const router = useRouter()
  const sp = useSearchParams()
  const current = parseBookParams(sp ?? new URLSearchParams())

  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const { data: customers, setData: setCustomers } = useMockStore(
    tenantSlug,
    ENTITY.customers.key,
    ENTITY.customers.schema,
    ENTITY.customers.seed,
  )
  const { data: appointments, setData: setAppointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const { data: session } = useMockStore(
    tenantSlug,
    ENTITY.currentCustomer.key,
    ENTITY.currentCustomer.schema,
    ENTITY.currentCustomer.seed,
  )

  const customer = customers.find((c) => c.id === session.customerId)
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!session.customerId || !current.serviceId || !current.professionalId || !current.date || !current.time) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">
          Finalize os passos anteriores.{' '}
          <Link href="/book" className="font-medium text-brand-primary hover:underline">
            Voltar
          </Link>
        </p>
      </main>
    )
  }

  const svc = services.find((s) => s.id === current.serviceId)
  const prof = professionals.find((p) => p.id === current.professionalId)

  const startAt = new Date(`${current.date}T${current.time}`)
  const endAt = new Date(startAt.getTime() + (svc?.durationMinutes ?? 30) * 60000)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Telefone é obrigatório (com DDD).')
      return
    }
    setSubmitting(true)

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === session.customerId ? { ...c, name: name.trim(), phone } : c,
      ),
    )

    const newAppt: Appointment = {
      id: mockId('a'),
      customerId: session.customerId!,
      professionalId: current.professionalId!,
      serviceId: current.serviceId!,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: 'SCHEDULED',
      notes: null,
      createdAt: new Date().toISOString(),
    }
    setAppointments([...appointments, newAppt])
    router.push(`/book/sucesso?appointmentId=${newAppt.id}`)
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book/horario', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Horário
      </Link>

      <StepIndicator current={6} total={6} labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']} />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Tudo certo?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Revise e confirme.
      </p>

      <Card className="mb-4 shadow-xs">
        <CardContent className="space-y-3 py-4">
          <Line icon={<Scissors className="h-4 w-4" />} label="Serviço" value={svc?.name} sub={svc ? `${svc.durationMinutes}min · ${formatCentsToBrl(svc.priceCents)}` : undefined} />
          <Line icon={<User className="h-4 w-4" />} label="Profissional" value={prof?.displayName || prof?.name} />
          <Line icon={<Calendar className="h-4 w-4" />} label="Data" value={startAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} />
          <Line icon={<Clock className="h-4 w-4" />} label="Horário" value={`${current.time} → ${endAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5">
          <p className="mb-3 text-[0.8125rem] font-medium text-fg">Seus dados</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Seu nome"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Pereira"
              autoFocus={!name}
            />
            <Input
              label="Telefone"
              required
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatBrPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={16}
              hint="Pro salão te avisar em caso de mudança."
            />

            {error ? <Alert variant="error">{error}</Alert> : null}

            <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Confirmando...">
              Confirmar agendamento
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function Line({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-fg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
          {label}
        </p>
        <p className="truncate font-medium capitalize text-fg">{value ?? '—'}</p>
        {sub ? <p className="truncate text-[0.8125rem] text-fg-muted">{sub}</p> : null}
      </div>
    </div>
  )
}
