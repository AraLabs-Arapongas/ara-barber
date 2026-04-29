'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { updateBookingRules } from '@/app/admin/(authenticated)/actions/booking-rules'

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const

export type BookingRules = {
  min_advance_hours: number
  slot_interval_minutes: number
  cancellation_window_hours: number
  customer_can_cancel: boolean
  booking_window_days: number
  combo_buffer_minutes: number
}

type Props = {
  initial: BookingRules
}

export function BookingRulesForm({ initial }: Props) {
  const [data, setData] = useState<BookingRules>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const result = await updateBookingRules(data)
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
          <Field
            id="min-advance"
            label="Antecedência mínima para agendar (horas)"
            hint="O cliente só consegue agendar a partir desse tempo a contar de agora."
          >
            <input
              id="min-advance"
              type="number"
              min={0}
              max={168}
              step={1}
              value={data.min_advance_hours}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  min_advance_hours: clampInt(e.target.value, 0, 168),
                }))
              }
              className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </Field>

          <Field
            id="slot-interval"
            label="Intervalo entre horários (minutos)"
            hint="Granularidade dos horários disponíveis na agenda pública."
          >
            <select
              id="slot-interval"
              value={data.slot_interval_minutes}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  slot_interval_minutes: parseInt(e.target.value, 10),
                }))
              }
              className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            >
              {SLOT_INTERVALS.map((v) => (
                <option key={v} value={v}>
                  {v} min
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="combo-buffer"
            label="Buffer entre serviços do combo (minutos)"
            hint="Tempo extra entre dois serviços com profissionais diferentes (transição). Mesmo profissional não usa buffer."
          >
            <input
              id="combo-buffer"
              type="number"
              min={0}
              max={60}
              step={1}
              value={data.combo_buffer_minutes}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  combo_buffer_minutes: clampInt(e.target.value, 0, 60),
                }))
              }
              className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </Field>

          <Field
            id="booking-window"
            label="Janela máxima de agendamento (dias)"
            hint="Quantos dias à frente o cliente pode agendar."
          >
            <input
              id="booking-window"
              type="number"
              min={1}
              max={365}
              step={1}
              value={data.booking_window_days}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  booking_window_days: clampInt(e.target.value, 1, 365),
                }))
              }
              className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </Field>

          <Field
            id="cancel-window"
            label="Janela mínima para cancelamento (horas)"
            hint="Quantas horas antes do horário o cliente ainda pode cancelar."
          >
            <input
              id="cancel-window"
              type="number"
              min={0}
              max={168}
              step={1}
              value={data.cancellation_window_hours}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  cancellation_window_hours: clampInt(e.target.value, 0, 168),
                }))
              }
              className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </Field>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={data.customer_can_cancel}
              onChange={(e) => setData((d) => ({ ...d, customer_can_cancel: e.target.checked }))}
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

          {msg ? (
            <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
          ) : null}

          <div>
            <Button type="submit" loading={pending}>
              Salvar regras
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.8125rem] font-medium text-fg">
        {label}
      </label>
      {hint ? <p className="mb-2 text-[0.8125rem] text-fg-muted">{hint}</p> : null}
      {children}
    </div>
  )
}

function clampInt(value: string, min: number, max: number): number {
  const n = parseInt(value || '0', 10)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}
