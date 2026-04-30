'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminPlanRow } from '@/lib/platform/plans'

import { upsertPlanAction, type UpsertPlanState } from '../actions'

export function PlanRow({ plan }: { plan: AdminPlanRow | null }) {
  const [state, action, pending] = useActionState<UpsertPlanState, FormData>(
    upsertPlanAction,
    {},
  )
  const isNew = plan === null
  const formId = isNew ? 'new-plan' : `plan-${plan.id}`
  return (
    <tr>
      <td className="px-3 py-1.5">
        <form action={action} id={formId}>
          {!isNew ? <input type="hidden" name="id" value={plan.id} /> : null}
          <Input
            name="code"
            defaultValue={plan?.code ?? ''}
            placeholder={isNew ? 'NOVO_CODE' : ''}
            required
            className="h-8"
          />
        </form>
      </td>
      <td className="px-3 py-1.5">
        <Input
          form={formId}
          name="name"
          defaultValue={plan?.name ?? ''}
          required
          className="h-8"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Input
          form={formId}
          name="monthly_price_cents"
          type="number"
          defaultValue={plan?.monthly_price_cents ?? 0}
          className="h-8 text-right"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Input
          form={formId}
          name="trial_days_default"
          type="number"
          defaultValue={plan?.trial_days_default ?? 0}
          className="h-8 text-right"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Button type="submit" form={formId} size="sm" disabled={pending}>
          {pending ? '...' : isNew ? 'Criar' : 'Salvar'}
        </Button>
        {state.error ? (
          <span className="ml-2 text-[0.75rem] text-danger">{state.error}</span>
        ) : null}
        {state.ok ? <span className="ml-2 text-[0.75rem] text-success">✓</span> : null}
      </td>
    </tr>
  )
}
