'use client'

import { useActionState, useState } from 'react'
import { User, Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { formatBrPhone } from '@/lib/format'
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
  const [phone, setPhone] = useState('')

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

      <Input
        label="Telefone"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={16}
        placeholder="(00) 00000-0000"
        value={phone}
        onChange={(e) => setPhone(formatBrPhone(e.target.value))}
        leftIcon={<Phone className="h-4 w-4" />}
      />

      <input type="hidden" name="isActive" value="true" />

      {state.error ? (
        <Alert variant="error" title="Não foi possível adicionar">
          {state.error}
        </Alert>
      ) : null}
      {state.success ? <Alert variant="success">Profissional adicionado.</Alert> : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Salvando...">
        Adicionar profissional
      </Button>
    </form>
  )
}
