import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Palette } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { Button, buttonVariants } from '@/components/ui/button'

export default async function Stage1DonePage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage1.completed) redirect('/admin/setup')

  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        <CheckCircle2 className="h-16 w-16 text-success" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
        Etapa 1 concluída!
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[0.9375rem] text-fg-muted">
        Seu negócio já tá pronto pra receber agendamentos. Quer personalizar a
        marca agora ou seguir pro dashboard?
      </p>

      <div className="mx-auto mt-8 max-w-sm space-y-3">
        <Link href="/admin/setup/marca" className="block">
          <Button size="lg" fullWidth>
            <Palette className="h-4 w-4" />
            Personalizar marca (Etapa 2)
          </Button>
        </Link>
        <Link
          href="/admin/dashboard"
          className={buttonVariants({ variant: 'secondary', size: 'lg', fullWidth: true })}
        >
          Ir pro dashboard
        </Link>
      </div>
    </div>
  )
}
