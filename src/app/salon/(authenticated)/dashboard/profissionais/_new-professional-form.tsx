'use client'

import { useActionState, useState } from 'react'
import { User, Phone, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
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
    <form action={action} className="space-y-3" key={state.success ? 'reset' : 'edit'}>
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
        hint="Usado nos cards de booking, se preenchido."
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium text-fg">Comissão</span>
          <select
            name="commissionType"
            value={commissionType}
            onChange={(e) => setCommissionType(e.target.value as 'PERCENTAGE' | 'FIXED')}
            className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
          >
            <option value="PERCENTAGE">% percentual</option>
            <option value="FIXED">R$ fixo</option>
          </select>
        </label>
        <Input
          label={commissionType === 'PERCENTAGE' ? 'Valor (% × 100)' : 'Valor em centavos'}
          name="commissionValue"
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          defaultValue={0}
          placeholder={commissionType === 'PERCENTAGE' ? '5000 = 50%' : '8000 = R$ 80,00'}
          hint={
            commissionType === 'PERCENTAGE'
              ? 'Guardamos em pontos-base: 5000 = 50,00%.'
              : 'Guardamos em centavos: 8000 = R$ 80,00.'
          }
        />
      </div>

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
