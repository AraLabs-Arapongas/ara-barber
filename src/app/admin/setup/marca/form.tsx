'use client'

import { useActionState, useState } from 'react'
import { saveBrandStep } from '@/lib/onboarding/actions'
import type { StepActionState } from '@/lib/onboarding/schemas'
import { WizardFooter } from '../_components/wizard-footer'
import { Input } from '@/components/ui/input'

type Initial = {
  primary_color: string
  accent_color: string
  logo_url: string
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function BrandStepForm({ initial }: { initial: Initial }) {
  const [primary, setPrimary] = useState(initial.primary_color)
  const [accent, setAccent] = useState(initial.accent_color)
  const [logo, setLogo] = useState(initial.logo_url)
  const [state, action, pending] = useActionState<StepActionState, FormData>(saveBrandStep, {})

  const isValid = HEX.test(primary) && (accent === '' || HEX.test(accent))

  return (
    <>
      <form id="step-form" action={action} className="space-y-5">
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({ primary_color: primary, accent_color: accent, logo_url: logo })}
        />

        <ColorField
          label="Cor primária"
          hint="Cor principal do botão e cabeçalho. Use o hex completo (#000000)."
          value={primary}
          onChange={setPrimary}
        />
        <ColorField
          label="Cor de destaque (opcional)"
          hint="Cor de acento — botões secundários, badges. Em branco usa um tom da primária."
          value={accent}
          onChange={setAccent}
          allowEmpty
        />
        <Input
          label="URL do logo (opcional)"
          hint="https://… ou /logos/seu-arquivo.png. Pode subir o arquivo depois em Marca e aparência."
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://..."
        />

        {state.error ? (
          <p className="text-[0.8125rem] text-error">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup"
        canSubmit={isValid}
        pending={pending}
        submitLabel="Salvar e continuar"
      />
    </>
  )
}

function ColorField({
  label,
  hint,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
}) {
  const isValid = allowEmpty && value === '' ? true : HEX.test(value)
  return (
    <div>
      <label className="mb-1 block text-[0.8125rem] font-medium text-fg">{label}</label>
      <p className="mb-2 text-[0.8125rem] text-fg-muted">{hint}</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX.test(value) ? value : '#17343f'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          className="h-10 w-32 rounded-lg border border-transparent bg-bg-subtle px-3 font-mono text-[0.875rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
        />
      </div>
      {!isValid ? (
        <p className="mt-1 text-[0.75rem] text-error">Use o formato #RRGGBB.</p>
      ) : null}
    </div>
  )
}
