import { createClient } from '@/lib/supabase/server'
import CostosClient from './CostosClient'
import { getPeriodoActual, getUltimosPeriodos } from '@/lib/utils'

export default async function CostosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const supabase = await createClient()
  const { periodo: periodoParam } = await searchParams
  const periodos = getUltimosPeriodos(6)
  const periodoActual = getPeriodoActual()

  const periodoEncontrado = periodoParam ? periodos.find((p) => p.inicio === periodoParam) : undefined
  const inicio = periodoEncontrado?.inicio ?? periodoActual.inicio
  const fin = periodoEncontrado?.fin ?? periodoActual.fin
  const label = periodoEncontrado?.label ?? periodoActual.label

  const [
    { data: comprasRaw },
    { data: egresosRaw },
    { data: produccionRaw },
    { data: gallinasRaw },
    { data: configRaw },
    { data: productos },
    { data: ventasRaw },
  ] = await Promise.all([
    supabase
      .from('compras_proveedor')
      .select('total, kg_alimento, proveedor:proveedores(tipo)')
      .gte('fecha', inicio)
      .lte('fecha', fin),
    supabase
      .from('caja')
      .select('categoria, monto')
      .eq('tipo', 'EGRESO')
      .gte('fecha', inicio)
      .lte('fecha', fin),
    supabase
      .from('produccion_diaria')
      .select('huevos')
      .gte('fecha', inicio)
      .lte('fecha', fin),
    supabase.from('gallinas_actuales').select('gallinas_actuales'),
    supabase.from('config_costos').select('*').limit(1).single(),
    supabase.from('productos').select('id, codigo, nombre, precio_mayorista, precio_minorista, unidades_por_caja').eq('activo', true).order('codigo'),
    supabase
      .from('ventas')
      .select('tipo_venta, cantidad, monto_cobrado, equivalente_huevos')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .neq('estado', 'PENDIENTE'),
  ])

  // Alimento devengado del período (compras a proveedor de alimento)
  const comprasAlimento = (comprasRaw ?? []).filter((c: any) => c.proveedor?.tipo === 'alimento')
  const alimentoDevengado = comprasAlimento.reduce((s: number, c: any) => s + c.total, 0)
  const kgAlimentoCargado = comprasAlimento.reduce((s: number, c: any) => s + (c.kg_alimento ?? 0), 0)

  // Egresos por categoría
  const egresos = egresosRaw ?? []
  const sumaCat = (cat: string) => egresos.filter((e: any) => e.categoria === cat).reduce((s: number, e: any) => s + e.monto, 0)

  // Producción total
  const huevosTotales = (produccionRaw ?? []).reduce((s: number, p: any) => s + p.huevos, 0)

  // Gallinas activas
  const gallinasActivas = (gallinasRaw ?? []).reduce((s: number, g: any) => s + (g.gallinas_actuales ?? 0), 0)

  // Config
  const config = configRaw ?? { costo_recria_por_ave: 3000, vida_util_semanas: 75 }

  // Consumo estimado para el período (días entre inicio y fin)
  const diasPeriodo = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1
  const semanasPeriodo = diasPeriodo / 7
  const kgEstimados = gallinasActivas * 0.13 * diasPeriodo

  // Amortización aves
  const amortizacionAves =
    gallinasActivas * (config.costo_recria_por_ave / config.vida_util_semanas) * semanasPeriodo

  // Ventas por tipo para precio promedio
  const ventasPorTipo: Record<string, { monto: number; huevos: number }> = {}
  for (const v of ventasRaw ?? []) {
    if (!ventasPorTipo[v.tipo_venta]) ventasPorTipo[v.tipo_venta] = { monto: 0, huevos: 0 }
    ventasPorTipo[v.tipo_venta].monto += v.monto_cobrado ?? 0
    ventasPorTipo[v.tipo_venta].huevos += v.equivalente_huevos ?? 0
  }

  return (
    <CostosClient
      periodos={periodos}
      periodoInicio={inicio}
      periodoLabel={label}
      alimentoDevengado={alimentoDevengado}
      kgAlimentoCargado={kgAlimentoCargado}
      kgEstimados={kgEstimados}
      sueldos={sumaCat('Sueldos')}
      maples={sumaCat('Maples')}
      mantenimiento={sumaCat('Mantenimiento')}
      combustible={sumaCat('Combustible')}
      gastosGenerales={sumaCat('Gastos generales')}
      sanidad={sumaCat('Sanidad') + sumaCat('Medicación')}
      amortizacionAves={amortizacionAves}
      huevosTotales={huevosTotales}
      gallinasActivas={gallinasActivas}
      diasPeriodo={diasPeriodo}
      productos={productos ?? []}
      ventasPorTipo={ventasPorTipo}
      config={config}
    />
  )
}
