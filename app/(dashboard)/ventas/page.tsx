import { createClient } from '@/lib/supabase/server'
import VentasClient from './VentasClient'
import { getPeriodoActual, getUltimosPeriodos } from '@/lib/utils'

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

  const [{ data: ventas }, { data: ventasPeriodo }, { data: clientes }] = await Promise.all([
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
    supabase
      .from('ventas')
      .select('cliente')
      .order('cliente'),
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
    />
  )
}
