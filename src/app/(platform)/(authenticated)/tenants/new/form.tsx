'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { createTenantAction, type CreateTenantState } from '../../actions'

export function NewTenantForm() {
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(
    createTenantAction,
    {},
  )
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome do negócio" name="name" placeholder="Estética Luna" required />
      <Field
        label="Slug (subdomínio)"
        name="slug"
        placeholder="estetica-luna"
        helper="Vira estetica-luna.aralabs.com.br"
        required
      />
      <Field label="Nome do owner" name="ownerName" placeholder="Maria Luna" required />
      <Field
        label="Email do owner"
        name="ownerEmail"
        type="email"
        placeholder="maria@estetica.com"
        required
      />
      {state.error ? <p className="text-[0.8125rem] text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Criando...' : 'Criar tenant'}
      </Button>
    </form>
  )
}

function Field({
  label,
  name,
  placeholder,
  helper,
  required,
  type = 'text',
}: {
  label: string
  name: string
  placeholder?: string
  helper?: string
  required?: boolean
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-fg">{label}</span>
      <Input name={name} type={type} placeholder={placeholder} required={required} />
      {helper ? <p className="mt-1 text-[0.75rem] text-fg-muted">{helper}</p> : null}
    </label>
  )
}
