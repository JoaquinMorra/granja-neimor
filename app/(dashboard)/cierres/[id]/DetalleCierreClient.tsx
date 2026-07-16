'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatearPeso, formatearFecha, nombreMes } from '@/lib/utils'
import type { CierreMensual } from '@/types'
import { regenerarPdfCierre } from '@/lib/cierres/regenerar-pdf'
import type {
  VentaCerradaRow as VentaRow,
  EgresoCajaCerradoRow as EgresoRow,
  CompraProveedorCerradaRow as CompraRow,
  ProduccionCerradaRow as ProduccionRow,
} from '@/lib/cierres/obtener-detalle-cierre'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react'

type Rel = { nombre: string } | { nombre: string }[] | null

function nombreRel(r: Rel): string {
  return (Array.isArray(r) ? r[0]?.nombre : r?.nombre) ?? '—'
}

type CierreAnterior = {
  anio: number
  mes: number
  total_ventas: number
  total_egresos_caja: number
  total_huevos: number
  ganancia_neta: number
}

type Props = {
  cierre: CierreMensual
  ventas: VentaRow[]
  egresosCaja: EgresoRow[]
  comprasProveedor: CompraRow[]
  produccion: ProduccionRow[]
  cierreAnterior: CierreAnterior | null
}

type Seccion = 'ventas' | 'gastos' | 'produccion' | 'costos'

function desvioPct(actual: number, anterior: number | null | undefined): number | null {
  if (anterior === null || anterior === undefined || anterior === 0) return null
  return ((actual - anterior) / anterior) * 100
}

function PctTag({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-300">—</span>
  const positivo = pct > 0
  return (
    <span className={`text-xs font-semibold ${positivo ? 'text-green-700' : pct < 0 ? 'text-red-700' : 'text-slate-500'}`}>
      {positivo ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function galponDeLote(l: ProduccionRow['lote']): string {
  const lote = Array.isArray(l) ? l[0] : l
  return nombreRel(lote?.galpon ?? null)
}

export default function DetalleCierreClient({ cierre, ventas, egresosCaja, comprasProveedor, produccion, cierreAnterior }: Props) {
  const [seccionAbierta, setSeccionAbierta] = useState<Seccion | null>(null)
  function toggleSeccion(s: Seccion) {
    setSeccionAbierta((prev) => (prev === s ? null : s))
  }

  const [regenerando, setRegenerando] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  const [pdfListo, setPdfListo] = useState(!!cierre.pdf_path)

  async function handleRegenerar() {
    setRegenerando(true)
    setErrorPdf(null)
    const resultado = await regenerarPdfCierre(cierre.id)
    if ('error' in resultado) {
      setErrorPdf(resultado.error)
    } else {
      setPdfListo(true)
    }
    setRegenerando(false)
  }

  const d = cierre.detalle ?? {}
  const costoReal = d.costo_produccion_real

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/cierres" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
            <ArrowLeft size={14} /> Volver a Cierres de Mes
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{nombreMes(cierre.mes)} {cierre.anio}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatearFecha(cierre.fecha_inicio)} – {formatearFecha(cierre.fecha_fin)} · cerrado el {formatearFecha(cierre.fecha_cierre)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {pdfListo && (
              <a href={`/cierres/${cierre.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
                <Download size={16} /> Descargar PDF
              </a>
            )}
            <button onClick={handleRegenerar} disabled={regenerando} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={14} className={regenerando ? 'animate-spin' : ''} />
              {regenerando ? 'Generando…' : pdfListo ? 'Regenerar PDF' : 'Generar PDF'}
            </button>
          </div>
          {errorPdf && <p className="text-xs text-red-700">{errorPdf}</p>}
        </div>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ventas</p>
          <p className="text-2xl font-bold text-slate-800">{formatearPeso(cierre.total_ventas)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gastos operativos</p>
          <p className="text-2xl font-bold text-slate-800">{formatearPeso(cierre.total_egresos_caja)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Producción</p>
          <p className="text-2xl font-bold text-slate-800">{cierre.total_cajones_equivalentes.toFixed(1)} cj</p>
          <p className="text-xs text-slate-400 mt-0.5">{cierre.total_huevos.toLocaleString('es-AR')} huevos</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ganancia neta</p>
          <p className={`text-2xl font-bold ${cierre.ganancia_neta < 0 ? 'text-red-700' : 'text-green-700'}`}>
            {formatearPeso(cierre.ganancia_neta)}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-700">Ingresos de caja en este período: {formatearPeso(cierre.total_ingresos_caja_otros)}.</span>{' '}
        Plata que entró en Caja (cobros de deudas de otros meses, puesto de mercado, otros ingresos), no es lo mismo que "Ventas".
      </div>

      {/* Secciones colapsables */}
      <div className="space-y-3">
        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('ventas')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Ventas ({ventas.length})</span>
            {seccionAbierta === 'ventas' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'ventas' && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por producto</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {(d.ventas_por_producto ?? []).map((v) => (
                        <tr key={v.producto}>
                          <td className="py-1 text-slate-600">{v.producto}</td>
                          <td className="py-1 text-right text-slate-500">{v.cantidad.toFixed(1)}</td>
                          <td className="py-1 text-right font-medium">{formatearPeso(v.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por cliente</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {(d.ventas_por_cliente ?? []).map((v) => (
                        <tr key={v.cliente}>
                          <td className="py-1 text-slate-600">{v.cliente}</td>
                          <td className="py-1 text-right font-medium">{formatearPeso(v.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="table-th">Fecha</th>
                      <th className="table-th">Cliente</th>
                      <th className="table-th">Producto</th>
                      <th className="table-th text-right">Cantidad</th>
                      <th className="table-th text-right">Monto</th>
                      <th className="table-th">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ventas.map((v) => (
                      <tr key={v.id}>
                        <td className="table-td">{formatearFecha(v.fecha)}</td>
                        <td className="table-td">{v.cliente}</td>
                        <td className="table-td">{v.producto ? nombreRel(v.producto) : v.tipo_venta}</td>
                        <td className="table-td text-right">{v.cantidad}</td>
                        <td className="table-td text-right">{formatearPeso(v.monto_cobrado + v.monto_debe)}</td>
                        <td className="table-td">{v.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cierre.notas_ventas && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notas sobre ventas</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{cierre.notas_ventas}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('gastos')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Gastos ({egresosCaja.length + comprasProveedor.length})</span>
            {seccionAbierta === 'gastos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'gastos' && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Egresos de caja por categoría</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {(d.egresos_por_categoria ?? []).map((e) => (
                        <tr key={e.categoria}>
                          <td className="py-1 text-slate-600">{e.categoria}</td>
                          <td className="py-1 text-right font-medium">{formatearPeso(e.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Compras por proveedor</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {(d.compras_por_proveedor ?? []).map((c) => (
                        <tr key={c.proveedor}>
                          <td className="py-1 text-slate-600">{c.proveedor}</td>
                          <td className="py-1 text-right font-medium">{formatearPeso(c.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="table-th">Fecha</th>
                      <th className="table-th">Categoría</th>
                      <th className="table-th">Descripción</th>
                      <th className="table-th text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {egresosCaja.map((e) => (
                      <tr key={e.id}>
                        <td className="table-td">{formatearFecha(e.fecha)}</td>
                        <td className="table-td">{e.categoria}</td>
                        <td className="table-td">{e.descripcion ?? '—'}</td>
                        <td className="table-td text-right">{formatearPeso(e.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cierre.notas_gastos && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notas sobre gastos</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{cierre.notas_gastos}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('produccion')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Producción ({produccion.length})</span>
            {seccionAbierta === 'produccion' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'produccion' && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por galpón</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {(d.produccion_por_galpon ?? []).map((p) => (
                      <tr key={p.galpon}>
                        <td className="py-1 text-slate-600">{p.galpon}</td>
                        <td className="py-1 text-right text-slate-500">{p.huevos.toLocaleString('es-AR')} huevos</td>
                        <td className="py-1 text-right font-medium">{p.cajones.toFixed(1)} cj</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="table-th">Fecha</th>
                      <th className="table-th">Galpón</th>
                      <th className="table-th text-right">Huevos</th>
                      <th className="table-th text-right">Muertes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {produccion.map((p) => (
                      <tr key={p.id}>
                        <td className="table-td">{formatearFecha(p.fecha)}</td>
                        <td className="table-td">{galponDeLote(p.lote)}</td>
                        <td className="table-td text-right">{p.huevos}</td>
                        <td className="table-td text-right">{p.muertes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cierre.notas_produccion && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notas sobre producción</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{cierre.notas_produccion}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('costos')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Costos de producción</span>
            {seccionAbierta === 'costos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'costos' && costoReal && (
            <div className="border-t border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Real (compras a proveedores + caja)</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    <tr><td className="py-1 text-slate-600">Alimento</td><td className="py-1 text-right font-medium">{formatearPeso(costoReal.alimento_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Sueldos</td><td className="py-1 text-right font-medium">{formatearPeso(costoReal.sueldos_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Maples</td><td className="py-1 text-right font-medium">{formatearPeso(costoReal.maples_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Otros</td><td className="py-1 text-right font-medium">{formatearPeso(costoReal.otros_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Amortización aves</td><td className="py-1 text-right font-medium">{formatearPeso(costoReal.amortizacion_real)}</td></tr>
                    <tr className="border-t border-slate-200 font-bold"><td className="py-1.5">Total</td><td className="py-1.5 text-right">{formatearPeso(costoReal.costo_total)}</td></tr>
                    <tr><td className="py-1 text-slate-500 text-xs">Costo por cajón</td><td className="py-1 text-right text-xs text-slate-500">{costoReal.cajones_reales > 0 ? formatearPeso(costoReal.costo_por_cajon) : '—'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Estándar (fórmula configurada en Costos)</p>
                <p className="text-2xl font-bold text-slate-800">{formatearPeso(cierre.costo_produccion_estandar)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparativo */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Comparativo con el cierre anterior</h3>
        {cierreAnterior ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">Métrica</th>
                <th className="table-th text-right">{nombreMes(cierreAnterior.mes)} {cierreAnterior.anio}</th>
                <th className="table-th text-right">Este cierre</th>
                <th className="table-th text-right">Variación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr>
                <td className="table-td">Ventas</td>
                <td className="table-td text-right text-slate-500">{formatearPeso(cierreAnterior.total_ventas)}</td>
                <td className="table-td text-right font-medium">{formatearPeso(cierre.total_ventas)}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(cierre.total_ventas, cierreAnterior.total_ventas)} /></td>
              </tr>
              <tr>
                <td className="table-td">Gastos</td>
                <td className="table-td text-right text-slate-500">{formatearPeso(cierreAnterior.total_egresos_caja)}</td>
                <td className="table-td text-right font-medium">{formatearPeso(cierre.total_egresos_caja)}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(cierre.total_egresos_caja, cierreAnterior.total_egresos_caja)} /></td>
              </tr>
              <tr>
                <td className="table-td">Producción (huevos)</td>
                <td className="table-td text-right text-slate-500">{cierreAnterior.total_huevos.toLocaleString('es-AR')}</td>
                <td className="table-td text-right font-medium">{cierre.total_huevos.toLocaleString('es-AR')}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(cierre.total_huevos, cierreAnterior.total_huevos)} /></td>
              </tr>
              <tr>
                <td className="table-td">Ganancia neta</td>
                <td className="table-td text-right text-slate-500">{formatearPeso(cierreAnterior.ganancia_neta)}</td>
                <td className="table-td text-right font-medium">{formatearPeso(cierre.ganancia_neta)}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(cierre.ganancia_neta, cierreAnterior.ganancia_neta)} /></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">No hay un cierre anterior para comparar.</p>
        )}
      </div>

      {cierre.observaciones && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Observaciones generales del mes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{cierre.observaciones}</p>
        </div>
      )}

      {!pdfListo && !regenerando && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-amber-800">
            Este cierre todavía no tiene un PDF generado. Probá "Generar PDF" arriba.
          </p>
        </div>
      )}
    </div>
  )
}
