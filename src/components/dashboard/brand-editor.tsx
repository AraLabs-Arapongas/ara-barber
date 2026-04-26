'use client'

import { useState, useTransition } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateTenantBrand } from '@/app/admin/(authenticated)/actions/tenant-profile'

type Initial = {
  primary_color: string
  secondary_color: string
  accent_color: string
  logo_url: string
  favicon_url: string
  home_headline_top: string
  home_headline_accent: string
}

export function BrandEditor({ initial }: { initial: Initial }) {
  const [data, setData] = useState<Initial>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const result = await updateTenantBrand(data)
      if (!result.ok) {
        setMsg({ kind: 'error', text: result.error })
      } else {
        setMsg({ kind: 'success', text: 'Salvo!' })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-fg">Cores</legend>
        <ColorRow
          label="Primária"
          value={data.primary_color}
          onChange={(v) => setData((d) => ({ ...d, primary_color: v }))}
        />
        <ColorRow
          label="Secundária"
          value={data.secondary_color}
          onChange={(v) => setData((d) => ({ ...d, secondary_color: v }))}
        />
        <ColorRow
          label="Destaque"
          value={data.accent_color}
          onChange={(v) => setData((d) => ({ ...d, accent_color: v }))}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-fg">Imagens (URL)</legend>
        <Field label="Logo (URL)">
          <Input
            type="url"
            value={data.logo_url}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setData((d) => ({ ...d, logo_url: e.target.value }))
            }
            placeholder="https://..."
          />
        </Field>
        <Field label="Favicon (URL)">
          <Input
            type="url"
            value={data.favicon_url}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setData((d) => ({ ...d, favicon_url: e.target.value }))
            }
            placeholder="https://..."
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-fg">Headline da home pública</legend>
        <Field label="Linha de cima">
          <Input
            value={data.home_headline_top}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setData((d) => ({ ...d, home_headline_top: e.target.value }))
            }
            maxLength={120}
          />
        </Field>
        <Field label="Destaque">
          <Input
            value={data.home_headline_accent}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setData((d) => ({ ...d, home_headline_accent: e.target.value }))
            }
            maxLength={120}
          />
        </Field>
      </fieldset>

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

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={`${label} (color picker)`}
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 rounded border border-border"
      />
      <span className="flex-1 text-sm">{label}</span>
      <Input
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder="#000000"
        maxLength={7}
        containerClassName="w-32"
      />
    </div>
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
