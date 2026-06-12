import { createClient } from '@/lib/supabase/server'
import MercadoClient from './MercadoClient'
import { getPeriodoActual, getUltimosPeriodos, hoyISO } from '@/lib/utils'

export default async function MercadoPage({
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

  const hoy = hoyISO()

  const [
    { data: productos },
    { data: transRaw },
    { data: cierresRaw },
    { data: cierreHoy },
  ] = await Promise.all([
    supabase
      .from('productos')
      .select('id, codigo, nombre, precio_mayorista, precio_minorista, unidades_por_caja')
      .eq('activo', true)
      .order('codigo'),
    supabase
      .from('puesto_transferencias')
      .select('*, items:puesto_transferencia_items(id, producto_id, cantidad, producto:productos(id, codigo, nombre, unidades_por_caja))')
      .is('deleted_at', null)
      .order('fecha', { ascending: false }),
    supabase
      .from('puesto_cierres')
      .select('*, items:puesto_cierre_items(id, producto_id, cantidad, precio_unitario, total_linea, producto:productos(id, codigo, nombre, unidades_por_caja, precio_minorista))')
      .is('deleted_at', null)
      .order('fecha', { ascending: false }),
    supabase
      .from('puesto_cierres')
      .select('id')
      .eq('fecha', hoy)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  return (
    <MercadoClient
      periodos={periodos}
      periodoInicio={mesInicio}
      periodoFin={mesFin}
      periodoLabel={periodoLabel}
      productos={(productos ?? []) as any}
      transferencias={(transRaw ?? []) as any}
      cierres={(cierresRaw ?? []) as any}
      hayClosureHoy={!!cierreHoy}
    />
  )
}
