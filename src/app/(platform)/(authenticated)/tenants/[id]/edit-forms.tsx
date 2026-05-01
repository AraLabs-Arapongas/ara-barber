'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  updateTenantBrandingAction,
  setTenantStatusAction,
  type UpdateBrandingState,
  type SetStatusState,
} from '../../actions'

export function BrandingForm({
  tenantId,
  primaryColor,
  secondaryColor,
  accentColor,
}: {
  tenantId: string
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
}) {
  const [state, action, pending] = useActionState<UpdateBrandingState, FormData>(
    updateTenantBrandingAction,
    {},
  )
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <ColorField label="Cor primária" name="primaryColor" defaultValue={primaryColor ?? ''} />
      <ColorField
        label="Cor secundária"
        name="secondaryColor"
        defaultValue={secondaryColor ?? ''}
      />
      <ColorField label="Cor accent" name="accentColor" defaultValue={accentColor ?? ''} />
      {state.error ? <p className="text-[0.8125rem] text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-[0.8125rem] text-success">Salvo.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando...' : 'Salvar branding'}
      </Button>
    </form>
  )
}

function ColorField({
  label,
  name,
  defaultValue,
}: {
  label: string
  name: string
  defaultValue: string
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-32 text-[0.8125rem] text-fg-muted">{label}</span>
      <Input
        name={name}
        defaultValue={defaultValue}
        placeholder="#000000"
        className="max-w-[140px]"
      />
    </label>
  )
}

export function StatusActions({ tenantId, current }: { tenantId: string; current: string }) {
  const [state, action, pending] = useActionState<SetStatusState, FormData>(
    setTenantStatusAction,
    {},
  )
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <span className="text-[0.8125rem] text-fg-muted">Atual: {current}</span>
      {(['ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const)
        .filter((s) => s !== current)
        .map((s) => (
          <Button
            key={s}
            type="submit"
            name="status"
            value={s}
            variant="secondary"
            disabled={pending}
          >
            → {s}
          </Button>
        ))}
      {state.error ? <span className="text-[0.8125rem] text-danger">{state.error}</span> : null}
      {state.ok ? <span className="text-[0.8125rem] text-success">✓</span> : null}
    </form>
  )
}
