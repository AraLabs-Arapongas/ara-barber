type Props = { current: 1 | 2 | 3 | 4 }

const TITLES: Record<Props['current'], string> = {
  1: 'Horários de funcionamento',
  2: 'Serviços',
  3: 'Profissionais',
  4: 'Quem faz o quê',
}

export function ProgressIndicator({ current }: Props) {
  const total = 4
  const pct = (current / total) * 100
  return (
    <div className="mb-8">
      <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        Etapa {current} de {total}
      </p>
      <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
        {TITLES[current]}
      </h1>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
