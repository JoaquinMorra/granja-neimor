import { createClient } from '@/lib/supabase/server'
import CajaClient from './CajaClient'
import { getPeriodoActual, getUltimosPeriodos, hoyISO } from '@/lib/utils'

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo: periodoParam } = await searchParams
  const periodos = getUltimosPeriodos(6)
  const periodoActual = getPeriodoActual()

  const periodoEncontrado = periodoParam
    ? periodos.find((p) => p.inicio === periodoParam)
    : undefined

  const mesInicio = periodoEncontrado?.inicio ?? periodoActual.inicio
  const mesFin = periodoEncontrado?.fin ?? periodoActual.fin

  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const periodoLabel = `${new Date(mesInicio + 'T12:00:00').toLocaleDateString('es-AR', fmt)} – ${new Date(mesFin + 'T12:00:00').toLocaleDateString('es-AR', fmt)}`

  const inicioHistorico = periodos[0].inicio
  const hoy = hoyISO()

  const [{ data: movimientos }, { data: resumenMensual }, { data: futuras }] = await Promise.all([
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
    supabase
      .from('caja')
      .select('id')
      .gt('fecha', hoy),
  ])

  return (
    <CajaClient
      movimientos={movimientos ?? []}
      resumenMensual={resumenMensual ?? []}
      periodoLabel={periodoLabel}
      periodoInicio={mesInicio}
      periodos={periodos}
      cantFuturas={futuras?.length ?? 0}
    />
  )
}
