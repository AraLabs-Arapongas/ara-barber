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
import { MultiServiceStep } from '@/components/booking/shared/multi-service-step'
import { OrderStep } from '@/components/booking/shared/order-step'
import { PerServiceProfessionalStep } from '@/components/booking/shared/per-service-professional-step'
import { ComboDateTimeStep } from '@/components/booking/shared/combo-datetime-step'
import type { CustomerBookingContext } from '@/lib/booking/customer-context'
import type { ComboSlot } from '@/lib/booking/slots'
import { confirmBookingAction } from '@/app/book/confirmar/actions'
import { formatBrPhone } from '@/lib/format'
import { formatCentsToBrl } from '@/lib/money'

type Step = 'service' | 'order' | 'professional' | 'datetime' | 'confirm'

const STEP_LABELS: Record<Step, string> = {
  service: 'Serviço',
  order: 'Ordem',
  professional: 'Profissional',
  datetime: 'Data e horário',
  confirm: 'Confirmar',
}

type Props = {
  context: CustomerBookingContext
  /** Estado inicial vindo da URL (deep-link, back/forward). */
  initial: {
    step: Step | null
    serviceIds: string[]
    order: string[]
    professionalByService: Record<string, string>
  }
  /** Customer já existente (logado e com row em customers). */
  initialCustomer: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
  } | null
  isAuthenticated: boolean
}

/**
 * Wizard único de booking pro cliente final, com suporte a combo.
 *
 * Combo = N serviços executados back-to-back (por mesmo prof ou profs
 * diferentes com buffer). Quando 1 serviço só, degenera pro flow atual.
 *
 * Steps:
 *   1. service     — multi-select com footer sticky
 *   2. order       — só aparece se >1 serviço; reordena por setas
 *   3. professional — N pickers (1 por serviço, na ordem)
 *   4. datetime    — usa computeComboSlots (funciona pra 1+ serviços)
 *   5. confirm     — lista cada serviço com prof + horário + total
 *
 * Persistência: 1 serviço → appointment sem group_id (legado).
 *               N serviços → appointment_group + N appointments com group_id.
 *
 * URL params (deep-link friendly):
 *   ?step=...
 *   ?serviceIds=A,B,C    (CSV)
 *   ?order=A,B,C         (CSV; default = serviceIds)
 *   ?profIds=any,uuid,uuid (CSV; mesmo length de order, posicional)
 *   ?startAt=ISO         (slot inicial)
 */
export function CustomerBookingWizard({
  context,
  initial,
  initialCustomer,
  isAuthenticated,
}: Props) {
  const router = useRouter()

  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds)
  const [order, setOrder] = useState<string[]>(
    initial.order.length > 0 ? initial.order : initial.serviceIds,
  )
  const [professionalByService, setProfessionalByService] = useState<Record<string, string>>(
    initial.professionalByService,
  )
  const [selectedSlot, setSelectedSlot] = useState<ComboSlot | null>(null)

  const [step, setStep] = useState<Step>(() => {
    if (initial.step && validateStepAccess(initial.step, initial.serviceIds, initial.order)) {
      return initial.step
    }
    return 'service'
  })

  const [name, setName] = useState(initialCustomer?.name ?? '')
  const [phone, setPhone] = useState(initialCustomer?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showLoginInline, setShowLoginInline] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)
  const [pushTrigger, setPushTrigger] = useState(false)

  // Steps efetivos: pula "order" quando só 1 serviço.
  const visibleSteps = useMemo<Step[]>(() => {
    if (serviceIds.length <= 1) {
      return ['service', 'professional', 'datetime', 'confirm']
    }
    return ['service', 'order', 'professional', 'datetime', 'confirm']
  }, [serviceIds.length])

  // Sincroniza state ↔ URL.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    params.set('step', step)
    if (serviceIds.length > 0) params.set('serviceIds', serviceIds.join(','))
    if (order.length > 0 && order.join(',') !== serviceIds.join(',')) {
      params.set('order', order.join(','))
    }
    if (order.length > 0) {
      const profsCsv = order.map((sid) => professionalByService[sid] ?? '').join(',')
      if (profsCsv.replace(/,/g, '')) params.set('profIds', profsCsv)
    }
    if (selectedSlot) params.set('startAt', selectedSlot.startISO)
    const qs = params.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', url)
    }
  }, [step, serviceIds, order, professionalByService, selectedSlot])

  // Back/forward do browser → re-hidrata step.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onPop() {
      const sp = new URLSearchParams(window.location.search)
      const next = sp.get('step') as Step | null
      if (next) setStep(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function next() {
    setStep((s) => {
      const i = visibleSteps.indexOf(s)
      return visibleSteps[Math.min(visibleSteps.length - 1, i + 1)]
    })
  }
  function back() {
    setStep((s) => {
      const i = visibleSteps.indexOf(s)
      return visibleSteps[Math.max(0, i - 1)]
    })
  }

  const toggleService = useCallback(
    (sid: string) => {
      setServiceIds((prev) => {
        const exists = prev.includes(sid)
        const updated = exists ? prev.filter((id) => id !== sid) : [...prev, sid]
        // Sincroniza order: mantém ordem prévia, adiciona novos no fim,
        // remove os desselecionados.
        setOrder((prevOrder) => {
          const filtered = prevOrder.filter((id) => updated.includes(id))
          const newOnes = updated.filter((id) => !filtered.includes(id))
          return [...filtered, ...newOnes]
        })
        // Limpa profissional do serviço removido.
        if (exists) {
          setProfessionalByService((prevProf) => {
            const next = { ...prevProf }
            delete next[sid]
            return next
          })
        }
        // Slot anterior fica inválido se mudou conjunto de serviços.
        setSelectedSlot(null)
        return updated
      })
    },
    [],
  )

  // Submit final.
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedSlot || serviceIds.length === 0) {
      setError('Reveja os passos anteriores.')
      return
    }
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

    // Monta payload pro server: lista de segments do slot resolvido +
    // service price/duration snapshot (lookup no context).
    const segmentsPayload = selectedSlot.segments.map((seg) => {
      const svc = context.services.find((s) => s.id === seg.serviceId)
      return {
        serviceId: seg.serviceId,
        professionalId: seg.professionalId,
        startAt: seg.startISO,
        endAt: seg.endISO,
        priceCentsSnapshot: svc?.priceCents ?? 0,
      }
    })

    const result = await confirmBookingAction({
      tenantId: context.tenantId,
      segments: segmentsPayload,
      customerName: name.trim(),
      customerPhone: phone,
    })

    if (!result.ok) {
      setSubmitting(false)
      setError(result.error)
      return
    }
    // Redirect: se combo, vai pra detalhe do group; se single, pra sucesso normal.
    if (result.kind === 'combo') {
      setPendingRedirect(`/book/sucesso?groupId=${result.groupId}`)
    } else {
      setPendingRedirect(`/book/sucesso?appointmentId=${result.appointmentId}`)
    }
    setPushTrigger(true)
  }

  function handlePushDone() {
    if (pendingRedirect) router.push(pendingRedirect)
  }

  const stepIndex = visibleSteps.indexOf(step) + 1
  const totalSteps = visibleSteps.length

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <StepIndicator
        current={stepIndex}
        total={totalSteps}
        labels={visibleSteps.map((s) => STEP_LABELS[s])}
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
        <MultiServiceStep
          services={context.services}
          values={serviceIds}
          onToggle={toggleService}
          onNext={next}
        />
      ) : null}

      {step === 'order' ? (
        <OrderStep
          services={context.services}
          order={order}
          onReorder={(newOrder) => {
            setOrder(newOrder)
            setSelectedSlot(null)
          }}
          onBack={back}
          onNext={next}
        />
      ) : null}

      {step === 'professional' ? (
        <PerServiceProfessionalStep
          context={context}
          order={order}
          selections={professionalByService}
          onChange={(sid, profId) => {
            setProfessionalByService((prev) => ({ ...prev, [sid]: profId }))
            setSelectedSlot(null)
          }}
          onBack={back}
          onNext={next}
        />
      ) : null}

      {step === 'datetime' ? (
        <ComboDateTimeStep
          context={context}
          order={order}
          selections={professionalByService}
          bufferMinutes={context.comboBufferMinutes ?? 10}
          value={selectedSlot}
          onChange={setSelectedSlot}
          onBack={back}
          onNext={next}
          maxDateISO={context.rangeEndDate}
          stepMinutes={context.slotIntervalMinutes}
          minAdvanceHours={context.minAdvanceHours}
        />
      ) : null}

      {step === 'confirm' && selectedSlot ? (
        <section className="space-y-4">
          <ConfirmSummary
            services={context.services}
            professionals={context.professionals}
            slot={selectedSlot}
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
              <CardContent className="space-y-3 py-5">
                <p className="text-[0.875rem] text-fg-muted">
                  Entre com seu e-mail. Vamos enviar um código de 8 dígitos.
                </p>
                <CustomerLoginForm autoFocusEmail onOtpSuccess={() => router.refresh()} />
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
                  <p className="text-[0.75rem] leading-relaxed text-fg-subtle">
                    Ao confirmar, você concorda com os{' '}
                    <a
                      href="/termos-uso"
                      target="_blank"
                      rel="noopener"
                      className="font-medium text-brand-primary hover:underline"
                    >
                      Termos de uso
                    </a>{' '}
                    e a{' '}
                    <a
                      href="/politica-privacidade"
                      target="_blank"
                      rel="noopener"
                      className="font-medium text-brand-primary hover:underline"
                    >
                      Política de privacidade
                    </a>
                    .
                  </p>
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

function validateStepAccess(step: Step, serviceIds: string[], order: string[]): boolean {
  if (step === 'service') return true
  if (serviceIds.length === 0) return false
  if (step === 'order') return serviceIds.length > 1
  if (step === 'professional') return order.length === serviceIds.length
  if (step === 'datetime' || step === 'confirm') {
    return order.length === serviceIds.length
  }
  return false
}

function titleFor(step: Step): string {
  switch (step) {
    case 'service':
      return 'Escolha os serviços'
    case 'order':
      return 'Em que ordem?'
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
      return 'Pode escolher mais de um — vamos encaixar tudo numa única ida.'
    case 'order':
      return 'Use as setas pra mudar a ordem.'
    case 'professional':
      return 'Selecione o profissional ou deixe que sugerimos.'
    case 'datetime':
      return 'Escolha o melhor dia e horário.'
    case 'confirm':
      return 'Revise os detalhes e confirme.'
  }
}

function ConfirmSummary({
  services,
  professionals,
  slot,
  tenantTimezone,
}: {
  services: CustomerBookingContext['services']
  professionals: CustomerBookingContext['professionals']
  slot: ComboSlot
  tenantTimezone: string
}) {
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(slot.startISO))

  const totalPriceCents = slot.segments.reduce((sum, seg) => {
    const svc = services.find((s) => s.id === seg.serviceId)
    return sum + (svc?.priceCents ?? 0)
  }, 0)
  const totalDurationMinutes = slot.segments.reduce((sum, seg) => {
    const svc = services.find((s) => s.id === seg.serviceId)
    return sum + (svc?.durationMinutes ?? 0)
  }, 0)

  const isCombo = slot.segments.length > 1

  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {isCombo ? 'Combo' : 'Sua reserva'}
        </p>
        <p className="mt-0.5 text-[0.875rem] capitalize text-fg-muted">{dateLabel}</p>

        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {slot.segments.map((seg) => {
            const svc = services.find((s) => s.id === seg.serviceId)
            const prof = professionals.find((p) => p.id === seg.professionalId)
            const startTime = new Intl.DateTimeFormat('pt-BR', {
              timeZone: tenantTimezone,
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(seg.startISO))
            return (
              <li key={`${seg.serviceId}-${seg.startISO}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-fg">{svc?.name ?? 'Serviço'}</p>
                  <p className="text-[0.875rem] tabular-nums text-fg">{startTime}</p>
                </div>
                <p className="text-[0.8125rem] text-fg-muted">
                  com {prof?.displayName ?? prof?.name ?? '—'} ·{' '}
                  {svc?.durationMinutes ?? 0} min ·{' '}
                  {formatCentsToBrl(svc?.priceCents ?? 0)}
                </p>
              </li>
            )
          })}
        </ul>

        {isCombo ? (
          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <p className="text-[0.8125rem] text-fg-muted">
              Total · {formatDuration(totalDurationMinutes)}
            </p>
            <p className="font-display text-[1.125rem] font-semibold tracking-tight text-fg">
              {formatCentsToBrl(totalPriceCents)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m}`
}
