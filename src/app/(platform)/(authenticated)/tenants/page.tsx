import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { listAllTenants } from '@/lib/platform/tenants'
import { TenantsTable } from '@/components/platform/tenants-table'

export default async function TenantsListPage() {
  const tenants = await listAllTenants()
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[1.5rem] font-semibold text-fg">Tenants</h1>
        <Link href="/tenants/new" className={buttonVariants({ size: 'sm' })}>
          + Novo tenant
        </Link>
      </header>
      <TenantsTable tenants={tenants} />
    </div>
  )
}
