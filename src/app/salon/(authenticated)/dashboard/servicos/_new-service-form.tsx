'use client'

import { useActionState } from 'react'
import { Scissors, Clock, DollarSign } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
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
    <form action={action} className="space-y-3" key={state.success ? 'reset' : 'edit'}>
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
          label="Duração (min)"
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          defaultValue={30}
          required
          leftIcon={<Clock className="h-4 w-4" />}
          hint="De 5 a 480 minutos."
        />
        <Input
          label="Preço (centavos)"
          name="priceCents"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={0}
          required
          leftIcon={<DollarSign className="h-4 w-4" />}
          placeholder="4500 = R$ 45,00"
          hint="Guardamos em centavos. Ex: 4500 = R$ 45,00."
        />
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
