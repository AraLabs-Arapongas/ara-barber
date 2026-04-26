'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { createManualAppointment } from '@/app/admin/(authenticated)/actions/manual-appointment'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import {
  CustomerStep,
  type CustomerSelection,
} from '@/components/dashboard/manual-booking/customer-step'
import { ServiceStep } from '@/components/dashboard/manual-booking/service-step'
import { ProfessionalStep } from '@/components/dashboard/manual-booking/professional-step'
import { DateTimeStep } from '@/components/dashboard/manual-booking/datetime-step'
import { ConfirmStep } from '@/components/dashboard/manual-booking/confirm-step'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
}

type Step = 1 | 2 | 3 | 4 | 5

type State = {
  customer: CustomerSelection | null
  serviceId: string | null
  professionalId: string | null
  startAtISO: string | null
  notes: string
}

const STEP_LABELS = ['Cliente', 'Serviço', 'Profissional', 'Data/hora', 'Confirmar'] as const

function initialState(initialCustomerId: string | undefined, customers: Customer[]): State {
  const base: State = {
    customer: null,
    serviceId: null,
    professionalId: null,
    startAtISO: null,
    notes: '',
  }
  if (!initialCustomerId) return base
  const found = customers.find((c) => c.id === initialCustomerId)
  if (!found) return base
  return {
    ...base,
    customer: {
      kind: 'existing',
      id: found.id,
      name: found.name,
      phone: found.phone,
      email: found.email,
    },
  }
}

export function ManualBookingWizard({
  context,
  customers,
  initialCustomerId,
}: {
  context: BookingContext
  customers: Customer[]
  initialCustomerId?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<State>(() => initialState(initialCustomerId, customers))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function next() {
    setStep((s) => Math.min(5, s + 1) as Step)
  }
  function back() {
    setStep((s) => Math.max(1, s - 1) as Step)
  }

  function submit() {
    if (
      !state.customer ||
      !state.serviceId ||
      !state.professionalId ||
      !state.startAtISO
    ) {
      return
    }
    setError(null)
    const customer = state.customer
    const serviceId = state.serviceId
    const professionalId = state.professionalId
    const startAtISO = state.startAtISO

    startTransition(async () => {
      const customerPayload =
        customer.kind === 'existing'
          ? { customerId: customer.id }
          : {
              customerNew: {
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
              },
            }
      const result = await createManualAppointment({
        ...customerPayload,
        serviceId,
        professionalId,
        startAtISO,
        notes: state.notes || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/admin/dashboard/agenda/${result.id}`)
    })
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-error/40 bg-error-bg px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <CustomerStep
          customers={customers}
          value={state.customer}
          onChange={(customer) => setState((s) => ({ ...s, customer }))}
          onNext={next}
        />
      ) : null}
      {step === 2 ? (
        <ServiceStep
          services={context.services}
          value={state.serviceId}
          onChange={(serviceId) =>
            setState((s) => ({
              ...s,
              serviceId,
              professionalId: null,
              startAtISO: null,
            }))
          }
          onBack={back}
          onNext={next}
        />
      ) : null}
      {step === 3 && state.serviceId ? (
        <ProfessionalStep
          context={context}
          serviceId={state.serviceId}
          value={state.professionalId}
          onChange={(professionalId) =>
            setState((s) => ({ ...s, professionalId, startAtISO: null }))
          }
          onBack={back}
          onNext={next}
        />
      ) : null}
      {step === 4 && state.serviceId && state.professionalId ? (
        <DateTimeStep
          context={context}
          serviceId={state.serviceId}
          professionalId={state.professionalId}
          value={state.startAtISO}
          onChange={(startAtISO) => setState((s) => ({ ...s, startAtISO }))}
          onBack={back}
          onNext={next}
        />
      ) : null}
      {step === 5 ? (
        <ConfirmStep
          state={state}
          context={context}
          onBack={back}
          onSubmit={submit}
          pending={pending}
          notes={state.notes}
          onNotesChange={(notes) => setState((s) => ({ ...s, notes }))}
        />
      ) : null}
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[0.75rem] font-medium uppercase tracking-[0.14em]">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <li
            key={label}
            className={
              active
                ? 'text-brand-primary'
                : done
                  ? 'text-fg-muted'
                  : 'text-fg-subtle'
            }
          >
            <span>
              {n}. {label}
            </span>
            {n < STEP_LABELS.length ? (
              <span className="mx-1 text-fg-subtle">·</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
