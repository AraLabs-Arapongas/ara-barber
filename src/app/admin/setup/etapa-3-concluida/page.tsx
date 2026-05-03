import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { Button } from '@/components/ui/button'

export default async function Stage3DonePage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage3.completed) redirect('/admin/setup')

  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        <Sparkles className="h-16 w-16 text-brand-primary" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
        Tudo pronto!
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[0.9375rem] text-fg-muted">
        Seu negócio tá configurado. Compartilhe seu link de agendamento e comece a
        receber clientes. Ajustes finos sempre disponíveis no menu Mais.
      </p>

      <div className="mx-auto mt-8 max-w-sm">
        <Link href="/admin/dashboard" className="block">
          <Button size="lg" fullWidth>
            Ir pro dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
