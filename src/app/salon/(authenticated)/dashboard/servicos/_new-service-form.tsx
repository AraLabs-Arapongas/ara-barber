'use client'

import { useActionState } from 'react'
import { Scissors, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  createServiceAction,
  INITIAL_SERVICE_STATE,
  type ActionState,
} from './actions'

export function NewServiceForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createServiceAction,
    INITIAL_SERVICE_STATE,
  )

  return (
    <form action={action} className="space-y-4" key={state.success ? 'reset' : 'edit'}>
      <Input
        label="Nome"
        name="name"
        required
        maxLength={200}
        placeholder="Ex: Corte masculino"
        leftIcon={<Scissors className="h-4 w-4" />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Duração"
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          defaultValue={30}
          required
          leftIcon={<Clock className="h-4 w-4" />}
          rightSlot={<span className="text-[0.8125rem] text-fg-muted">min</span>}
          hint="De 5 a 480 minutos."
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="price" className="text-[0.8125rem] font-medium text-fg">
            Preço <span className="text-fg-subtle">*</span>
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[0.9375rem] font-medium text-fg-muted"
              aria-hidden="true"
            >
              R$
            </span>
            <input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              required
              placeholder="45,00"
              className={cn(
                'w-full rounded-lg border border-transparent bg-bg-subtle py-3 pl-11 pr-3.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none',
              )}
            />
          </div>
          <p className="text-[0.8125rem] text-fg-muted">Aceita 45 ou 45,00.</p>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium text-fg">Descrição</span>
        <textarea
          name="description"
          rows={3}
          maxLength={1000}
          placeholder="Detalhes opcionais exibidos no booking."
          className="w-full rounded-lg border border-transparent bg-bg-subtle px-3 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
        />
      </label>

      {state.error ? (
        <Alert variant="error" title="Não foi possível adicionar">
          {state.error}
        </Alert>
      ) : null}
      {state.success ? <Alert variant="success">Serviço adicionado.</Alert> : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Salvando...">
        Adicionar serviço
      </Button>
    </form>
  )
}
