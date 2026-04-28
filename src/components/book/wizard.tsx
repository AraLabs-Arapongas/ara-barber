'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StepIndicator } from '@/components/book/step-indicator'
import { CustomerLoginForm } from '@/components/auth/customer-login-form'
import { AfterBookingPushPrompt } from '@/components/push/after-booking-prompt'
import { ServiceStep } from '@/components/booking/shared/service-step'
import { ProfessionalStep } from '@/components/booking/shared/professional-step'
import { DateTimeStep } from '@/components/booking/shared/datetime-step'
import { ANY_PROFESSIONAL } from '@/components/booking/shared/types'
import type { CustomerBookingContext } from '@/lib/booking/customer-context'
import { confirmBookingAction } from '@/app/book/confirmar/actions'
import { formatBrPhone } from '@/lib/format'
import { formatCentsToBrl } from '@/lib/money'
import { computeSlots } from '@/lib/booking/slots'

type Step = 'service' | 'professional' | 'datetime' | 'confirm'

const STEP_ORDER: Step[] = ['service', 'professional', 'datetime', 'confirm']
const STEP_LABELS: Record<Step, string> = {
  service: 'Serviço',
  professional: 'Profissional',
  datetime: 'Data e horário',
  confirm: 'Confirmar',
}

type Props = {
  context: CustomerBookingContext
  /**
   * Estado inicial vindo da URL (deep-link, back/forward). Wizard começa
   * no step mais avançado que ainda tem dados válidos.
   */
  initial: {
    step: Step | null
    serviceId: string | null
    professionalId: string | null
    startAtISO: string | null
  }
  /**
   * Customer já existente (logado e com row em customers). null = visitante
   * anon ou logado sem customer row ainda. Wizard usa pra pré-preencher
   * name/phone e decidir se mostra login.
   */
  initialCustomer: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
  } | null
  /** True se o supabase user existe (mesmo sem customer row). */
  isAuthenticated: boolean
}

/**
 * Wizard único de booking pro cliente final. Substitui o multi-route
 * `/book/{servico,profissional,data,horario,login,confirmar}` por uma
 * única página com steps client-side.
 *
 * Decisões de design:
 *   - State em useState. URL search params atualizados via replaceState
 *     (não router.replace pra não disparar refetch do RSC) — preserva
 *     deep-link e back/forward sem custo de servidor.
 *   - Login postergado: cliente preenche tudo. Só na hora de confirmar,
 *     se !isAuthenticated, renderiza CustomerLoginForm inline; após OTP
 *     reload, retoma do step "confirm".
 *   - Slot computation client-side via `computeSlots()` (puro). Contexto
 *     completo (services, blocks, appointments) vem server-rendered numa
 *     só passada — sem round-trip por step.
 *   - "Qualquer profissional" usa sentinel ANY_PROFESSIONAL='any'. No
 *     submit, se professional='any' o slot escolhido já carrega o
 *     professionalId real (computeSlots resolve no client).
 */
export function CustomerBookingWizard({ context, initial, initialCustomer, isAuthenticated }: Props) {
  const router = useRouter()

  const [step, setStep] = useState<Step>(() => {
    // Começa no step da URL se ele tem todos os dados anteriores válidos.
    if (initial.step && validateStepAccess(initial.step, initial)) return initial.step
    return 'service'
  })
  const [serviceId, setServiceId] = useState<string | null>(initial.serviceId)
  const [professionalId, setProfessionalId] = useState<string | null>(initial.professionalId)
  const [startAtISO, setStartAtISO] = useState<string | null>(initial.startAtISO)
  const [name, setName] = useState(initialCustomer?.name ?? '')
  const [phone, setPhone] = useState(initialCustomer?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showLoginInline, setShowLoginInline] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)
  const [pushTrigger, setPushTrigger] = useState(false)

  // Sincroniza state ↔ URL pra suportar back/forward e deep-link.
  // Usamos history.replaceState pra não re-renderizar do servidor.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    params.set('step', step)
    if (serviceId) params.set('serviceId', serviceId)
    if (professionalId) params.set('professionalId', professionalId)
    if (startAtISO) params.set('startAt', startAtISO)
    const qs = params.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', url)
    }
  }, [step, serviceId, professionalId, startAtISO])

  // Botão back do browser → atualiza step se mudou via popstate.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onPop() {
      const sp = new URLSearchParams(window.location.search)
      const next = sp.get('step') as Step | null
      if (next && STEP_ORDER.includes(next)) setStep(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Resolve serviço escolhido + profissional (incl. "any" → primeiro candidato).
  const service = useMemo(
    () => context.services.find((s) => s.id === serviceId) ?? null,
    [context.services, serviceId],
  )
  const selectedSlot = useMemo(() => {
    if (!service || !startAtISO || !professionalId) return null
    // Re-compute pra recuperar qual professionalId atende esse slot quando
    // o cliente escolheu "qualquer".
    const candidateIds =
      professionalId === ANY_PROFESSIONAL
        ? context.professionalServices
            .filter((ps) => ps.serviceId === service.id)
            .map((ps) => ps.professionalId)
        : [professionalId]
    // Date no fuso do tenant — derivar do ISO.
    const dateISO = new Intl.DateTimeFormat('en-CA', {
      timeZone: context.tenantTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(startAtISO))
    const slots = computeSlots({
      serviceDurationMinutes: service.durationMinutes,
      dateISO,
      tenantTimezone: context.tenantTimezone,
      candidateProfessionalIds: candidateIds,
      businessHours: context.businessHours,
      availability: context.availability,
      blocks: context.blocks,
      existingAppointments: context.existingAppointments,
      now: new Date(),
    })
    return slots.find((s) => s.startISO === startAtISO) ?? null
  }, [service, startAtISO, professionalId, context])

  const next = useCallback(() => {
    setStep((s) => {
      const i = STEP_ORDER.indexOf(s)
      return STEP_ORDER[Math.min(STEP_ORDER.length - 1, i + 1)]
    })
  }, [])

  const back = useCallback(() => {
    setStep((s) => {
      const i = STEP_ORDER.indexOf(s)
      return STEP_ORDER[Math.max(0, i - 1)]
    })
  }, [])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!service || !selectedSlot || !startAtISO || !selectedSlot.professionalId) {
      setError('Reveja os passos anteriores.')
      return
    }
    const resolvedProfessionalId = selectedSlot.professionalId
    if (!name.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setError('Telefone é obrigatório (com DDD).')
      return
    }
    setError(null)
    setSubmitting(true)

    const result = await confirmBookingAction({
      tenantId: context.tenantId,
      serviceId: service.id,
      professionalId: resolvedProfessionalId,
      startAt: startAtISO,
      endAt: selectedSlot.endISO,
      priceCentsSnapshot: service.priceCents,
      customerName: name.trim(),
      customerPhone: phone,
    })

    if (!result.ok) {
      setSubmitting(false)
      setError(result.error)
      return
    }
    setPendingRedirect(`/book/sucesso?appointmentId=${result.appointmentId}`)
    setPushTrigger(true)
  }

  function handlePushDone() {
    if (pendingRedirect) router.push(pendingRedirect)
  }

  const stepIndex = STEP_ORDER.indexOf(step) + 1

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <StepIndicator
        current={stepIndex}
        total={STEP_ORDER.length}
        labels={STEP_ORDER.map((s) => STEP_LABELS[s])}
      />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        {titleFor(step)}
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">{subtitleFor(step)}</p>

      {error ? (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      {step === 'service' ? (
        <ServiceStep
          services={context.services}
          value={serviceId}
          onChange={(id) => {
            setServiceId(id)
            // Mudar serviço invalida escolhas posteriores.
            setProfessionalId(null)
            setStartAtISO(null)
          }}
          onBack={back}
          onNext={next}
          showBack={false}
        />
      ) : null}

      {step === 'professional' && serviceId ? (
        <ProfessionalStep
          context={context}
          serviceId={serviceId}
          value={professionalId}
          onChange={(id) => {
            setProfessionalId(id)
            setStartAtISO(null)
          }}
          onBack={back}
          onNext={next}
          allowAny
        />
      ) : null}

      {step === 'datetime' && serviceId && professionalId ? (
        <DateTimeStep
          context={context}
          serviceId={serviceId}
          professionalId={professionalId}
          value={startAtISO}
          onChange={setStartAtISO}
          onBack={back}
          onNext={next}
          maxDateISO={context.rangeEndDate}
        />
      ) : null}

      {step === 'confirm' && service && selectedSlot ? (
        <section className="space-y-4">
          <BookingSummary
            serviceName={service.name}
            durationMinutes={service.durationMinutes}
            priceCents={service.priceCents}
            professionalName={
              context.professionals.find((p) => p.id === selectedSlot.professionalId)?.displayName ??
              context.professionals.find((p) => p.id === selectedSlot.professionalId)?.name ??
              '—'
            }
            startISO={selectedSlot.startISO}
            tenantTimezone={context.tenantTimezone}
          />

          {!isAuthenticated && !showLoginInline ? (
            <Card>
              <CardContent className="py-5">
                <p className="text-[0.9375rem] text-fg">
                  Pra confirmar a reserva precisamos te identificar.
                </p>
                <Button
                  type="button"
                  size="lg"
                  fullWidth
                  className="mt-4"
                  onClick={() => setShowLoginInline(true)}
                >
                  Entrar pra confirmar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="mt-2"
                  onClick={back}
                >
                  Voltar
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!isAuthenticated && showLoginInline ? (
            <Card>
              <CardContent className="py-5 space-y-3">
                <p className="text-[0.875rem] text-fg-muted">
                  Entre com seu e-mail. Vamos enviar um código de 8 dígitos.
                </p>
                <CustomerLoginForm
                  autoFocusEmail
                  onOtpSuccess={() => router.refresh()}
                />
                <Button type="button" variant="secondary" fullWidth onClick={back}>
                  Voltar
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isAuthenticated ? (
            <Card>
              <CardContent className="py-5">
                <p className="mb-3 text-[0.8125rem] font-medium text-fg">Seus dados</p>
                <form onSubmit={submit} className="space-y-3">
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
                    hint="Pro estabelecimento te avisar em caso de mudança."
                  />
                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    loadingText="Confirmando..."
                  >
                    Confirmar reserva
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={back}
                    disabled={submitting}
                  >
                    Voltar
                  </Button>
                </form>
              </CardContent>
              <AfterBookingPushPrompt trigger={pushTrigger} onDone={handlePushDone} />
            </Card>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

function validateStepAccess(
  step: Step,
  data: { serviceId: string | null; professionalId: string | null; startAtISO: string | null },
): boolean {
  if (step === 'service') return true
  if (step === 'professional') return Boolean(data.serviceId)
  if (step === 'datetime') return Boolean(data.serviceId && data.professionalId)
  if (step === 'confirm') return Boolean(data.serviceId && data.professionalId && data.startAtISO)
  return false
}

function titleFor(step: Step): string {
  switch (step) {
    case 'service':
      return 'O que você quer fazer?'
    case 'professional':
      return 'Com quem?'
    case 'datetime':
      return 'Quando?'
    case 'confirm':
      return 'Confirmar'
  }
}

function subtitleFor(step: Step): string {
  switch (step) {
    case 'service':
      return 'Escolha o serviço pra começar.'
    case 'professional':
      return 'Selecione o profissional ou deixe que sugerimos.'
    case 'datetime':
      return 'Escolha o melhor dia e horário.'
    case 'confirm':
      return 'Revise os detalhes e confirme.'
  }
}

function BookingSummary({
  serviceName,
  durationMinutes,
  priceCents,
  professionalName,
  startISO,
  tenantTimezone,
}: {
  serviceName: string
  durationMinutes: number
  priceCents: number
  professionalName: string
  startISO: string
  tenantTimezone: string
}) {
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(startISO))
  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startISO))

  return (
    <Card>
      <CardContent className="py-5">
        <dl className="space-y-2 text-[0.9375rem]">
          <div className="flex justify-between">
            <dt className="text-fg-muted">Serviço</dt>
            <dd className="font-medium text-fg">{serviceName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Profissional</dt>
            <dd className="font-medium text-fg">{professionalName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-muted">Quando</dt>
            <dd className="text-right font-medium text-fg">
              {dateLabel}
              <br />
              <span className="text-fg-muted">às {timeLabel}</span>
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="text-fg-muted">Duração · valor</dt>
            <dd className="font-medium text-fg">
              {durationMinutes} min · {formatCentsToBrl(priceCents)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
