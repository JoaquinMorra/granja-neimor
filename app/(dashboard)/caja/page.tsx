import { createClient } from '@/lib/supabase/server'
import CajaClient from './CajaClient'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export default async function CajaPage() {
  const supabase = await createClient()
  const hoy = new Date()
  const mesInicio = format(startOfMonth(hoy), 'yyyy-MM-dd')
  const mesFin = format(endOfMonth(hoy), 'yyyy-MM-dd')
  const seiseMesesAtras = format(startOfMonth(subMonths(hoy, 5)), 'yyyy-MM-dd')

  const [{ data: movimientos }, { data: resumenMensual }] = await Promise.all([
    supabase
      .from('caja')
      .select('*')
      .gte('fecha', mesInicio)
      .lte('fecha', mesFin)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('caja')
      .select('fecha, tipo, monto')
      .gte('fecha', seiseMesesAtras)
      .order('fecha'),
  ])

  return (
    <CajaClient
      movimientos={movimientos ?? []}
      resumenMensual={resumenMensual ?? []}
    />
  )
}
