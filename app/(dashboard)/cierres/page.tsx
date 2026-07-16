import { createClient } from '@/lib/supabase/server'
import CierresClient from './CierresClient'
import type { CierreMensual } from '@/types'

export default async function CierresPage() {
  const supabase = await createClient()
  const { data: cierres } = await supabase
    .from('cierres_mensuales')
    .select('id, anio, mes, fecha_inicio, fecha_fin, fecha_cierre, total_ventas, total_egresos_caja, ganancia_neta, pdf_path')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })

  return <CierresClient cierres={(cierres ?? []) as Pick<CierreMensual, 'id' | 'anio' | 'mes' | 'fecha_inicio' | 'fecha_fin' | 'fecha_cierre' | 'total_ventas' | 'total_egresos_caja' | 'ganancia_neta' | 'pdf_path'>[]} />
}
