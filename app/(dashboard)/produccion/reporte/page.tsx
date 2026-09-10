import { createClient } from '@/lib/supabase/server'
import { getProduccionPorPeriodo } from '@/lib/produccion/reporte'
import { getPeriodoActual, getPeriodoAnterior, hoyISO } from '@/lib/utils'
import ReporteProduccionClient from './ReporteProduccionClient'

export default async function ReporteProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fin?: string }>
}) {
  const { inicio: inicioParam, fin: finParam } = await searchParams
  const periodoAnterior = getPeriodoAnterior()
  const periodoActual = getPeriodoActual()

  // Por defecto se abre en el período recién cerrado (no el actual, que
  // todavía está en curso) — este reporte es para revisar un mes cerrado.
  const fechaInicio = inicioParam ?? periodoAnterior.inicio
  const fechaFin = finParam ?? periodoAnterior.fin

  const supabase = await createClient()
  const reporte = await getProduccionPorPeriodo(supabase, fechaInicio, fechaFin)

  return (
    <ReporteProduccionClient
      reporte={reporte}
      fechaInicio={fechaInicio}
      fechaFin={fechaFin}
      periodoAnterior={periodoAnterior}
      periodoActual={periodoActual}
      hoy={hoyISO()}
    />
  )
}
