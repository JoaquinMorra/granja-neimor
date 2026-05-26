import { createClient } from '@/lib/supabase/server'
import CostosClient from './CostosClient'
import { getPeriodoInfo, getPeriodoAnterior, hoyISO } from '@/lib/utils'
import type { HistoricoCostoPeriodo } from '@/types'

const CONFIG_DEFAULT = {
  id: '',
  costo_recria_por_ave: 0,
  vida_util_semanas: 75,
  precio_kg_alimento: 0,
  consumo_coloradas_g_dia: 120,
  consumo_blancas_g_dia: 113,
  sueldos_mensuales: 0,
  maples_mensuales: 0,
  otros_gastos_mensuales: 0,
  postura_esperada_pct: 70,
  updated_at: '',
}

// Categorías que NO forman parte de "otros" operativos en caja
const EXCLUIR_OTROS = new Set(['Sueldos', 'Maples', 'Alimento', 'Compra-venta mercado', 'Compra USD', 'Pago inversión'])

export default async function CostosPage() {
  const supabase = await createClient()

  // Config primero (necesaria para auto-cierre)
  const { data: configRaw } = await supabase.from('config_costos').select('*').limit(1).single()
  const config = { ...CONFIG_DEFAULT, ...(configRaw ?? {}) }

  const periodoInfo = getPeriodoInfo()
  const periodoAnterior = getPeriodoAnterior()
  const hoy = hoyISO()

  // Queries paralelas
  const [
    { data: gallinasRaw },
    { data: galponesRaw },
    { data: historicoRaw },
    { data: prodActualRaw },
    { data: comprasAlimentoActualRaw },
    { data: productos },
  ] = await Promise.all([
    supabase.from('gallinas_actuales').select('galpon_id, gallinas_actuales'),
    supabase.from('galpones').select('id, tipo'),
    supabase
      .from('historico_costos_periodo')
      .select('*')
      .eq('periodo_inicio', periodoAnterior.inicio)
      .maybeSingle(),
    supabase
      .from('produccion_diaria')
      .select('huevos')
      .gte('fecha', periodoInfo.inicio)
      .lte('fecha', hoy),
    supabase
      .from('compras_proveedor')
      .select('kg_alimento, proveedor:proveedores(tipo)')
      .gte('fecha', periodoInfo.inicio)
      .lte('fecha', hoy),
    supabase
      .from('productos')
      .select('id, codigo, nombre, precio_mayorista, precio_minorista, unidades_por_caja')
      .eq('activo', true)
      .order('codigo'),
  ])

  // Gallinas por tipo
  const galpones = galponesRaw ?? []
  const gallinasData = gallinasRaw ?? []
  const gallonasPorTipo = galpones.reduce(
    (acc: { blancas: number; coloradas: number }, g: any) => {
      const total = gallinasData
        .filter((ga: any) => ga.galpon_id === g.id)
        .reduce((s: number, ga: any) => s + (ga.gallinas_actuales ?? 0), 0)
      if (g.tipo === 'blancas') acc.blancas += total
      else if (g.tipo === 'coloradas') acc.coloradas += total
      return acc
    },
    { blancas: 0, coloradas: 0 }
  )
  const gallinasBlancas = gallonasPorTipo.blancas
  const gallinasColoradas = gallonasPorTipo.coloradas
  const gallinasActivas = gallinasBlancas + gallinasColoradas

  // Consumo diario de alimento (kg)
  const alimentoDiarioKg =
    (gallinasColoradas * config.consumo_coloradas_g_dia) / 1000 +
    (gallinasBlancas * config.consumo_blancas_g_dia) / 1000

  // Auto-cierre del período anterior si no está en historico
  let historico: HistoricoCostoPeriodo | null = historicoRaw ?? null

  if (!historico) {
    const [{ data: cajasAnt }, { data: comprasAnt }, { data: prodAnt }] = await Promise.all([
      supabase
        .from('caja')
        .select('categoria, monto')
        .eq('tipo', 'EGRESO')
        .gte('fecha', periodoAnterior.inicio)
        .lte('fecha', periodoAnterior.fin),
      supabase
        .from('compras_proveedor')
        .select('total, proveedor:proveedores(tipo)')
        .gte('fecha', periodoAnterior.inicio)
        .lte('fecha', periodoAnterior.fin),
      supabase
        .from('produccion_diaria')
        .select('huevos')
        .gte('fecha', periodoAnterior.inicio)
        .lte('fecha', periodoAnterior.fin),
    ])

    const cajonesReales = (prodAnt ?? []).reduce((s: number, p: any) => s + p.huevos, 0) / 360

    if (cajonesReales > 0) {
      const diasAnt =
        Math.round(
          (new Date(periodoAnterior.fin).getTime() - new Date(periodoAnterior.inicio).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1

      const alimento_real = (comprasAnt ?? [])
        .filter((c: any) => c.proveedor?.tipo === 'alimento')
        .reduce((s: number, c: any) => s + (c.total ?? 0), 0)

      const egresos = cajasAnt ?? []
      const sumCat = (cat: string) =>
        egresos.filter((e: any) => e.categoria === cat).reduce((s: number, e: any) => s + (e.monto ?? 0), 0)
      const sueldos_real = sumCat('Sueldos')
      const maples_real = sumCat('Maples')
      const otros_real = egresos
        .filter((e: any) => !EXCLUIR_OTROS.has(e.categoria))
        .reduce((s: number, e: any) => s + (e.monto ?? 0), 0)
      const amortizacion_real =
        gallinasActivas * (config.costo_recria_por_ave / (config.vida_util_semanas * 7)) * diasAnt
      const costo_total = alimento_real + sueldos_real + maples_real + otros_real + amortizacion_real

      const payload = {
        periodo_inicio: periodoAnterior.inicio,
        periodo_fin: periodoAnterior.fin,
        dias_periodo: diasAnt,
        gallinas_promedio: gallinasActivas,
        alimento_real,
        sueldos_real,
        maples_real,
        otros_real,
        amortizacion_real,
        costo_total,
        cajones_reales: cajonesReales,
        costo_por_cajon: costo_total / cajonesReales,
      }

      const { data: insertado } = await supabase
        .from('historico_costos_periodo')
        .insert(payload)
        .select()
        .single()

      historico = insertado
    }
  }

  // ── Modo 1: Estándar ──────────────────────────────────────────────────────
  const alimentoEstandar = alimentoDiarioKg * 30 * config.precio_kg_alimento
  const amortizacionEstandar =
    gallinasActivas * (config.costo_recria_por_ave / (config.vida_util_semanas * 7)) * 30
  const costoTotalEstandar =
    alimentoEstandar +
    amortizacionEstandar +
    config.sueldos_mensuales +
    config.maples_mensuales +
    config.otros_gastos_mensuales
  const cajonesEsperados =
    gallinasActivas > 0
      ? (gallinasActivas * (config.postura_esperada_pct / 100) * 30) / 360
      : 0

  // ── Modo 3: Running ───────────────────────────────────────────────────────
  const N = periodoInfo.diaActual
  const diasTotales = periodoInfo.diasTotales
  const alimentoRunning = alimentoDiarioKg * N * config.precio_kg_alimento
  const sueldosRunning = config.sueldos_mensuales * (N / diasTotales)
  const maplesRunning = config.maples_mensuales * (N / diasTotales)
  const otrosRunning = config.otros_gastos_mensuales * (N / diasTotales)
  const amortizacionRunning =
    gallinasActivas * (config.costo_recria_por_ave / (config.vida_util_semanas * 7)) * N
  const costoTotalRunning = alimentoRunning + sueldosRunning + maplesRunning + otrosRunning + amortizacionRunning
  const cajonesProducidos = (prodActualRaw ?? []).reduce((s: number, p: any) => s + p.huevos, 0) / 360

  // Alerta alimento: kg comprados vs estimado en el período actual
  const kgCompradosActual = (comprasAlimentoActualRaw ?? [])
    .filter((c: any) => c.proveedor?.tipo === 'alimento')
    .reduce((s: number, c: any) => s + (c.kg_alimento ?? 0), 0)
  const kgEstimadoActual = alimentoDiarioKg * N

  const configCompleta = config.precio_kg_alimento > 0

  return (
    <CostosClient
      periodoInfo={{ inicio: periodoInfo.inicio, fin: periodoInfo.fin, label: periodoInfo.label, diaActual: N, diasTotales }}
      periodoAnterior={periodoAnterior}
      config={config}
      configCompleta={configCompleta}
      gallinasBlancas={gallinasBlancas}
      gallinasColoradas={gallinasColoradas}
      gallinasActivas={gallinasActivas}
      estandar={{
        alimento: alimentoEstandar,
        amortizacion: amortizacionEstandar,
        sueldos: config.sueldos_mensuales,
        maples: config.maples_mensuales,
        otros: config.otros_gastos_mensuales,
        costoTotal: costoTotalEstandar,
        cajonesEsperados,
        costoPorCajon: cajonesEsperados > 0 ? costoTotalEstandar / cajonesEsperados : 0,
      }}
      historico={historico}
      running={{
        alimento: alimentoRunning,
        sueldos: sueldosRunning,
        maples: maplesRunning,
        otros: otrosRunning,
        amortizacion: amortizacionRunning,
        costoTotal: costoTotalRunning,
        cajonesProducidos,
        costoPorCajon: cajonesProducidos > 0 ? costoTotalRunning / cajonesProducidos : 0,
      }}
      kgCompradosActual={kgCompradosActual}
      kgEstimadoActual={kgEstimadoActual}
      productos={productos ?? []}
    />
  )
}
