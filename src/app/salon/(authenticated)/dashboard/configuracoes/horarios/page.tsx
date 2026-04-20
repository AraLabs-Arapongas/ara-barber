import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import {
  BusinessHoursEditor,
  type BusinessHoursRow,
} from '@/components/dashboard/business-hours-editor'

const DEFAULT_HOURS: BusinessHoursRow[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  isOpen: weekday !== 0,
  startTime: '09:00',
  endTime: '19:00',
}))

export default async function HoursPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()

  const { data } = await supabase
    .from('business_hours')
    .select('weekday, is_open, start_time, end_time')
    .eq('tenant_id', tenant.id)

  const byWeekday = new Map<number, BusinessHoursRow>()
  for (const row of data ?? []) {
    byWeekday.set(row.weekday, {
      weekday: row.weekday,
      isOpen: row.is_open,
      startTime: row.start_time,
      endTime: row.end_time,
    })
  }

  const initial = DEFAULT_HOURS.map((def) => byWeekday.get(def.weekday) ?? def)

  return <BusinessHoursEditor initial={initial} />
}
