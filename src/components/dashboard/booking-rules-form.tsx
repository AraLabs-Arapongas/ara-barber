'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { updateBookingRules } from '@/app/admin/(authenticated)/actions/booking-rules'

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const

export type BookingRules = {
  min_advance_minutes: number
  slot_interval_minutes: number
  cancellation_window_minutes: number
  customer_can_cancel: boolean
  auto_confirm_bookings: boolean
  booking_window_days: number
  combo_buffer_minutes: number
}

type Props = {
  initial: BookingRules
}

type NumericKey =
  | 'min_advance_minutes'
  | 'cancellation_window_minutes'
  | 'booking_window_days'
  | 'combo_buffer_minutes'

type NumericFieldConfig = {
  key: NumericKey
  id: string
  label: string
  hint: string
  min: number
  max: number
}

// Min/max alinhados com o Zod do action `updateBookingRules`. Mantém a UX
// permissiva (campo aceita vazio durante edição) e a validação acontece
// só no blur/submit pra permitir, ex: apagar tudo e digitar "7" no booking
// window — antes o min=1 reclampava pra 1 antes do user terminar de digitar.
const NUMERIC_FIELDS: NumericFieldConfig[] = [
  {
    key: 'min_advance_minutes',
    id: 'min-advance',
    label: 'Antecedência mínima para agendar (minutos)',
    hint: 'Cliente só agenda a partir desse tempo a contar de agora. 60 = 1h, 1440 = 1 dia.',
    min: 0,
    max: 10080,
  },
  {
    key: 'combo_buffer_minutes',
    id: 'combo-buffer',
    label: 'Buffer entre serviços do combo (minutos)',
    hint: 'Tempo extra entre dois serviços com profissionais diferentes (transição). Mesmo profissional não usa buffer.',
    min: 0,
    max: 60,
  },
  {
    key: 'booking_window_days',
    id: 'booking-window',
    label: 'Janela máxima de agendamento (dias)',
    hint: 'Quantos dias à frente o cliente pode agendar.',
    min: 1,
    max: 365,
  },
  {
    key: 'cancellation_window_minutes',
    id: 'cancel-window',
    label: 'Janela mínima para cancelamento (minutos)',
    hint: 'Quantos minutos antes do horário o cliente ainda pode cancelar. 60 = 1h, 1440 = 1 dia.',
    min: 0,
    max: 10080,
  },
]

export function BookingRulesForm({ initial }: Props) {
  // Drafts string permitem campo vazio durante edição. Validação só
  // acontece no submit / lookup de erro, sem reclampar enquanto digita.
  const [drafts, setDrafts] = useState<Record<NumericKey, string>>(() => ({
    min_advance_minutes: String(initial.min_advance_minutes),
    cancellation_window_minutes: String(initial.cancellation_window_minutes),
    booking_window_days: String(initial.booking_window_days),
    combo_buffer_minutes: String(initial.combo_buffer_minutes),
  }))
  const [slotInterval, setSlotInterval] = useState<number>(initial.slot_interval_minutes)
  const [customerCanCancel, setCustomerCanCancel] = useState(initial.customer_can_cancel)
  const [autoConfirmBookings, setAutoConfirmBookings] = useState(initial.auto_confirm_bookings)

  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Compila erros por campo a cada render. Evita estado redundante.
  const errors = useMemo(() => {
    const out: Partial<Record<NumericKey, string>> = {}
    for (const f of NUMERIC_FIELDS) {
      const raw = drafts[f.key].trim()
      if (raw === '') {
        out[f.key] = 'Obrigatório.'
        continue
      }
      if (!/^\d+$/.test(raw)) {
        out[f.key] = 'Apenas números inteiros.'
        continue
      }
      const n = parseInt(raw, 10)
      if (n < f.min || n > f.max) {
        out[f.key] = `Entre ${f.min} e ${f.max}.`
      }
    }
    return out
  }, [drafts])

  const hasErrors = Object.keys(errors).length > 0

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    if (hasErrors) {
      setMsg({ kind: 'error', text: 'Corrija os campos destacados antes de salvar.' })
      return
    }
    const payload: BookingRules = {
      min_advance_minutes: parseInt(drafts.min_advance_minutes, 10),
      slot_interval_minutes: slotInterval,
      cancellation_window_minutes: parseInt(drafts.cancellation_window_minutes, 10),
      customer_can_cancel: customerCanCancel,
      auto_confirm_bookings: autoConfirmBookings,
      booking_window_days: parseInt(drafts.booking_window_days, 10),
      combo_buffer_minutes: parseInt(drafts.combo_buffer_minutes, 10),
    }
    startTransition(async () => {
      const result = await updateBookingRules(payload)
      if (!result.ok) {
        setMsg({ kind: 'error', text: result.error })
        return
      }
      setMsg({ kind: 'success', text: 'Regras atualizadas.' })
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="shadow-xs">
        <CardContent className="space-y-5 py-5">
          <NumericField
            config={NUMERIC_FIELDS[0]}
            value={drafts[NUMERIC_FIELDS[0].key]}
            onChange={(v) => setDrafts((d) => ({ ...d, [NUMERIC_FIELDS[0].key]: v }))}
            error={errors[NUMERIC_FIELDS[0].key]}
          />
          <SlotIntervalField value={slotInterval} onChange={setSlotInterval} />
          {NUMERIC_FIELDS.slice(1).map((f) => (
            <NumericField
              key={f.key}
              config={f}
              value={drafts[f.key]}
              onChange={(v) => setDrafts((d) => ({ ...d, [f.key]: v }))}
              error={errors[f.key]}
            />
          ))}

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={customerCanCancel}
              onChange={(e) => setCustomerCanCancel(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-brand-primary"
            />
            <span className="flex-1">
              <span className="block text-[0.9375rem] font-medium text-fg">
                Permitir cancelamento pelo cliente
              </span>
              <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">
                Se desligado, só o staff cancela pelo painel.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={autoConfirmBookings}
              onChange={(e) => setAutoConfirmBookings(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-brand-primary"
            />
            <span className="flex-1">
              <span className="block text-[0.9375rem] font-medium text-fg">
                Confirmar reservas automaticamente
              </span>
              <span className="mt-0.5 block text-[0.8125rem] text-fg-muted">
                Quando ligado, reservas do cliente já entram como confirmadas, sem
                precisar você aprovar no painel. Bom pra alto volume; mantenha
                desligado se quiser revisar cada uma.
              </span>
            </span>
          </label>

          {msg ? (
            <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
          ) : null}

          <div>
            <Button type="submit" loading={pending} disabled={hasErrors}>
              Salvar regras
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function NumericField({
  config,
  value,
  onChange,
  error,
}: {
  config: NumericFieldConfig
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div>
      <label
        htmlFor={config.id}
        className="mb-1 block text-[0.8125rem] font-medium text-fg"
      >
        {config.label}
      </label>
      <p className="mb-2 text-[0.8125rem] text-fg-muted">{config.hint}</p>
      <input
        id={config.id}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${config.id}-error` : undefined}
        className={`h-10 w-32 rounded-lg border bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:bg-surface-raised focus:outline-none ${
          error
            ? 'border-error focus:border-error'
            : 'border-transparent focus:border-brand-primary'
        }`}
      />
      {error ? (
        <p id={`${config.id}-error`} className="mt-1 text-[0.75rem] text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SlotIntervalField({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-5">
      <label
        htmlFor="slot-interval"
        className="mb-1 block text-[0.8125rem] font-medium text-fg"
      >
        Intervalo entre horários (minutos)
      </label>
      <p className="mb-2 text-[0.8125rem] text-fg-muted">
        Granularidade dos horários disponíveis na agenda pública.
      </p>
      <select
        id="slot-interval"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
      >
        {SLOT_INTERVALS.map((v) => (
          <option key={v} value={v}>
            {v} min
          </option>
        ))}
      </select>
    </div>
  )
}
