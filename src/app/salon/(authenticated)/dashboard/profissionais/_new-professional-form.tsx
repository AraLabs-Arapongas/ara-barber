'use client'

import { useActionState, useState } from 'react'
import { User, Phone, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  createProfessionalAction,
  INITIAL_PROFESSIONAL_STATE,
  type ActionState,
} from './actions'

export function NewProfessionalForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createProfessionalAction,
    INITIAL_PROFESSIONAL_STATE,
  )
  const [commissionType, setCommissionType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')

  return (
    <form action={action} className="space-y-4" key={state.success ? 'reset' : 'edit'}>
      <Input
        label="Nome"
        name="name"
        required
        maxLength={200}
        placeholder="Ex: Carlos Silva"
        leftIcon={<User className="h-4 w-4" />}
      />

      <Input
        label="Nome curto"
        name="displayName"
        maxLength={100}
        placeholder="Ex: Carlinhos (opcional)"
        hint="Exibido no booking, se preenchido."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Telefone"
          name="phone"
          type="tel"
          maxLength={30}
          placeholder="(00) 00000-0000"
          leftIcon={<Phone className="h-4 w-4" />}
        />
        <Input
          label="E-mail"
          name="email"
          type="email"
          maxLength={200}
          placeholder="pro@salao.com"
          leftIcon={<Mail className="h-4 w-4" />}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[0.8125rem] font-medium text-fg">
          Como é a comissão deste profissional?
        </legend>

        <input type="hidden" name="commissionType" value={commissionType} />

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'PERCENTAGE', label: 'Porcentagem', hint: '% do valor do serviço' },
              { value: 'FIXED', label: 'Valor fixo', hint: 'R$ por atendimento' },
            ] as const
          ).map((opt) => {
            const selected = commissionType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCommissionType(opt.value)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-brand-primary bg-surface-raised shadow-xs'
                    : 'border-transparent bg-bg-subtle hover:bg-bg-subtle/80',
                )}
              >
                <span className="text-[0.875rem] font-medium text-fg">{opt.label}</span>
                <span className="text-[0.75rem] text-fg-muted">{opt.hint}</span>
              </button>
            )
          })}
        </div>

        <div className="relative mt-1">
          <input
            name="commissionValue"
            type="text"
            inputMode="decimal"
            required
            placeholder={commissionType === 'PERCENTAGE' ? '50' : '80,00'}
            className={cn(
              'w-full rounded-lg border border-transparent bg-bg-subtle py-3 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none',
              commissionType === 'PERCENTAGE' ? 'pl-3.5 pr-12' : 'pl-12 pr-3.5',
            )}
          />
          <span
            className={cn(
              'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[0.9375rem] font-medium text-fg-muted',
              commissionType === 'PERCENTAGE' ? 'right-4' : 'left-4',
            )}
            aria-hidden="true"
          >
            {commissionType === 'PERCENTAGE' ? '%' : 'R$'}
          </span>
        </div>
        <p className="text-[0.75rem] text-fg-muted">
          {commissionType === 'PERCENTAGE'
            ? 'Ex: digite 50 para 50% do valor do serviço.'
            : 'Ex: digite 80 ou 80,00 para R$ 80,00 por atendimento.'}
        </p>
      </fieldset>

      <input type="hidden" name="isActive" value="true" />

      {state.error ? (
        <Alert variant="error" title="Não foi possível adicionar">
          {state.error}
        </Alert>
      ) : null}
      {state.success ? (
        <Alert variant="success">Profissional adicionado.</Alert>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Salvando...">
        Adicionar profissional
      </Button>
    </form>
  )
}
