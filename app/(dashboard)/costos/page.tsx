import { createClient } from '@/lib/supabase/server'
import CostosClient from './CostosClient'
import { getPeriodoInfo, getPeriodoAnterior, hoyISO } from '@/lib/utils'
import { calcularGallinasPorTipo, calcularCostoProyectado, calcularCostoReal } from '@/lib/costos/calcular'
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
  const { blancas: gallinasBlancas, coloradas: gallinasColoradas } = calcularGallinasPorTipo(galpones, gallinasData)
  const gallinasActivas = gallinasBlancas + gallinasColoradas

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

    const huevosAnt = (prodAnt ?? []).reduce((s: number, p: any) => s + p.huevos, 0)

    if (huevosAnt > 0) {
      const diasAnt =
        Math.round(
          (new Date(periodoAnterior.fin).getTime() - new Date(periodoAnterior.inicio).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1

      const real = calcularCostoReal({
        egresosCaja: cajasAnt ?? [],
        comprasProveedor: (comprasAnt ?? []) as any,
        huevosProducidos: huevosAnt,
        gallinasActivas,
        config,
        diasPeriodo: diasAnt,
      })

      const payload = {
        periodo_inicio: periodoAnterior.inicio,
        periodo_fin: periodoAnterior.fin,
        dias_periodo: diasAnt,
        gallinas_promedio: gallinasActivas,
        ...real,
      }

      const { data: insertado } = await supabase
        .from('historico_costos_periodo')
        .insert(payload)
        .select()
        .single()

      historico = insertado
    }
  }

  // ── Modo 1: Estándar (30 días) ────────────────────────────────────────────
  const estandarCalc = calcularCostoProyectado(config, gallinasBlancas, gallinasColoradas, 30, 30)

  // ── Modo 3: Running (día actual del período) ──────────────────────────────
  const N = periodoInfo.diaActual
  const diasTotales = periodoInfo.diasTotales
  const runningCalc = calcularCostoProyectado(config, gallinasBlancas, gallinasColoradas, N, diasTotales)
  const cajonesProducidos = (prodActualRaw ?? []).reduce((s: number, p: any) => s + p.huevos, 0) / 360

  // Alerta alimento: kg comprados vs estimado en el período actual
  const kgCompradosActual = (comprasAlimentoActualRaw ?? [])
    .filter((c: any) => c.proveedor?.tipo === 'alimento')
    .reduce((s: number, c: any) => s + (c.kg_alimento ?? 0), 0)
  const alimentoDiarioKgActual =
    (gallinasColoradas * config.consumo_coloradas_g_dia) / 1000 + (gallinasBlancas * config.consumo_blancas_g_dia) / 1000
  const kgEstimadoActual = alimentoDiarioKgActual * N

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
        alimento: estandarCalc.alimento,
        amortizacion: estandarCalc.amortizacion,
        sueldos: config.sueldos_mensuales,
        maples: config.maples_mensuales,
        otros: config.otros_gastos_mensuales,
        costoTotal: estandarCalc.costoTotal,
        cajonesEsperados: estandarCalc.cajonesEsperados,
        costoPorCajon: estandarCalc.costoPorCajon,
      }}
      historico={historico}
      running={{
        alimento: runningCalc.alimento,
        sueldos: runningCalc.sueldos,
        maples: runningCalc.maples,
        otros: runningCalc.otros,
        amortizacion: runningCalc.amortizacion,
        costoTotal: runningCalc.costoTotal,
        cajonesProducidos,
        costoPorCajon: cajonesProducidos > 0 ? runningCalc.costoTotal / cajonesProducidos : 0,
      }}
      kgCompradosActual={kgCompradosActual}
      kgEstimadoActual={kgEstimadoActual}
      productos={productos ?? []}
    />
  )
}
