'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImageIcon, Trash2, Plus, Save, Star, Upload } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { SelectSheet } from '@/components/ui/select-sheet'
import {
  clearHeroImage,
  deleteTestimonial,
  updateDifferentials,
  updateHeroText,
  updateLandingBlocks,
  updateSocialLinks,
  uploadHeroImage,
  upsertTestimonial,
} from '@/app/admin/(authenticated)/actions/landing-page'
import { DIFFERENTIAL_ICONS } from '@/components/landing/differentials-block'

type BlockType =
  | 'HERO'
  | 'SERVICES'
  | 'DIFFERENTIALS'
  | 'PROFESSIONALS'
  | 'TESTIMONIALS'
  | 'CONTACT'
  | 'FINAL_CTA'

const BLOCK_LABELS: Record<BlockType, { label: string; hint: string }> = {
  HERO: { label: 'Hero', hint: 'Imagem fundo + headline + botão' },
  SERVICES: { label: 'Serviços', hint: 'Catálogo do que você oferece' },
  DIFFERENTIALS: { label: 'Diferenciais', hint: 'Por que escolher você' },
  PROFESSIONALS: { label: 'Profissionais', hint: 'Cards da sua equipe' },
  TESTIMONIALS: { label: 'Depoimentos', hint: 'O que clientes dizem' },
  CONTACT: { label: 'Contato e horário', hint: 'WhatsApp, endereço, horário' },
  FINAL_CTA: { label: 'Chamada final', hint: 'CTA + redes sociais' },
}

type BlockState = {
  blockType: BlockType
  enabled: boolean
  position: number
}

type DifferentialState = { icon: string; title: string; text: string }

type TestimonialState = {
  id: string
  author_name: string
  body: string
  rating: number
  position: number
}

type Props = {
  initialBlocks: BlockState[]
  initialHero: { subheadline: string; imageUrl: string | null }
  initialDifferentials: DifferentialState[]
  initialTestimonials: TestimonialState[]
  initialSocial: { instagram_url: string; facebook_url: string; tiktok_url: string }
}

export function LandingPageEditor({
  initialBlocks,
  initialHero,
  initialDifferentials,
  initialTestimonials,
  initialSocial,
}: Props) {
  return (
    <div className="space-y-10">
      <BlocksReorder initial={initialBlocks} />
      <HeroEditor initial={initialHero} />
      <DifferentialsEditor initial={initialDifferentials} />
      <TestimonialsEditor initial={initialTestimonials} />
      <SocialEditor initial={initialSocial} />
    </div>
  )
}

// ─── Blocos: toggle + drag ───────────────────────────────────────────

function BlocksReorder({ initial }: { initial: BlockState[] }) {
  const [items, setItems] = useState<BlockState[]>(
    [...initial].sort((a, b) => a.position - b.position),
  )
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((arr) => {
      const oldIdx = arr.findIndex((b) => b.blockType === active.id)
      const newIdx = arr.findIndex((b) => b.blockType === over.id)
      if (oldIdx < 0 || newIdx < 0) return arr
      return arrayMove(arr, oldIdx, newIdx)
    })
  }

  function toggle(type: BlockType) {
    setItems((arr) => arr.map((b) => (b.blockType === type ? { ...b, enabled: !b.enabled } : b)))
  }

  function save() {
    setMsg(null)
    const blocks = items.map((b, i) => ({
      blockType: b.blockType,
      enabled: b.enabled,
      position: i + 1,
    }))
    startTransition(async () => {
      const res = await updateLandingBlocks({ blocks })
      if (res.ok) setMsg({ kind: 'success', text: 'Ordem salva!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-display text-[1.125rem] font-semibold text-fg">Blocos da página</h2>
        <p className="text-[0.8125rem] text-fg-muted">
          Arraste pra reordenar e use o switch pra ativar ou desativar.
        </p>
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((b) => b.blockType)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {items.map((b) => (
              <SortableBlockRow key={b.blockType} block={b} onToggle={() => toggle(b.blockType)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending} loading={pending} size="sm">
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar ordem
        </Button>
        {msg ? (
          <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
        ) : null}
      </div>
    </section>
  )
}

function SortableBlockRow({ block, onToggle }: { block: BlockState; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.blockType,
  })
  const meta = BLOCK_LABELS[block.blockType]
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 text-fg-subtle hover:text-fg"
        aria-label={`Reordenar ${meta.label}`}
      >
        <GripVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex-1">
        <p className="font-medium text-fg">{meta.label}</p>
        <p className="text-[0.75rem] text-fg-muted">{meta.hint}</p>
      </div>
      <label className="inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={block.enabled}
          onChange={onToggle}
          className="peer sr-only"
        />
        <span className="relative h-6 w-11 rounded-full bg-bg-subtle transition-colors peer-checked:bg-brand-primary">
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    </li>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────

function HeroEditor({ initial }: { initial: { subheadline: string; imageUrl: string | null } }) {
  const [subheadline, setSubheadline] = useState(initial.subheadline)
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const res = await updateHeroText({ hero_subheadline: subheadline })
      if (res.ok) setMsg({ kind: 'success', text: 'Salvo!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  function pickFile() {
    inputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(null)
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadHeroImage(fd)
      if (res.ok) {
        setImageUrl(res.data.url)
        setMsg({ kind: 'success', text: 'Imagem atualizada!' })
      } else {
        setMsg({ kind: 'error', text: res.error })
      }
    })
  }

  function clearImage() {
    setMsg(null)
    startTransition(async () => {
      const res = await clearHeroImage()
      if (res.ok) {
        setImageUrl(null)
        setMsg({ kind: 'success', text: 'Imagem removida.' })
      } else {
        setMsg({ kind: 'error', text: res.error })
      }
    })
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-display text-[1.125rem] font-semibold text-fg">Hero</h2>
        <p className="text-[0.8125rem] text-fg-muted">
          Imagem de fundo e subtítulo do bloco principal. O título vem das configurações de marca.
        </p>
      </header>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-subtle">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Hero" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-fg-subtle">
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
              className="sr-only"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={pickFile}
              disabled={pending}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {imageUrl ? 'Trocar imagem' : 'Subir imagem'}
            </Button>
            {imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearImage}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remover
              </Button>
            ) : null}
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-fg">
            Subtítulo
            <textarea
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Ex: Atendimento personalizado, ambiente acolhedor, profissionais qualificados."
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending} loading={pending}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Salvar texto
            </Button>
          </div>
        </form>
        {msg ? (
          <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
        ) : null}
      </div>
    </section>
  )
}

// ─── Diferenciais ────────────────────────────────────────────────────

function DifferentialsEditor({ initial }: { initial: DifferentialState[] }) {
  const [items, setItems] = useState<DifferentialState[]>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function add() {
    if (items.length >= 6) return
    setItems((arr) => [...arr, { icon: 'sparkles', title: '', text: '' }])
  }

  function update(idx: number, field: keyof DifferentialState, value: string) {
    setItems((arr) => arr.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
  }

  function remove(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx))
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await updateDifferentials({ items })
      if (res.ok) setMsg({ kind: 'success', text: 'Salvo!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-display text-[1.125rem] font-semibold text-fg">Diferenciais</h2>
        <p className="text-[0.8125rem] text-fg-muted">
          Até 6 cards com ícone, título e descrição curta.
        </p>
      </header>
      <div className="space-y-3">
        {items.map((d, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <SelectSheet
                value={d.icon || 'sparkles'}
                onChange={(v) => update(i, 'icon', v)}
                options={DIFFERENTIAL_ICONS.map((ic) => ({ value: ic, label: ic }))}
                sheetTitle="Ícone do diferencial"
              />
              <Input
                value={d.title}
                onChange={(e) => update(i, 'title', e.target.value)}
                placeholder="Título"
                maxLength={60}
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <textarea
              value={d.text}
              onChange={(e) => update(i, 'text', e.target.value)}
              maxLength={220}
              rows={2}
              placeholder="Descrição curta"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[0.875rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:outline-none"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {items.length < 6 ? (
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={save} disabled={pending} loading={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar
        </Button>
        {msg ? (
          <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
        ) : null}
      </div>
    </section>
  )
}

// ─── Depoimentos ─────────────────────────────────────────────────────

function TestimonialsEditor({ initial }: { initial: TestimonialState[] }) {
  const [list, setList] = useState<TestimonialState[]>(initial)
  const [editing, setEditing] = useState<TestimonialState | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function startNew() {
    setEditing({ id: '', author_name: '', body: '', rating: 5, position: list.length })
  }

  function save() {
    if (!editing) return
    setMsg(null)
    startTransition(async () => {
      const res = await upsertTestimonial({
        id: editing.id || undefined,
        author_name: editing.author_name,
        body: editing.body,
        rating: editing.rating,
        position: editing.position,
      })
      if (res.ok) {
        // Atualiza lista local de forma otimista (a página reload via revalidate
        // traz id real em refresh subsequente).
        if (editing.id) {
          setList((arr) => arr.map((t) => (t.id === editing.id ? editing : t)))
        } else {
          setList((arr) => [...arr, { ...editing, id: `temp-${Date.now()}` }])
        }
        setEditing(null)
        setMsg({ kind: 'success', text: 'Salvo!' })
      } else {
        setMsg({ kind: 'error', text: res.error })
      }
    })
  }

  function remove(id: string) {
    if (!confirm('Excluir esse depoimento?')) return
    setMsg(null)
    startTransition(async () => {
      const res = await deleteTestimonial(id)
      if (res.ok) {
        setList((arr) => arr.filter((t) => t.id !== id))
        setMsg({ kind: 'success', text: 'Excluído.' })
      } else {
        setMsg({ kind: 'error', text: res.error })
      }
    })
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-display text-[1.125rem] font-semibold text-fg">Depoimentos</h2>
        <p className="text-[0.8125rem] text-fg-muted">Adicione comentários reais de clientes.</p>
      </header>

      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-brand-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5"
                      fill={i < t.rating ? 'currentColor' : 'none'}
                      strokeWidth={i < t.rating ? 0 : 1.5}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="mt-1 text-[0.875rem] text-fg">&ldquo;{t.body}&rdquo;</p>
                <p className="mt-1 text-[0.75rem] text-fg-muted">— {t.author_name}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  Editar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-bg-subtle p-4 text-center text-[0.875rem] text-fg-muted">
          Nenhum depoimento ainda.
        </p>
      )}

      {editing ? (
        <div className="space-y-3 rounded-xl border border-brand-primary/40 bg-surface p-4">
          <Input
            value={editing.author_name}
            onChange={(e) => setEditing({ ...editing, author_name: e.target.value })}
            placeholder="Nome do cliente"
            maxLength={80}
          />
          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder="O que o cliente disse"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[0.875rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:outline-none"
          />
          <div className="flex items-center gap-2 text-[0.8125rem] text-fg">
            <span>Estrelas:</span>
            <SelectSheet
              value={editing.rating}
              onChange={(v) => setEditing({ ...editing, rating: v })}
              options={[5, 4, 3, 2, 1].map((n) => ({ value: n, label: String(n) }))}
              sheetTitle="Estrelas"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={pending} loading={pending}>
              Salvar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={startNew}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar depoimento
        </Button>
      )}
      {msg ? (
        <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
      ) : null}
    </section>
  )
}

// ─── Redes sociais ───────────────────────────────────────────────────

function SocialEditor({
  initial,
}: {
  initial: { instagram_url: string; facebook_url: string; tiktok_url: string }
}) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    startTransition(async () => {
      const res = await updateSocialLinks(data)
      if (res.ok) setMsg({ kind: 'success', text: 'Salvo!' })
      else setMsg({ kind: 'error', text: res.error })
    })
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-display text-[1.125rem] font-semibold text-fg">Redes sociais</h2>
        <p className="text-[0.8125rem] text-fg-muted">URLs completas (https://...).</p>
      </header>
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="block text-sm font-medium text-fg">
          Instagram
          <Input
            type="url"
            value={data.instagram_url}
            onChange={(e) => setData({ ...data, instagram_url: e.target.value })}
            placeholder="https://instagram.com/seunegocio"
            className="mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-fg">
          Facebook
          <Input
            type="url"
            value={data.facebook_url}
            onChange={(e) => setData({ ...data, facebook_url: e.target.value })}
            placeholder="https://facebook.com/seunegocio"
            className="mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-fg">
          TikTok
          <Input
            type="url"
            value={data.tiktok_url}
            onChange={(e) => setData({ ...data, tiktok_url: e.target.value })}
            placeholder="https://tiktok.com/@seunegocio"
            className="mt-1"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending} loading={pending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar
          </Button>
          {msg ? (
            <Alert variant={msg.kind === 'success' ? 'success' : 'error'}>{msg.text}</Alert>
          ) : null}
        </div>
      </form>
    </section>
  )
}
