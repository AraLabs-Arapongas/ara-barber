import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { HoursEditor } from './_hours-editor'

type Row = {
  weekday: number
  start_time: string
  end_time: string
  is_open: boolean
}

function defaultRow(weekday: number): Row {
  return { weekday, start_time: '09:00', end_time: '18:00', is_open: false }
}

export default async function HoursPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data } = await supabase
    .from('business_hours')
    .select('weekday, start_time, end_time, is_open')
    .order('weekday')

  const byWeekday = new Map<number, Row>((data ?? []).map((r) => [r.weekday, r as Row]))
  const initial = Array.from({ length: 7 }, (_, i) => {
    const row = byWeekday.get(i) ?? defaultRow(i)
    return {
      weekday: i,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      isOpen: row.is_open,
    }
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <header className="mb-8">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Configurações
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Horários de funcionamento
        </h1>
        <p className="mt-2 text-[0.9375rem] text-fg-muted">
          Quando seu salão abre e fecha em cada dia da semana.
        </p>
      </header>

      <HoursEditor initial={initial} />
    </main>
  )
}
