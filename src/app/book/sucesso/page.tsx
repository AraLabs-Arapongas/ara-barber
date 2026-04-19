'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fullDateTimeLabel } from '@/lib/mock/helpers'

export default function BookSuccess() {
  const tenantSlug = useTenantSlug()
  const sp = useSearchParams()
  const appointmentId = sp?.get('appointmentId') ?? ''

  const { data: appointments } = useMockStore(
    tenantSlug,
    ENTITY.appointments.key,
    ENTITY.appointments.schema,
    ENTITY.appointments.seed,
  )
  const { data: services } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const { data: professionals } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )

  const appt = appointments.find((a) => a.id === appointmentId)
  const svc = appt ? services.find((s) => s.id === appt.serviceId) : undefined
  const prof = appt ? professionals.find((p) => p.id === appt.professionalId) : undefined

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-5 pt-10 pb-24 text-center sm:px-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[1.875rem] font-semibold leading-tight tracking-tight text-fg">
        Agendado!
      </h1>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-fg-muted">
        Você vai receber uma confirmação por e-mail. Se precisar reagendar, entre em
        &ldquo;Meus agendamentos&rdquo;.
      </p>

      {appt ? (
        <Card className="mt-6 w-full shadow-xs">
          <CardContent className="py-5 text-left">
            <p className="font-display text-[1.125rem] font-semibold text-fg">
              {svc?.name ?? 'Serviço'}
            </p>
            <p className="text-[0.875rem] text-fg-muted">
              com {prof?.displayName || prof?.name} · {fullDateTimeLabel(appt.startAt)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex w-full flex-col gap-2">
        <Link href="/meus-agendamentos">
          <Button size="lg" fullWidth>
            Ver meus agendamentos
          </Button>
        </Link>
        <Link href="/">
          <Button size="lg" variant="secondary" fullWidth>
            Voltar à home
          </Button>
        </Link>
      </div>
    </main>
  )
}
