'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ChevronLeft, Store, MapPin, MessageCircle } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { TENANT_PROFILE_ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { formatBrPhone } from '@/lib/format'
import { buildTenantProfileSeed } from '@/lib/mock/seed'

export default function PerfilPage() {
  const tenantSlug = useTenantSlug()
  const fallbackName =
    tenantSlug === 'barbearia-teste'
      ? 'Barbearia Teste'
      : tenantSlug === 'casa-do-corte'
        ? 'Casa do Corte'
        : tenantSlug === 'barba-preta'
          ? 'Barba Preta'
          : tenantSlug
  const { data: profile, setData } = useMockStore(
    tenantSlug,
    TENANT_PROFILE_ENTITY.key,
    TENANT_PROFILE_ENTITY.schema,
    () => buildTenantProfileSeed(fallbackName),
  )
  const [name, setName] = useState(profile.name)
  const [tagline, setTagline] = useState(profile.tagline ?? '')
  const [address, setAddress] = useState(profile.address ?? '')
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? '')
  const [timezone, setTimezone] = useState(profile.timezone)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setMessage({ kind: 'error', text: 'Nome é obrigatório.' })
      return
    }
    setData({
      name: name.trim(),
      tagline: tagline.trim() || null,
      address: address.trim() || null,
      whatsapp: whatsapp.trim() || null,
      timezone: timezone.trim() || 'America/Sao_Paulo',
    })
    setMessage({ kind: 'success', text: 'Perfil atualizado.' })
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Salão
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Perfil do salão
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Informações exibidas pros clientes no booking.
        </p>
      </header>

      <Card>
        <CardContent className="py-5">
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Nome do salão"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<Store className="h-4 w-4" />}
              maxLength={200}
            />
            <Input
              label="Tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={140}
              placeholder="Frase curta exibida na home"
              hint="Máximo 140 caracteres."
            />
            <Input
              label="Endereço"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              leftIcon={<MapPin className="h-4 w-4" />}
              placeholder="Rua, número, bairro"
            />
            <Input
              label="WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatBrPhone(e.target.value))}
              leftIcon={<MessageCircle className="h-4 w-4" />}
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              maxLength={16}
            />
            <Input
              label="Fuso horário"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Sao_Paulo"
              hint="Usado pra converter horários dos agendamentos."
            />

            {message ? (
              <Alert variant={message.kind}>{message.text}</Alert>
            ) : null}

            <Button type="submit" size="lg" fullWidth>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
