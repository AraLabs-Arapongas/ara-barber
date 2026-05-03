'use client'

import { useState, useTransition } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectSheet } from '@/components/ui/select-sheet'
import { updateTenantProfile } from '@/app/admin/(authenticated)/actions/tenant-profile'
import { BR_STATES, formatBrPhone, formatCep, lookupCep } from '@/lib/format'

type Initial = {
  name: string
  contact_phone: string
  whatsapp: string
  email: string
  address_line1: string
  address_number: string
  address_line2: string
  city: string
  state: string
  postal_code: string
}

const STATE_OPTIONS = BR_STATES.map((s) => ({ value: s.uf, label: `${s.uf} — ${s.name}` }))

export function ProfileForm({ initial }: { initial: Initial }) {
  const [data, setData] = useState<Initial>({
    ...initial,
    contact_phone: formatBrPhone(initial.contact_phone),
    whatsapp: formatBrPhone(initial.whatsapp),
    postal_code: formatCep(initial.postal_code),
    state: initial.state.toUpperCase().slice(0, 2),
  })
  const [pending, startTransition] = useTransition()
  const [cepLoading, setCepLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function patch(partial: Partial<Initial>) {
    setData((d) => ({ ...d, ...partial }))
  }

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

  // Quando user termina de digitar CEP (8 dígitos), busca ViaCEP e
  // SOBRESCREVE rua/bairro/cidade/UF — se trocou o CEP, quer dados
  // novos. Número fica intacto (CEP nunca traz número).
  async function handleCepChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = formatCep(e.target.value)
    patch({ postal_code: formatted })
    if (formatted.replace(/\D/g, '').length !== 8) return
    setCepLoading(true)
    const result = await lookupCep(formatted)
    setCepLoading(false)
    if (!result) return
    setData((d) => ({
      ...d,
      address_line1: result.street,
      address_line2: result.neighborhood,
      city: result.city,
      state: result.uf,
    }))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nome do negócio" required>
        <Input
          value={data.name}
          onChange={(e) => patch({ name: e.target.value })}
          required
          maxLength={120}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Telefone de contato">
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(00) 00000-0000"
            value={data.contact_phone}
            onChange={(e) => patch({ contact_phone: formatBrPhone(e.target.value) })}
            maxLength={16}
          />
        </Field>
        <Field label="WhatsApp">
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(00) 00000-0000"
            value={data.whatsapp}
            onChange={(e) => patch({ whatsapp: formatBrPhone(e.target.value) })}
            maxLength={16}
          />
        </Field>
      </div>

      <Field label="E-mail">
        <Input
          type="email"
          autoComplete="email"
          placeholder="contato@empresa.com"
          value={data.email}
          onChange={(e) => patch({ email: e.target.value })}
          maxLength={200}
        />
      </Field>

      <Field
        label="CEP"
        hint={cepLoading ? 'Buscando endereço…' : 'Digite o CEP que preenchemos o resto.'}
      >
        <Input
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={data.postal_code}
          onChange={handleCepChange}
          maxLength={9}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Rua / Logradouro">
          <Input
            autoComplete="street-address"
            placeholder="Av. Brasil"
            value={data.address_line1}
            onChange={(e) => patch({ address_line1: e.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Número">
          <Input
            inputMode="text"
            placeholder="123"
            value={data.address_number}
            onChange={(e) => patch({ address_number: e.target.value })}
            maxLength={20}
          />
        </Field>
      </div>

      <Field label="Complemento / bairro">
        <Input
          autoComplete="address-line2"
          placeholder="Bairro, sala, ponto de referência"
          value={data.address_line2}
          onChange={(e) => patch({ address_line2: e.target.value })}
          maxLength={200}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Cidade">
          <Input
            autoComplete="address-level2"
            value={data.city}
            onChange={(e) => patch({ city: e.target.value })}
            maxLength={100}
          />
        </Field>
        <Field label="UF">
          <SelectSheet
            value={data.state}
            onChange={(uf) => patch({ state: uf })}
            options={STATE_OPTIONS}
            placeholder="UF"
            sheetTitle="Estado"
            className="h-12 w-full rounded-xl border-transparent bg-bg-subtle px-3 text-[0.9375rem] hover:bg-bg-subtle/80"
          />
        </Field>
      </div>

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

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-fg">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[0.75rem] text-fg-subtle">{hint}</span> : null}
    </label>
  )
}
