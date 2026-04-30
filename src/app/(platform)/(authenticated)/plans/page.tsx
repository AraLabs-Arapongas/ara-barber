import { listPlans } from '@/lib/platform/plans'

import { PlanRow } from './plan-row'

export default async function PlansPage() {
  const plans = await listPlans()
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Plans</h1>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.875rem]">
          <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-right">Preço/mês</th>
              <th className="px-3 py-2 text-right">Trial (dias)</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
            <PlanRow plan={null} />
          </tbody>
        </table>
      </div>
    </div>
  )
}
