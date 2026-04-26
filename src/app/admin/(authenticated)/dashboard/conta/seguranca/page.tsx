import { SecurityPanel } from '@/components/dashboard/security-panel'

export default function SegurancaPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Segurança
        </h1>
        <p className="mt-1 text-sm text-fg-muted">Sua senha e suas sessões.</p>
      </header>
      <SecurityPanel />
    </main>
  )
}
