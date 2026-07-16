// Cálculos de costo de producción, extraídos de app/(dashboard)/costos/page.tsx
// para poder reusarlos también desde el módulo de Cierre de Mes.

type ConfigCostosInput = {
  consumo_coloradas_g_dia: number
  consumo_blancas_g_dia: number
  precio_kg_alimento: number
  costo_recria_por_ave: number
  vida_util_semanas: number
  sueldos_mensuales: number
  maples_mensuales: number
  otros_gastos_mensuales: number
  postura_esperada_pct: number
}

// Categorías de caja que NO forman parte de "otros" operativos
// (ya se contabilizan aparte, o no son costo de producción).
export const EXCLUIR_OTROS = new Set([
  'Sueldos',
  'Maples',
  'Alimento',
  'Compra-venta mercado',
  'Compra USD',
  'Pago inversión',
])

export function calcularGallinasPorTipo(
  galpones: { id: string; tipo: string }[],
  gallinasActuales: { galpon_id: string; gallinas_actuales: number | null }[]
): { blancas: number; coloradas: number } {
  return galpones.reduce(
    (acc, g) => {
      const total = gallinasActuales
        .filter((ga) => ga.galpon_id === g.id)
        .reduce((s, ga) => s + (ga.gallinas_actuales ?? 0), 0)
      if (g.tipo === 'blancas') acc.blancas += total
      else if (g.tipo === 'coloradas') acc.coloradas += total
      return acc
    },
    { blancas: 0, coloradas: 0 }
  )
}

function alimentoDiarioKg(config: ConfigCostosInput, gallinasBlancas: number, gallinasColoradas: number): number {
  return (
    (gallinasColoradas * config.consumo_coloradas_g_dia) / 1000 +
    (gallinasBlancas * config.consumo_blancas_g_dia) / 1000
  )
}

export type CostoProyectado = {
  alimento: number
  sueldos: number
  maples: number
  otros: number
  amortizacion: number
  costoTotal: number
  cajonesEsperados: number
  costoPorCajon: number
}

/**
 * Proyección de costo para N días de un período de `diasTotales` días
 * (el modo "Estándar" de /costos usa N = diasTotales = 30;
 * el modo "Running" usa N = día actual, diasTotales = días del período).
 */
export function calcularCostoProyectado(
  config: ConfigCostosInput,
  gallinasBlancas: number,
  gallinasColoradas: number,
  dias: number,
  diasTotales: number
): CostoProyectado {
  const gallinasActivas = gallinasBlancas + gallinasColoradas
  const alimento = alimentoDiarioKg(config, gallinasBlancas, gallinasColoradas) * dias * config.precio_kg_alimento
  const fraccion = diasTotales > 0 ? dias / diasTotales : 0
  const sueldos = config.sueldos_mensuales * fraccion
  const maples = config.maples_mensuales * fraccion
  const otros = config.otros_gastos_mensuales * fraccion
  const amortizacion = gallinasActivas * (config.costo_recria_por_ave / (config.vida_util_semanas * 7)) * dias
  const costoTotal = alimento + sueldos + maples + otros + amortizacion
  const cajonesEsperados =
    gallinasActivas > 0 ? (gallinasActivas * (config.postura_esperada_pct / 100) * dias) / 360 : 0

  return {
    alimento,
    sueldos,
    maples,
    otros,
    amortizacion,
    costoTotal,
    cajonesEsperados,
    costoPorCajon: cajonesEsperados > 0 ? costoTotal / cajonesEsperados : 0,
  }
}

export type CostoReal = {
  alimento_real: number
  sueldos_real: number
  maples_real: number
  otros_real: number
  amortizacion_real: number
  costo_total: number
  cajones_reales: number
  costo_por_cajon: number
}

/**
 * Costo real de un período ya transcurrido, a partir de movimientos
 * efectivamente cargados (caja, compras a proveedores, producción).
 */
export function calcularCostoReal(params: {
  egresosCaja: { categoria: string; monto: number }[]
  comprasProveedor: { total: number; proveedor: { tipo: string } | { tipo: string }[] | null }[]
  huevosProducidos: number
  gallinasActivas: number
  config: ConfigCostosInput
  diasPeriodo: number
}): CostoReal {
  const { egresosCaja, comprasProveedor, huevosProducidos, gallinasActivas, config, diasPeriodo } = params

  const tipoProveedor = (p: { tipo: string } | { tipo: string }[] | null): string | undefined =>
    Array.isArray(p) ? p[0]?.tipo : p?.tipo

  const alimento_real = comprasProveedor
    .filter((c) => tipoProveedor(c.proveedor) === 'alimento')
    .reduce((s, c) => s + (c.total ?? 0), 0)

  const sumCat = (cat: string) =>
    egresosCaja.filter((e) => e.categoria === cat).reduce((s, e) => s + (e.monto ?? 0), 0)

  const sueldos_real = sumCat('Sueldos')
  const maples_real = sumCat('Maples')
  const otros_real = egresosCaja
    .filter((e) => !EXCLUIR_OTROS.has(e.categoria))
    .reduce((s, e) => s + (e.monto ?? 0), 0)
  const amortizacion_real =
    gallinasActivas * (config.costo_recria_por_ave / (config.vida_util_semanas * 7)) * diasPeriodo
  const costo_total = alimento_real + sueldos_real + maples_real + otros_real + amortizacion_real
  const cajones_reales = huevosProducidos / 360

  return {
    alimento_real,
    sueldos_real,
    maples_real,
    otros_real,
    amortizacion_real,
    costo_total,
    cajones_reales,
    costo_por_cajon: cajones_reales > 0 ? costo_total / cajones_reales : 0,
  }
}
