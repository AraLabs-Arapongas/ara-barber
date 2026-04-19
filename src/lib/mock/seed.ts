import type {
  Appointment,
  AvailabilityBlock,
  AvailabilityEntry,
  BusinessHoursRow,
  Customer,
  OperationMode,
  Payout,
  Professional,
  ProfessionalServiceLink,
  Service,
  TenantProfile,
} from './schemas'

function atMidnight(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

function setTime(d: Date, hour: number, minute: number): Date {
  const copy = new Date(d)
  copy.setHours(hour, minute, 0, 0)
  return copy
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function buildProfessionalsSeed(): Professional[] {
  const now = atMidnight(new Date())
  return [
    {
      id: 'p1',
      name: 'Carlos Silva',
      displayName: 'Carlinhos',
      phone: '(43) 99999-8888',
      photoUrl: null,
      isActive: true,
      createdAt: addDays(now, -30).toISOString(),
    },
    {
      id: 'p2',
      name: 'Roberto Souza',
      displayName: 'Beto',
      phone: '(43) 99999-7777',
      photoUrl: null,
      isActive: true,
      createdAt: addDays(now, -25).toISOString(),
    },
    {
      id: 'p3',
      name: 'André Lima',
      displayName: null,
      phone: null,
      photoUrl: null,
      isActive: true,
      createdAt: addDays(now, -10).toISOString(),
    },
  ]
}

export function buildServicesSeed(): Service[] {
  const now = atMidnight(new Date())
  return [
    {
      id: 's1',
      name: 'Corte masculino',
      description: 'Corte completo com finalização.',
      durationMinutes: 30,
      priceCents: 4500,
      isActive: true,
      createdAt: addDays(now, -60).toISOString(),
    },
    {
      id: 's2',
      name: 'Barba',
      description: null,
      durationMinutes: 20,
      priceCents: 3000,
      isActive: true,
      createdAt: addDays(now, -60).toISOString(),
    },
    {
      id: 's3',
      name: 'Combo corte + barba',
      description: 'O clássico.',
      durationMinutes: 50,
      priceCents: 7000,
      isActive: true,
      createdAt: addDays(now, -60).toISOString(),
    },
    {
      id: 's4',
      name: 'Pezinho',
      description: null,
      durationMinutes: 10,
      priceCents: 1500,
      isActive: true,
      createdAt: addDays(now, -60).toISOString(),
    },
    {
      id: 's5',
      name: 'Hidratação capilar',
      description: null,
      durationMinutes: 30,
      priceCents: 5000,
      isActive: false,
      createdAt: addDays(now, -30).toISOString(),
    },
  ]
}

export function buildCustomersSeed(): Customer[] {
  const now = atMidnight(new Date())
  return [
    {
      id: 'c1',
      name: 'João Pereira',
      email: 'joao@exemplo.com',
      phone: '(43) 98888-1234',
      isActive: true,
      createdAt: addDays(now, -14).toISOString(),
    },
    {
      id: 'c2',
      name: 'Marcos Vinícius',
      email: 'marcos@exemplo.com',
      phone: '(43) 98888-2345',
      isActive: true,
      createdAt: addDays(now, -10).toISOString(),
    },
    {
      id: 'c3',
      name: null,
      email: 'curioso@exemplo.com',
      phone: null,
      isActive: true,
      createdAt: addDays(now, -2).toISOString(),
    },
    {
      id: 'c4',
      name: 'Fernanda Costa',
      email: 'fer@exemplo.com',
      phone: '(43) 99777-1122',
      isActive: true,
      createdAt: addDays(now, -20).toISOString(),
    },
    {
      id: 'c5',
      name: 'Ricardo Mello',
      email: 'ric@exemplo.com',
      phone: '(43) 99777-3344',
      isActive: true,
      createdAt: addDays(now, -7).toISOString(),
    },
    {
      id: 'c6',
      name: 'Ana Beatriz',
      email: 'ana@exemplo.com',
      phone: '(43) 99666-5544',
      isActive: true,
      createdAt: addDays(now, -4).toISOString(),
    },
  ]
}

export function buildBusinessHoursSeed(): BusinessHoursRow[] {
  return Array.from({ length: 7 }, (_, w) => ({
    weekday: w,
    startTime: '09:00',
    endTime: '19:00',
    isOpen: w !== 0, // fecha domingo
  }))
}

export function buildProfessionalServicesSeed(): ProfessionalServiceLink[] {
  // Todos fazem s1-s4 (corte, barba, combo, pezinho). s5 (hidratação) ninguém faz.
  const professionalIds = ['p1', 'p2', 'p3']
  const serviceIds = ['s1', 's2', 's3', 's4']
  return professionalIds.flatMap((pid) => serviceIds.map((sid) => ({ professionalId: pid, serviceId: sid })))
}

export function buildAvailabilitySeed(): AvailabilityEntry[] {
  const professionalIds = ['p1', 'p2', 'p3']
  return professionalIds.flatMap((pid) =>
    [1, 2, 3, 4, 5, 6].map((w) => ({
      id: `av-${pid}-${w}`,
      professionalId: pid,
      weekday: w,
      startTime: '09:00',
      endTime: '19:00',
    })),
  )
}

export function buildBlocksSeed(): AvailabilityBlock[] {
  const now = atMidnight(new Date())
  return [
    {
      id: 'bl1',
      professionalId: 'p2',
      startAt: setTime(addDays(now, 7), 0, 0).toISOString(),
      endAt: setTime(addDays(now, 10), 23, 59).toISOString(),
      reason: 'Férias',
    },
  ]
}

// Matriz de horários pra gerar agendamentos de teste
const SEED_SLOTS: Array<{
  dayOffset: number
  hour: number
  minute: number
  profId: string
  svcId: string
  custId: string
}> = [
  // Passado (-7 a -1): marcados como completed/no-show
  { dayOffset: -6, hour: 10, minute: 0, profId: 'p1', svcId: 's1', custId: 'c1' },
  { dayOffset: -6, hour: 11, minute: 0, profId: 'p2', svcId: 's3', custId: 'c4' },
  { dayOffset: -5, hour: 14, minute: 30, profId: 'p1', svcId: 's2', custId: 'c2' },
  { dayOffset: -5, hour: 16, minute: 0, profId: 'p3', svcId: 's1', custId: 'c5' },
  { dayOffset: -4, hour: 9, minute: 30, profId: 'p2', svcId: 's1', custId: 'c6' },
  { dayOffset: -4, hour: 11, minute: 0, profId: 'p1', svcId: 's4', custId: 'c1' },
  { dayOffset: -3, hour: 10, minute: 0, profId: 'p3', svcId: 's2', custId: 'c2' },
  { dayOffset: -2, hour: 13, minute: 0, profId: 'p1', svcId: 's1', custId: 'c4' },
  { dayOffset: -2, hour: 15, minute: 30, profId: 'p2', svcId: 's3', custId: 'c5' },
  { dayOffset: -1, hour: 9, minute: 0, profId: 'p1', svcId: 's1', custId: 'c6' },
  { dayOffset: -1, hour: 11, minute: 30, profId: 'p3', svcId: 's1', custId: 'c1' },
  { dayOffset: -1, hour: 16, minute: 0, profId: 'p1', svcId: 's3', custId: 'c2' },
  // Hoje (0): mix de CONFIRMED e SCHEDULED
  { dayOffset: 0, hour: 9, minute: 0, profId: 'p1', svcId: 's1', custId: 'c4' },
  { dayOffset: 0, hour: 10, minute: 0, profId: 'p2', svcId: 's2', custId: 'c5' },
  { dayOffset: 0, hour: 10, minute: 30, profId: 'p3', svcId: 's1', custId: 'c6' },
  { dayOffset: 0, hour: 13, minute: 0, profId: 'p1', svcId: 's3', custId: 'c1' },
  { dayOffset: 0, hour: 14, minute: 0, profId: 'p2', svcId: 's1', custId: 'c2' },
  { dayOffset: 0, hour: 15, minute: 30, profId: 'p1', svcId: 's4', custId: 'c4' },
  { dayOffset: 0, hour: 16, minute: 30, profId: 'p3', svcId: 's3', custId: 'c5' },
  // Futuro (+1 a +14): SCHEDULED
  { dayOffset: 1, hour: 10, minute: 0, profId: 'p1', svcId: 's1', custId: 'c6' },
  { dayOffset: 1, hour: 11, minute: 30, profId: 'p3', svcId: 's2', custId: 'c1' },
  { dayOffset: 1, hour: 15, minute: 0, profId: 'p2', svcId: 's1', custId: 'c2' },
  { dayOffset: 2, hour: 9, minute: 30, profId: 'p1', svcId: 's3', custId: 'c4' },
  { dayOffset: 2, hour: 14, minute: 0, profId: 'p3', svcId: 's1', custId: 'c5' },
  { dayOffset: 3, hour: 10, minute: 0, profId: 'p1', svcId: 's2', custId: 'c6' },
  { dayOffset: 4, hour: 16, minute: 30, profId: 'p2', svcId: 's3', custId: 'c1' },
  { dayOffset: 5, hour: 13, minute: 0, profId: 'p3', svcId: 's1', custId: 'c2' },
  { dayOffset: 6, hour: 9, minute: 0, profId: 'p1', svcId: 's1', custId: 'c4' },
  { dayOffset: 8, hour: 11, minute: 0, profId: 'p3', svcId: 's1', custId: 'c5' },
  { dayOffset: 11, hour: 14, minute: 30, profId: 'p1', svcId: 's3', custId: 'c6' },
  { dayOffset: 13, hour: 10, minute: 0, profId: 'p3', svcId: 's2', custId: 'c1' },
]

const SERVICE_DURATIONS: Record<string, number> = {
  s1: 30,
  s2: 20,
  s3: 50,
  s4: 10,
  s5: 30,
}

export function buildAppointmentsSeed(): Appointment[] {
  const now = atMidnight(new Date())
  return SEED_SLOTS.map((slot, i) => {
    const date = addDays(now, slot.dayOffset)
    const startAt = setTime(date, slot.hour, slot.minute)
    const durationMin = SERVICE_DURATIONS[slot.svcId] ?? 30
    const endAt = new Date(startAt.getTime() + durationMin * 60000)
    let status: Appointment['status'] = 'SCHEDULED'
    if (slot.dayOffset < 0) {
      status = i % 10 === 9 ? 'NO_SHOW' : 'COMPLETED'
    } else if (slot.dayOffset === 0) {
      status = i % 3 === 0 ? 'CONFIRMED' : 'SCHEDULED'
    }
    return {
      id: `a${i + 1}`,
      customerId: slot.custId,
      professionalId: slot.profId,
      serviceId: slot.svcId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status,
      notes: null,
      createdAt: addDays(date, -3).toISOString(),
    }
  })
}

export function buildPayoutsSeed(): Payout[] {
  const now = atMidnight(new Date())
  const out: Payout[] = []
  // 4 payouts semanais retroativos (PAID) + 1 em aberto (PENDING)
  for (let i = 4; i >= 1; i--) {
    const periodEnd = addDays(now, -i * 7)
    const periodStart = addDays(periodEnd, -6)
    const gross = 180000 + i * 12500
    const fee = Math.round(gross * 0.04)
    out.push({
      id: `po${i}`,
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      grossCents: gross,
      feeCents: fee,
      netCents: gross - fee,
      status: 'PAID',
      paidAt: addDays(periodEnd, 2).toISOString(),
    })
  }
  // Ciclo atual
  const currentEnd = now
  const currentStart = addDays(now, -6)
  const grossCurrent = 95000
  const feeCurrent = Math.round(grossCurrent * 0.04)
  out.push({
    id: 'po0',
    periodStart: isoDate(currentStart),
    periodEnd: isoDate(currentEnd),
    grossCents: grossCurrent,
    feeCents: feeCurrent,
    netCents: grossCurrent - feeCurrent,
    status: 'PENDING',
    paidAt: null,
  })
  return out
}

export function buildTenantProfileSeed(tenantName: string): TenantProfile {
  return {
    name: tenantName,
    tagline: 'Corte, barba e tempo bem gasto.',
    address: 'Rua Exemplo, 123 — Centro',
    whatsapp: '(43) 99999-0000',
    timezone: 'America/Sao_Paulo',
  }
}

export function buildOperationModeSeed(): OperationMode {
  return { pinHash: null, enabled: false }
}
