import { createClient } from '@/lib/supabase/server'
import { calcularAgregadosCierre } from '@/lib/cierres/calcular-agregados'
import { getPeriodoActual } from '@/lib/utils'
import NuevoCierreClient from './NuevoCierreClient'
import type { CierreMensual } from '@/types'

export default async function NuevoCierrePage() {
  const supabase = await createClient()
  const periodo = getPeriodoActual()

  const inicioDate = new Date(periodo.inicio + 'T12:00:00')
  const anioDefault = inicioDate.getFullYear()
  const mesDefault = inicioDate.getMonth() + 1

  const [{ data: existentes }, { data: anteriorRaw }, agregadosIniciales] = await Promise.all([
    supabase.from('cierres_mensuales').select('anio, mes'),
    supabase.from('cierres_mensuales').select('*').order('fecha_fin', { ascending: false }).limit(1).maybeSingle(),
    calcularAgregadosCierre(supabase, periodo.inicio, periodo.fin),
  ])

  return (
    <NuevoCierreClient
      fechaInicioDefault={periodo.inicio}
      fechaFinDefault={periodo.fin}
      anioDefault={anioDefault}
      mesDefault={mesDefault}
      agregadosIniciales={agregadosIniciales}
      cierresExistentes={existentes ?? []}
      cierreAnterior={(anteriorRaw as CierreMensual) ?? null}
    />
  )
}
