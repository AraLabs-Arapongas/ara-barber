'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { ChevronRight, Plus, User, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { formatBrPhone } from '@/lib/format'
import { createProfessional } from '@/app/admin/(authenticated)/actions/professionals'

export type ProfessionalListItem = {
  id: string
  name: string
  displayName: string | null
  phone: string | null
  isActive: boolean
}

type Props = {
  professionals: ProfessionalListItem[]
}

export function ProfessionalsManager({ professionals }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre sheet vinda do FAB global
      setSheetOpen(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  function openCreate() {
    setPhone('')
    setError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
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
    const displayName = String(fd.get('displayName') ?? '').trim() || undefined

    startTransition(async () => {
      const result = await createProfessional({
        name,
        displayName,
        phone: phone || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      form.reset()
      setPhone('')
      closeSheet()
      router.refresh()
    })
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
          <p className="mt-1 text-[0.875rem] text-fg-muted">Quem atende no seu negócio.</p>
          <Button type="button" size="sm" onClick={openCreate} className="mt-3">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar profissional
          </Button>
        </header>

        {professionals.length > 0 ? (
          <ul className="space-y-2">
            {professionals.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/dashboard/profissionais/${p.id}`} className="block">
                  <Card className="shadow-xs transition-colors hover:bg-bg-subtle">
                    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <InitialsAvatar name={p.displayName || p.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-fg">
                          {p.displayName || p.name}
                        </p>
                        <p className="truncate text-[0.8125rem] text-fg-muted">
                          {p.phone ?? 'sem telefone'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={
                            p.isActive
                              ? 'rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success'
                              : 'rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle'
                          }
                        >
                          {p.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 text-fg-subtle"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="shadow-xs">
            <CardContent className="py-10 text-center">
              <p className="text-[0.9375rem] text-fg-muted">
                Nenhum profissional ainda.
              </p>
              <Button className="mt-4" onClick={openCreate}>
                Adicionar profissional
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Novo profissional"
        description="Adicione alguém da equipe."
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
            <Button type="button" variant="secondary" fullWidth onClick={closeSheet}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={pending}>
              Adicionar
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  )
}
