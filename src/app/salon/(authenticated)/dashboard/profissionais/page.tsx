'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { User, Phone, Trash2, Power } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Professional } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { formatBrPhone } from '@/lib/format'

export default function ProfessionalsPage() {
  const tenantSlug = useTenantSlug()
  const { data: professionals, setData } = useMockStore(
    tenantSlug,
    ENTITY.professionals.key,
    ENTITY.professionals.schema,
    ENTITY.professionals.seed,
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSheetOpen(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  function resetForm() {
    setPhone('')
    setError(null)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) {
      setError('Nome é obrigatório.')
      return
    }
    const displayName = String(fd.get('displayName') ?? '').trim() || null
    const newPro: Professional = {
      id: mockId('p'),
      name,
      displayName,
      phone: phone || null,
      photoUrl: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    setData((prev) => [...prev, newPro])
    form.reset()
    resetForm()
    setSheetOpen(false)
  }

  function toggleActive(id: string) {
    setData((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p)))
  }

  function remove(id: string) {
    if (!window.confirm('Remover este profissional?')) return
    setData((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
        <header className="mb-6">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Equipe
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Profissionais
          </h1>
          <p className="mt-1 text-[0.875rem] text-fg-muted">
            Quem atende no seu salão.
          </p>
        </header>

        {professionals.length > 0 ? (
          <ul className="space-y-2">
            {professionals.map((p) => (
              <li key={p.id}>
                <Card className="shadow-xs">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{p.displayName || p.name}</p>
                      <p className="truncate text-[0.8125rem] text-fg-muted">
                        {p.phone ?? 'sem telefone'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={
                          p.isActive
                            ? 'rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success'
                            : 'rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle'
                        }
                      >
                        {p.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleActive(p.id)}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg"
                        aria-label={p.isActive ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-error-bg hover:text-error"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="shadow-xs">
            <CardContent className="py-10 text-center">
              <p className="text-[0.9375rem] text-fg-muted">
                Nenhum profissional ainda. Toque no <strong>+</strong> para começar.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          resetForm()
        }}
        title="Novo profissional"
        description="Adicione alguém da equipe do salão."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            name="name"
            required
            autoFocus
            maxLength={200}
            placeholder="Ex: Carlos Silva"
            leftIcon={<User className="h-4 w-4" />}
          />
          <Input
            label="Nome curto"
            name="displayName"
            maxLength={100}
            placeholder="Ex: Carlinhos (opcional)"
            hint="Exibido no booking, se preenchido."
          />
          <Input
            label="Telefone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={16}
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(formatBrPhone(e.target.value))}
            leftIcon={<Phone className="h-4 w-4" />}
          />

          {error ? (
            <Alert variant="error" title="Não foi possível adicionar">
              {error}
            </Alert>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setSheetOpen(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Adicionar
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  )
}
