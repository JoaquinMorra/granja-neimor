'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatearPeso } from '@/lib/utils'
import { Settings, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ConfigCostos, HistoricoCostoPeriodo } from '@/types'


type ProductoMin = {
  id: string; codigo: string; nombre: string
  precio_mayorista: number; precio_minorista: number; unidades_por_caja: number
}

type EstandarData = {
  alimento: number; amortizacion: number; sueldos: number; maples: number; otros: number
  costoTotal: number; cajonesEsperados: number; costoPorCajon: number
}

type RunningData = {
  alimento: number; sueldos: number; maples: number; otros: number; amortizacion: number
  costoTotal: number; cajonesProducidos: number; costoPorCajon: number
}

type Props = {
  periodoInfo: { inicio: string; fin: string; label: string; diaActual: number; diasTotales: number }
  periodoAnterior: { inicio: string; fin: string; label: string }
  config: ConfigCostos
  configCompleta: boolean
  gallinasBlancas: number
  gallinasColoradas: number
  gallinasActivas: number
  estandar: EstandarData
  historico: HistoricoCostoPeriodo | null
  running: RunningData
  kgCompradosActual: number
  kgEstimadoActual: number
  productos: ProductoMin[]
}

function desvioPct(valor: number, referencia: number): number {
  if (referencia === 0) return 0
  return ((valor - referencia) / referencia) * 100
}

function DesvioTag({ pct }: { pct: number }) {
  if (pct === 0) return null
  const abs = Math.abs(pct)
  const positivo = pct > 0
  const alerta = abs > 10
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
      alerta
        ? 'bg-red-100 text-red-700'
        : positivo
          ? 'bg-amber-50 text-amber-700'
          : 'bg-green-50 text-green-700'
    }`}>
      {positivo ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

const CATEGORIAS = [
  { key: 'alimento',     label: 'Alimento',          histKey: 'alimento_real' },
  { key: 'sueldos',      label: 'Sueldos',           histKey: 'sueldos_real' },
  { key: 'maples',       label: 'Maples',            histKey: 'maples_real' },
  { key: 'otros',        label: 'Otros gastos',      histKey: 'otros_real' },
  { key: 'amortizacion', label: 'Amortización aves', histKey: 'amortizacion_real' },
] as const

export default function CostosClient({
  periodoInfo, periodoAnterior, config, configCompleta,
  gallinasBlancas, gallinasColoradas, gallinasActivas,
  estandar, historico, running,
  kgCompradosActual, kgEstimadoActual,
  productos,
}: Props) {
  const [drilldown, setDrilldown] = useState<'estandar' | 'historico' | 'running' | null>(null)

  const desvioHistorico = historico ? desvioPct(historico.costo_por_cajon, estandar.costoPorCajon) : 0
  const desvioRunning = desvioPct(running.costoPorCajon, estandar.costoPorCajon)
  const alertaRunning = Math.abs(desvioRunning) > 10 && running.cajonesProducidos > 0

  const alertaAlimento =
    kgCompradosActual > 0 && kgEstimadoActual > 0 &&
    (kgCompradosActual < kgEstimadoActual * 0.8 || kgCompradosActual > kgEstimadoActual * 1.2)

  // Costo por cajón para margen SKU usa el estándar
  const costoPorHuevoEstandar = estandar.cajonesEsperados > 0
    ? estandar.costoPorCajon / 360
    : 0

  function toggleDrilldown(mode: 'estandar' | 'historico' | 'running') {
    setDrilldown((prev) => prev === mode ? null : mode)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Costo del huevo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Período actual: {periodoInfo.label} · día {periodoInfo.diaActual} de {periodoInfo.diasTotales}
          </p>
        </div>
        <Link href="/costos/configuracion" className="btn-secondary flex items-center gap-1.5 text-sm">
          <Settings size={15} /> Configuración
        </Link>
      </div>

      {/* Estado: sin configuración */}
      {!configCompleta && (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">Faltan parámetros de configuración</p>
          <p className="text-sm text-slate-500 mb-5">
            Para calcular los costos necesitás cargar el precio del kg de alimento y los presupuestos mensuales.
          </p>
          <Link href="/costos/configuracion" className="btn-primary inline-flex items-center gap-2">
            <Settings size={16} /> Configurar parámetros
          </Link>
        </div>
      )}

      {configCompleta && (
        <>
          {/* Alerta alimento */}
          {alertaAlimento && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-amber-800">
                Se cargaron <strong>{kgCompradosActual.toFixed(0)} kg</strong> de alimento en el período actual,
                pero el consumo estimado va por <strong>{kgEstimadoActual.toFixed(0)} kg</strong>.
                Revisá si hay compras adelantadas o sin cargar en Proveedores.
              </p>
            </div>
          )}

          {/* 3 Cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Modo 1: Estándar */}
            <button
              onClick={() => toggleDrilldown('estandar')}
              className={`card p-5 text-left border-l-4 border-l-slate-400 hover:bg-slate-50 transition-colors ${drilldown === 'estandar' ? 'ring-2 ring-slate-300' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Referencia</p>
                {drilldown === 'estandar' ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {estandar.costoPorCajon > 0 ? formatearPeso(estandar.costoPorCajon) : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">/cajón</p>
              <p className="text-xs text-slate-400 mt-2">Basado en parámetros configurados</p>
            </button>

            {/* Modo 2: Último período cerrado */}
            <button
              onClick={() => historico && toggleDrilldown('historico')}
              className={`card p-5 text-left border-l-4 border-l-purple-400 transition-colors ${
                historico ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
              } ${drilldown === 'historico' ? 'ring-2 ring-purple-200' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Último período</p>
                {historico
                  ? drilldown === 'historico'
                    ? <ChevronUp size={14} className="text-slate-400" />
                    : <ChevronDown size={14} className="text-slate-400" />
                  : null}
              </div>
              {historico ? (
                <>
                  <p className="text-3xl font-bold text-purple-800">{formatearPeso(historico.costo_por_cajon)}</p>
                  <p className="text-xs text-slate-500 mt-1">/cajón</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-slate-400">{periodoAnterior.label}</p>
                    <DesvioTag pct={desvioHistorico} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-300">—</p>
                  <p className="text-xs text-slate-400 mt-2">Sin datos aún</p>
                  <p className="text-xs text-slate-400">Se calculará al cerrar el período</p>
                </>
              )}
            </button>

            {/* Modo 3: Running */}
            <button
              onClick={() => toggleDrilldown('running')}
              className={`card p-5 text-left border-l-4 ${alertaRunning ? 'border-l-red-400' : 'border-l-amber-400'} hover:bg-slate-50 transition-colors ${drilldown === 'running' ? 'ring-2 ring-amber-200' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período actual</p>
                {drilldown === 'running' ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </div>
              {running.cajonesProducidos > 0 ? (
                <>
                  <p className={`text-3xl font-bold ${alertaRunning ? 'text-red-700' : 'text-amber-800'}`}>
                    {formatearPeso(running.costoPorCajon)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">/cajón</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-slate-400">
                      día {periodoInfo.diaActual}/{periodoInfo.diasTotales}
                    </p>
                    <DesvioTag pct={desvioRunning} />
                    {alertaRunning && <AlertTriangle size={12} className="text-red-500" />}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-300">—</p>
                  <p className="text-xs text-slate-400 mt-2">Sin producción registrada aún</p>
                </>
              )}
            </button>
          </div>

          {/* Drill-down: Estándar */}
          {drilldown === 'estandar' && (
            <div className="card p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-3">Desglose estándar (base: 30 días)</h3>
              <div className="text-xs text-slate-500 mb-3">
                {gallinasColoradas.toLocaleString('es-AR')} coloradas × {config.consumo_coloradas_g_dia}g +{' '}
                {gallinasBlancas.toLocaleString('es-AR')} blancas × {config.consumo_blancas_g_dia}g ={' '}
                {(estandar.alimento / config.precio_kg_alimento / 30).toFixed(0)} kg/día ×{' '}
                {formatearPeso(config.precio_kg_alimento)}/kg
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  <tr><td className="py-1.5 text-slate-600">Alimento</td><td className="py-1.5 text-right font-semibold">{formatearPeso(estandar.alimento)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Sueldos</td><td className="py-1.5 text-right font-semibold">{formatearPeso(estandar.sueldos)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Maples</td><td className="py-1.5 text-right font-semibold">{formatearPeso(estandar.maples)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Otros gastos</td><td className="py-1.5 text-right font-semibold">{formatearPeso(estandar.otros)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Amortización aves</td><td className="py-1.5 text-right font-semibold">{formatearPeso(estandar.amortizacion)}</td></tr>
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-bold text-slate-800">Total</td>
                    <td className="py-2 text-right font-bold text-slate-800">{formatearPeso(estandar.costoTotal)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-3">
                Cajones esperados: {estandar.cajonesEsperados.toFixed(1)} ({gallinasActivas.toLocaleString('es-AR')} gallinas × {config.postura_esperada_pct}% × 30 días / 360)
              </p>
            </div>
          )}

          {/* Drill-down: Histórico */}
          {drilldown === 'historico' && historico && (
            <div className="card p-5 border border-purple-100">
              <h3 className="font-semibold text-slate-800 mb-1">Desglose real — {periodoAnterior.label}</h3>
              <p className="text-xs text-slate-500 mb-3">
                {historico.gallinas_promedio.toLocaleString('es-AR')} gallinas · {historico.dias_periodo} días · {historico.cajones_reales.toFixed(1)} cajones producidos
              </p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  <tr><td className="py-1.5 text-slate-600">Alimento (compras proveedor)</td><td className="py-1.5 text-right font-semibold">{formatearPeso(historico.alimento_real)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Sueldos</td><td className="py-1.5 text-right font-semibold">{formatearPeso(historico.sueldos_real)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Maples</td><td className="py-1.5 text-right font-semibold">{formatearPeso(historico.maples_real)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Otros gastos</td><td className="py-1.5 text-right font-semibold">{formatearPeso(historico.otros_real)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Amortización aves</td><td className="py-1.5 text-right font-semibold">{formatearPeso(historico.amortizacion_real)}</td></tr>
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-bold text-slate-800">Total</td>
                    <td className="py-2 text-right font-bold text-slate-800">{formatearPeso(historico.costo_total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Drill-down: Running */}
          {drilldown === 'running' && (
            <div className="card p-5 border border-amber-100">
              <h3 className="font-semibold text-slate-800 mb-1">Desglose running — día {periodoInfo.diaActual} de {periodoInfo.diasTotales}</h3>
              <p className="text-xs text-slate-500 mb-3">
                Costos proporcionales al avance del período · {running.cajonesProducidos.toFixed(1)} cajones producidos hasta hoy
              </p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  <tr><td className="py-1.5 text-slate-600">Alimento (estimado)</td><td className="py-1.5 text-right font-semibold">{formatearPeso(running.alimento)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Sueldos devengados</td><td className="py-1.5 text-right font-semibold">{formatearPeso(running.sueldos)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Maples devengados</td><td className="py-1.5 text-right font-semibold">{formatearPeso(running.maples)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Otros devengados</td><td className="py-1.5 text-right font-semibold">{formatearPeso(running.otros)}</td></tr>
                  <tr><td className="py-1.5 text-slate-600">Amortización aves</td><td className="py-1.5 text-right font-semibold">{formatearPeso(running.amortizacion)}</td></tr>
                  <tr className="border-t border-slate-200">
                    <td className="py-2 font-bold text-slate-800">Total</td>
                    <td className="py-2 text-right font-bold text-slate-800">{formatearPeso(running.costoTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tabla comparativa por categoría */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Detalle por categoría</h3>
              <p className="text-xs text-slate-500 mt-0.5">Costo por cajón en cada modo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="table-th">Categoría</th>
                    <th className="table-th text-right">Estándar/cajón</th>
                    <th className="table-th text-right">Último período/cajón</th>
                    <th className="table-th text-right">Running/cajón</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {CATEGORIAS.map(({ key, label, histKey }) => {
                    const est = estandar.cajonesEsperados > 0 ? (estandar as any)[key] / estandar.cajonesEsperados : 0
                    const hist = historico && historico.cajones_reales > 0 ? (historico as any)[histKey] / historico.cajones_reales : null
                    const run = running.cajonesProducidos > 0 ? (running as any)[key] / running.cajonesProducidos : null
                    const alertaFila = run !== null && est > 0 && run > est * 1.10
                    return (
                      <tr key={key} className={`hover:bg-slate-50 ${alertaFila ? 'bg-red-50' : ''}`}>
                        <td className="table-td font-medium">{label}</td>
                        <td className="table-td text-right text-slate-600">{est > 0 ? formatearPeso(est) : '—'}</td>
                        <td className="table-td text-right text-slate-600">
                          {hist !== null ? formatearPeso(hist) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="table-td text-right">
                          {run !== null ? (
                            <span className={alertaFila ? 'font-bold text-red-700' : 'text-slate-600'}>
                              {formatearPeso(run)}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                    <td className="table-td text-slate-900">Total</td>
                    <td className="table-td text-right text-slate-900">
                      {estandar.costoPorCajon > 0 ? formatearPeso(estandar.costoPorCajon) : '—'}
                    </td>
                    <td className="table-td text-right text-slate-900">
                      {historico ? formatearPeso(historico.costo_por_cajon) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td text-right text-slate-900">
                      {running.costoPorCajon > 0 ? formatearPeso(running.costoPorCajon) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Margen por SKU */}
          {productos.length > 0 && costoPorHuevoEstandar > 0 && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Margen por SKU</h3>
                <p className="text-xs text-slate-500 mt-0.5">Precio mayorista del catálogo vs costo estándar</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="table-th">SKU</th>
                      <th className="table-th text-right">Unidades</th>
                      <th className="table-th text-right">Costo est.</th>
                      <th className="table-th text-right">Precio venta</th>
                      <th className="table-th text-right">Margen $</th>
                      <th className="table-th text-right">Margen %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productos.map((prod) => {
                      const costoUnitario = costoPorHuevoEstandar * prod.unidades_por_caja
                      const margenMonto = prod.precio_mayorista - costoUnitario
                      const margenPct = prod.precio_mayorista > 0 ? (margenMonto / prod.precio_mayorista) * 100 : 0
                      const negativo = margenMonto < 0

                      return (
                        <tr key={prod.id} className={`hover:bg-slate-50 ${negativo ? 'bg-red-50' : ''}`}>
                          <td className="table-td">
                            <p className="font-mono text-xs font-semibold">{prod.codigo}</p>
                            <p className="text-xs text-slate-500">{prod.nombre}</p>
                          </td>
                          <td className="table-td text-right text-sm">{prod.unidades_por_caja}</td>
                          <td className="table-td text-right font-semibold">{formatearPeso(costoUnitario)}</td>
                          <td className="table-td text-right font-semibold">{formatearPeso(prod.precio_mayorista)}</td>
                          <td className={`table-td text-right font-bold ${negativo ? 'text-red-700' : 'text-green-700'}`}>
                            {formatearPeso(margenMonto)}
                          </td>
                          <td className={`table-td text-right font-bold ${negativo ? 'text-red-700' : 'text-green-700'}`}>
                            {margenPct.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
