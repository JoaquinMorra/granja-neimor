'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatearPeso, formatearFecha, nombreMes, NOMBRES_MES } from '@/lib/utils'
import { previewCierre } from '@/lib/cierres/preview-action'
import { confirmarCierre } from '@/lib/cierres/crear-cierre'
import type { AgregadosCierre } from '@/lib/cierres/calcular-agregados'
import type { CierreMensual } from '@/types'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type Props = {
  fechaInicioDefault: string
  fechaFinDefault: string
  anioDefault: number
  mesDefault: number
  agregadosIniciales: AgregadosCierre
  cierresExistentes: { anio: number; mes: number }[]
  cierreAnterior: CierreMensual | null
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

export default function NuevoCierreClient({
  fechaInicioDefault,
  fechaFinDefault,
  anioDefault,
  mesDefault,
  agregadosIniciales,
  cierresExistentes,
  cierreAnterior,
}: Props) {
  const router = useRouter()
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault)
  const [fechaFin, setFechaFin] = useState(fechaFinDefault)
  const [anio, setAnio] = useState(anioDefault)
  const [mes, setMes] = useState(mesDefault)
  const [labelTocada, setLabelTocada] = useState(false)

  const [agregados, setAgregados] = useState<AgregadosCierre>(agregadosIniciales)
  const [loading, setLoading] = useState(false)
  const [errorFechas, setErrorFechas] = useState<string | null>(null)

  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null)

  const [seccionAbierta, setSeccionAbierta] = useState<Seccion | null>(null)

  const [observaciones, setObservaciones] = useState('')
  const [notasVentas, setNotasVentas] = useState('')
  const [notasGastos, setNotasGastos] = useState('')
  const [notasProduccion, setNotasProduccion] = useState('')

  const primerRender = useRef(true)

  // Recalcular el preview cada vez que cambian las fechas
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    if (fechaFin < fechaInicio) {
      setErrorFechas('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }
    setErrorFechas(null)
    setLoading(true)
    previewCierre(fechaInicio, fechaFin)
      .then(setAgregados)
      .finally(() => setLoading(false))
  }, [fechaInicio, fechaFin])

  // Actualizar la etiqueta mes/año sugerida en base a la fecha de inicio,
  // salvo que Joaco ya la haya tocado a mano.
  useEffect(() => {
    if (labelTocada) return
    const d = new Date(fechaInicio + 'T12:00:00')
    if (isNaN(d.getTime())) return
    setAnio(d.getFullYear())
    setMes(d.getMonth() + 1)
  }, [fechaInicio, labelTocada])

  const yaExiste = cierresExistentes.some((c) => c.anio === anio && c.mes === mes)
  const anteriorValido = cierreAnterior && cierreAnterior.fecha_fin < fechaInicio ? cierreAnterior : null

  function toggleSeccion(s: Seccion) {
    setSeccionAbierta((prev) => (prev === s ? null : s))
  }

  async function handleConfirmar() {
    const ok = window.confirm(
      `¿Confirmás el cierre de ${nombreMes(mes)} ${anio}? Una vez confirmado, los registros de este período quedan bloqueados y no se puede deshacer.`
    )
    if (!ok) return

    setConfirmando(true)
    setErrorConfirmar(null)
    const resultado = await confirmarCierre({
      fechaInicio,
      fechaFin,
      anio,
      mes,
      observaciones,
      notasVentas,
      notasGastos,
      notasProduccion,
    })

    if ('error' in resultado) {
      setErrorConfirmar(resultado.error)
      setConfirmando(false)
      return
    }

    router.push(`/cierres/${resultado.id}`)
  }

  const puedeConfirmar = !loading && !confirmando && !errorFechas && !yaExiste

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cerrar un mes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Revisá el período, ajustá las fechas si hace falta, y confirmá al final. Nada se guarda hasta que confirmes.
        </p>
      </div>

      {/* Selector de período */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha inicio</label>
            <input
              type="date"
              className="input mt-1"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha fin</label>
            <input
              type="date"
              className="input mt-1"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mes a etiquetar</label>
            <select
              className="input mt-1"
              value={mes}
              onChange={(e) => { setMes(parseInt(e.target.value)); setLabelTocada(true) }}
            >
              {NOMBRES_MES.map((nombre, i) => (
                <option key={i + 1} value={i + 1}>{nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Año a etiquetar</label>
            <input
              type="number"
              className="input mt-1"
              value={anio}
              onChange={(e) => { setAnio(parseInt(e.target.value) || anio); setLabelTocada(true) }}
            />
          </div>
        </div>

        {errorFechas && (
          <p className="text-sm text-red-700 flex items-center gap-1.5"><AlertTriangle size={14} /> {errorFechas}</p>
        )}
        {yaExiste && (
          <p className="text-sm text-red-700 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Ya existe un cierre para {nombreMes(mes)} {anio}. Elegí otra etiqueta si es un período distinto.
          </p>
        )}
        {agregados.hayFechasFuturas && (
          <p className="text-sm text-amber-700 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Hay registros con fecha posterior a hoy dentro de este rango. Revisá si las fechas son correctas.
          </p>
        )}
        <p className="text-xs text-slate-400">
          Una vez confirmado el cierre, los registros de este período quedan bloqueados: no se van a poder editar ni borrar
          (aunque sí vas a poder seguir marcando ventas/compras como cobradas o pagadas más adelante).
        </p>
      </div>

      {/* Cards resumen */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ventas</p>
          <p className="text-2xl font-bold text-slate-800">{formatearPeso(agregados.totalVentas)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {formatearPeso(agregados.ventas.reduce((s, v) => s + v.monto_cobrado, 0))} cobrado · {formatearPeso(agregados.ventas.reduce((s, v) => s + v.monto_debe, 0))} a cobrar
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gastos operativos</p>
          <p className="text-2xl font-bold text-slate-800">{formatearPeso(agregados.totalEgresosCaja)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Producción</p>
          <p className="text-2xl font-bold text-slate-800">{agregados.totalCajonesEquivalentes.toFixed(1)} cj</p>
          <p className="text-xs text-slate-400 mt-0.5">{agregados.totalHuevos.toLocaleString('es-AR')} huevos</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ganancia neta</p>
          <p className={`text-2xl font-bold ${agregados.gananciaNeta < 0 ? 'text-red-700' : 'text-green-700'}`}>
            {formatearPeso(agregados.gananciaNeta)}
          </p>
        </div>
      </div>

      {/* Nota: caja es un ledger de plata real, separado de "Ventas" (que es lo facturado).
          Se muestra acá para que no se confunda con el total de Ventas de arriba. */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-700">Ingresos de caja en este período: {formatearPeso(agregados.totalIngresosCajaOtros)}.</span>{' '}
        Esto es la plata que entró en Caja (cobros de deudas de otros meses, puesto de mercado, otros ingresos cargados a mano),
        no necesariamente lo mismo que "Ventas" de arriba. No se usa en la Ganancia neta de este cierre.
      </div>

      {loading && (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Recalculando…</p>
      )}

      {/* Secciones colapsables */}
      <div className="space-y-3">
        {/* Ventas */}
        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('ventas')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Ventas ({agregados.ventas.length})</span>
            {seccionAbierta === 'ventas' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'ventas' && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por producto</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {agregados.ventasPorProducto.map((v) => (
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
                      {agregados.ventasPorCliente.map((v) => (
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
                    {agregados.ventas.map((v) => (
                      <tr key={v.id}>
                        <td className="table-td">{formatearFecha(v.fecha)}</td>
                        <td className="table-td">{v.cliente}</td>
                        <td className="table-td">{v.producto ?? v.tipo_venta}</td>
                        <td className="table-td text-right">{v.cantidad}</td>
                        <td className="table-td text-right">{formatearPeso(v.monto)}</td>
                        <td className="table-td">{v.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas sobre ventas</label>
                <textarea className="input mt-1" rows={2} value={notasVentas} onChange={(e) => setNotasVentas(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Gastos */}
        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('gastos')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Gastos ({agregados.egresosCaja.length + agregados.comprasProveedor.length})</span>
            {seccionAbierta === 'gastos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'gastos' && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Egresos de caja por categoría</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {agregados.egresosPorCategoria.map((e) => (
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
                      {agregados.comprasPorProveedor.map((c) => (
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
                    {agregados.egresosCaja.map((e) => (
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
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas sobre gastos</label>
                <textarea className="input mt-1" rows={2} value={notasGastos} onChange={(e) => setNotasGastos(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Producción */}
        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('produccion')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Producción ({agregados.produccion.length})</span>
            {seccionAbierta === 'produccion' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'produccion' && (
            <div className="border-t border-slate-100 p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por galpón</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {agregados.produccionPorGalpon.map((p) => (
                      <tr key={p.galpon}>
                        <td className="py-1 text-slate-600">{p.galpon}</td>
                        <td className="py-1 text-right text-slate-500">{p.huevos.toLocaleString('es-AR')} huevos</td>
                        <td className="py-1 text-right font-medium">{p.cajones.toFixed(1)} cj</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas sobre producción</label>
                <textarea className="input mt-1" rows={2} value={notasProduccion} onChange={(e) => setNotasProduccion(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Costos */}
        <div className="card overflow-hidden">
          <button onClick={() => toggleSeccion('costos')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-800">Costos de producción</span>
            {seccionAbierta === 'costos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {seccionAbierta === 'costos' && (
            <div className="border-t border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Real (compras a proveedores + caja)</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    <tr><td className="py-1 text-slate-600">Alimento</td><td className="py-1 text-right font-medium">{formatearPeso(agregados.costoProduccionReal.alimento_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Sueldos</td><td className="py-1 text-right font-medium">{formatearPeso(agregados.costoProduccionReal.sueldos_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Maples</td><td className="py-1 text-right font-medium">{formatearPeso(agregados.costoProduccionReal.maples_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Otros</td><td className="py-1 text-right font-medium">{formatearPeso(agregados.costoProduccionReal.otros_real)}</td></tr>
                    <tr><td className="py-1 text-slate-600">Amortización aves</td><td className="py-1 text-right font-medium">{formatearPeso(agregados.costoProduccionReal.amortizacion_real)}</td></tr>
                    <tr className="border-t border-slate-200 font-bold"><td className="py-1.5">Total</td><td className="py-1.5 text-right">{formatearPeso(agregados.costoProduccionReal.costo_total)}</td></tr>
                    <tr><td className="py-1 text-slate-500 text-xs">Costo por cajón</td><td className="py-1 text-right text-xs text-slate-500">{agregados.costoProduccionReal.cajones_reales > 0 ? formatearPeso(agregados.costoProduccionReal.costo_por_cajon) : '—'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Estándar (fórmula configurada en Costos)</p>
                <p className="text-2xl font-bold text-slate-800">{formatearPeso(agregados.costoProduccionEstandar)}</p>
                <p className="text-xs text-slate-400 mt-1">Proyección según parámetros de /costos/configuracion para la duración de este período.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparativo con mes anterior */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Comparativo con el cierre anterior</h3>
        {anteriorValido ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">Métrica</th>
                <th className="table-th text-right">{nombreMes(anteriorValido.mes)} {anteriorValido.anio}</th>
                <th className="table-th text-right">Este cierre</th>
                <th className="table-th text-right">Variación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr>
                <td className="table-td">Ventas</td>
                <td className="table-td text-right text-slate-500">{formatearPeso(anteriorValido.total_ventas)}</td>
                <td className="table-td text-right font-medium">{formatearPeso(agregados.totalVentas)}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(agregados.totalVentas, anteriorValido.total_ventas)} /></td>
              </tr>
              <tr>
                <td className="table-td">Gastos</td>
                <td className="table-td text-right text-slate-500">{formatearPeso(anteriorValido.total_egresos_caja)}</td>
                <td className="table-td text-right font-medium">{formatearPeso(agregados.totalEgresosCaja)}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(agregados.totalEgresosCaja, anteriorValido.total_egresos_caja)} /></td>
              </tr>
              <tr>
                <td className="table-td">Producción (huevos)</td>
                <td className="table-td text-right text-slate-500">{anteriorValido.total_huevos.toLocaleString('es-AR')}</td>
                <td className="table-td text-right font-medium">{agregados.totalHuevos.toLocaleString('es-AR')}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(agregados.totalHuevos, anteriorValido.total_huevos)} /></td>
              </tr>
              <tr>
                <td className="table-td">Ganancia neta</td>
                <td className="table-td text-right text-slate-500">{formatearPeso(anteriorValido.ganancia_neta)}</td>
                <td className="table-td text-right font-medium">{formatearPeso(agregados.gananciaNeta)}</td>
                <td className="table-td text-right"><PctTag pct={desvioPct(agregados.gananciaNeta, anteriorValido.ganancia_neta)} /></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">No hay un cierre anterior válido para comparar contra este período.</p>
        )}
      </div>

      {/* Observaciones generales */}
      <div className="card p-5">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Observaciones generales del mes</label>
        <textarea className="input mt-1" rows={4} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>

      {/* Botones finales */}
      <div className="space-y-2 pb-8">
        {errorConfirmar && (
          <p className="text-sm text-red-700 flex items-center gap-1.5 justify-end"><AlertTriangle size={14} /> {errorConfirmar}</p>
        )}
        <div className="flex items-center justify-end gap-3">
          <Link href="/cierres" className="btn-secondary">Cancelar</Link>
          <button
            disabled={!puedeConfirmar}
            onClick={handleConfirmar}
            className="btn-primary flex items-center gap-2"
          >
            {confirmando && <Loader2 size={14} className="animate-spin" />}
            {confirmando ? 'Confirmando…' : 'Confirmar y generar cierre'}
          </button>
        </div>
      </div>
    </div>
  )
}
