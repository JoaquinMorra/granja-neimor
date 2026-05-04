import { createClient } from '@/lib/supabase/server'
import CajaClient from './CajaClient'
import { getPeriodoActual, getUltimosPeriodos } from '@/lib/utils'

export default async function CajaPage() {
  const supabase = await createClient()
  const { inicio: mesInicio, fin: mesFin, label: periodoLabel } = getPeriodoActual()
  const periodos = getUltimosPeriodos(6)
  const inicioHistorico = periodos[0].inicio

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
      .gte('fecha', inicioHistorico)
      .order('fecha'),
  ])

  return (
    <CajaClient
      movimientos={movimientos ?? []}
      resumenMensual={resumenMensual ?? []}
      periodoLabel={periodoLabel}
      periodos={periodos}
    />
  )
}
