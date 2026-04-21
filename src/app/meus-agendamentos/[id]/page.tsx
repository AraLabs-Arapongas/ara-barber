import { AppointmentDetailView } from '@/components/appointments/appointment-detail-view'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function CustomerAppointmentDetailPage({ params }: PageProps) {
  const { id } = await params
  return <AppointmentDetailView id={id} />
}
