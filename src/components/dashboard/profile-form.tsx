'use client'

import { useState, useTransition } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateTenantProfile } from '@/app/admin/(authenticated)/actions/tenant-profile'

type Initial = {
  name: string
  contact_phone: string
  whatsapp: string
  email: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const [data, setData] = useState<Initial>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const result = await updateTenantProfile(data)
      if (!result.ok) {
        setMsg({ kind: 'error', text: result.error })
      } else {
        setMsg({ kind: 'success', text: 'Salvo!' })
      }
    })
  }

  function bind(key: keyof Initial) {
    return {
      value: data[key],
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        setData((d) => ({ ...d, [key]: e.target.value })),
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nome do negócio">
        <Input {...bind('name')} required />
      </Field>
      <Field label="Telefone de contato">
        <Input type="tel" {...bind('contact_phone')} />
      </Field>
      <Field label="WhatsApp">
        <Input type="tel" {...bind('whatsapp')} />
      </Field>
      <Field label="E-mail">
        <Input type="email" {...bind('email')} />
      </Field>
      <Field label="Endereço linha 1">
        <Input {...bind('address_line1')} />
      </Field>
      <Field label="Endereço linha 2">
        <Input {...bind('address_line2')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Cidade">
          <Input {...bind('city')} />
        </Field>
        <Field label="UF">
          <Input {...bind('state')} maxLength={2} />
        </Field>
      </div>
      <Field label="CEP">
        <Input {...bind('postal_code')} />
      </Field>

      {msg ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
          }`}
          role={msg.kind === 'error' ? 'alert' : 'status'}
        >
          {msg.text}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
      {children}
    </label>
  )
}
