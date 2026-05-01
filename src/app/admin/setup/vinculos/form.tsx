'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveLinksStep} from '@/lib/onboarding/actions'
import type { StepActionState } from '@/lib/onboarding/schemas'
import { WizardFooter } from '../_components/wizard-footer'

type Service = { id: string; name: string }
type Professional = { id: string; name: string }
type Link = { service_id: string; professional_id: string }

export function LinksForm({
  services,
  professionals,
  existingLinks,
}: {
  services: Service[]
  professionals: Professional[]
  existingLinks: Link[]
}) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (existingLinks.length > 0) {
      return new Set(existingLinks.map((l) => `${l.service_id}::${l.professional_id}`))
    }
    const all = new Set<string>()
    for (const s of services) for (const p of professionals) all.add(`${s.id}::${p.id}`)
    return all
  })

  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveLinksStep,
    {},
  )

  function toggle(serviceId: string, profId: string) {
    const key = `${serviceId}::${profId}`
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const links = useMemo<Link[]>(() => {
    return Array.from(checked).map((k) => {
      const [service_id, professional_id] = k.split('::')
      return { service_id, professional_id }
    })
  }, [checked])

  const isValid = links.length >= 1

  return (
    <>
      <form id="step-form" action={action}>
        <input type="hidden" name="payload" value={JSON.stringify({ links })} />
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[0.875rem]">
            <thead className="bg-bg-subtle text-[0.75rem] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Profissional</th>
                {services.map((s) => (
                  <th key={s.id} className="px-3 py-2 text-center font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {professionals.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium text-fg">{p.name}</td>
                  {services.map((s) => {
                    const key = `${s.id}::${p.id}`
                    return (
                      <td key={s.id} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked.has(key)}
                          onChange={() => toggle(s.id, p.id)}
                          className="h-4 w-4"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/profissionais"
        canSubmit={isValid}
        pending={pending}
        submitLabel="Concluir setup"
      />
    </>
  )
}
