'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { AfterBookingPushPrompt } from '@/components/push/after-booking-prompt'
import { formatBrPhone } from '@/lib/format'
import { confirmBookingAction, type ConfirmBookingInput } from '@/app/book/confirmar/actions'

type Props = {
  initialName: string
  initialPhone: string
  payload: ConfirmBookingInput
}

export function ConfirmForm({ initialName, initialPhone, payload }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pushTrigger, setPushTrigger] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
      ...payload,
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

  return (
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

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            loadingText="Confirmando..."
          >
            Confirmar reserva
          </Button>
        </form>
      </CardContent>
      <AfterBookingPushPrompt trigger={pushTrigger} onDone={handlePushDone} />
    </Card>
  )
}
