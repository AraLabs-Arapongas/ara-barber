import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'

import { NewTenantForm } from './form'

export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/tenants" className="text-[0.8125rem] text-fg-muted hover:text-fg">
        ← Tenants
      </Link>
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Novo tenant</h1>
      <Card>
        <CardContent className="py-6">
          <NewTenantForm />
        </CardContent>
      </Card>
    </div>
  )
}
