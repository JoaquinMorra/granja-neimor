import { createClient } from '@/lib/supabase/server'
import VentasClient from './VentasClient'
import { getPeriodoActual, getUltimosPeriodos, hoyISO } from '@/lib/utils'

export default async function VentasPage({
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

  const periodoInicio = periodoEncontrado?.inicio ?? periodoActual.inicio
  const periodoFin = periodoEncontrado?.fin ?? periodoActual.fin

  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const periodoLabel = `${new Date(periodoInicio + 'T12:00:00').toLocaleDateString('es-AR', fmt)} – ${new Date(periodoFin + 'T12:00:00').toLocaleDateString('es-AR', fmt)}`

  const hoy = hoyISO()

  const [
    { data: ventas },
    { data: ventasPeriodo },
    { data: clientes },
    { data: productos },
    { data: preciosEspeciales },
    { data: clientesConfig },
  ] = await Promise.all([
    supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('ventas')
      .select('cliente, equivalente_huevos, estado, monto_cobrado, monto_debe')
      .gte('fecha', periodoInicio)
      .lte('fecha', periodoFin),
    supabase.from('ventas').select('cliente').order('cliente'),
    supabase.from('productos').select('*').eq('activo', true).order('codigo'),
    supabase
      .from('precios_especiales_cliente')
      .select('*, producto:productos(codigo)')
      .lte('vigente_desde', hoy)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`),
    supabase.from('clientes_config').select('*'),
  ])

  const clientesUnicos = [...new Set((clientes ?? []).map((c) => c.cliente))].sort()

  return (
    <VentasClient
      ventas={ventas ?? []}
      ventasPeriodo={ventasPeriodo ?? []}
      clientesExistentes={clientesUnicos}
      periodoLabel={periodoLabel}
      periodoInicio={periodoInicio}
      periodos={periodos}
      productos={productos ?? []}
      preciosEspeciales={preciosEspeciales ?? []}
      clientesConfig={clientesConfig ?? []}
    />
  )
}
