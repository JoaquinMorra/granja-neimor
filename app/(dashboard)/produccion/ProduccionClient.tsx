'use client'

import { useState, useMemo } from 'react'
import CargaProduccionModal from '@/components/produccion/CargaProduccionModal'
import type { Galpon, LoteConCalculos, ProduccionDiaria } from '@/types'
import { formatearFecha, getPosturaEsperada, calcularEdadSemanas } from '@/lib/utils'
import { Plus, Egg, Filter } from 'lucide-react'

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
  produccionReciente: ProduccionDiaria[]
}

export default function ProduccionClient({ galpones, lotes, produccionReciente }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [filtroGalpon, setFiltroGalpon] = useState('todos')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  const produccionFiltrada = useMemo(() => {
    return produccionReciente.filter((p) => {
      const galpon = (p.lote as any)?.galpon
      if (filtroGalpon !== 'todos' && galpon?.nombre !== filtroGalpon) return false
      if (filtroFechaDesde && p.fecha < filtroFechaDesde) return false
      if (filtroFechaHasta && p.fecha > filtroFechaHasta) return false
      return true
    })
  }, [produccionReciente, filtroGalpon, filtroFechaDesde, filtroFechaHasta])

  // Agrupar por fecha para totales diarios
  const totalesPorFecha = useMemo(() => {
    const mapa = new Map<string, { huevos: number; cajones: number }>()
    produccionFiltrada.forEach((p) => {
      const prev = mapa.get(p.fecha) ?? { huevos: 0, cajones: 0 }
      mapa.set(p.fecha, {
        huevos: prev.huevos + p.huevos,
        cajones: prev.cajones + p.huevos / 360,
      })
    })
    return Array.from(mapa.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
  }, [produccionFiltrada])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Producción</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro diario de huevos y muertes</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span className="hidden sm:inline">Cargar producción</span>
          <span className="sm:hidden">Cargar</span>
        </button>
      </div>

      {/* Resumen de lotes activos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {galpones.map((g) => {
          const lotesGalpon = lotes.filter((l) => l.galpon_id === g.id && l.activo)
          const totalGallinas = lotesGalpon.reduce((s, l) => s + l.gallinas_actuales, 0)
          return (
            <div key={g.id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    g.tipo === 'coloradas' ? 'bg-orange-400' : 'bg-blue-400'
                  }`}
                />
                <span className="font-semibold text-slate-800 text-sm">{g.nombre}</span>
                <span className="text-xs text-slate-400 ml-auto">
                  {g.tipo === 'coloradas' ? 'Coloradas' : 'Blancas'}
                </span>
              </div>
              <div className="space-y-2">
                {lotesGalpon.map((l) => {
                  const postura = getPosturaEsperada(l.edad_semanas)
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2 py-1.5"
                    >
                      <span className="text-slate-600 font-medium">{l.nombre}</span>
                      <div className="text-right">
                        <span className="text-slate-800 font-semibold">
                          {l.gallinas_actuales.toLocaleString()}
                        </span>
                        <span className="text-slate-400 ml-1">gall.</span>
                        {l.edad_semanas !== null && (
                          <div className="text-slate-400">
                            {l.edad_semanas}s · esp. {postura.min}-{postura.max}%
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500">Total</span>
                  <span className="text-xs font-bold text-slate-800">
                    {totalGallinas.toLocaleString()} gallinas
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumen últimos 7 días */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Egg size={18} className="text-amber-500" />
          Resumen últimos 7 días
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th">Fecha</th>
                <th className="table-th text-right">Huevos totales</th>
                <th className="table-th text-right">Cajones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {totalesPorFecha.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-td text-center text-slate-400 py-8">
                    Sin registros
                  </td>
                </tr>
              ) : (
                totalesPorFecha.map(([fecha, totales]) => (
                  <tr key={fecha} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{formatearFecha(fecha)}</td>
                    <td className="table-td text-right">{totales.huevos.toLocaleString('es-AR')}</td>
                    <td className="table-td text-right font-semibold text-blue-700">
                      {totales.cajones.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial detallado */}
      <div className="card">
        <div className="p-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mr-auto">
              <Filter size={16} className="text-slate-400" />
              Historial de producción (30 días)
            </h3>
            <select
              value={filtroGalpon}
              onChange={(e) => setFiltroGalpon(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="todos">Todos los galpones</option>
              {galpones.map((g) => (
                <option key={g.id} value={g.nombre}>{g.nombre}</option>
              ))}
            </select>
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="input w-auto text-sm"
              placeholder="Desde"
            />
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="input w-auto text-sm"
              placeholder="Hasta"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Fecha</th>
                <th className="table-th">Galpón</th>
                <th className="table-th">Lote</th>
                <th className="table-th text-right">Huevos</th>
                <th className="table-th text-right">% Postura</th>
                <th className="table-th text-right">Muertes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {produccionFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-td text-center text-slate-400 py-8">
                    Sin registros para los filtros aplicados
                  </td>
                </tr>
              ) : (
                produccionFiltrada.map((p) => {
                  const lote = lotes.find((l) => l.id === p.lote_id)
                  const postura = lote
                    ? (p.huevos / lote.gallinas_actuales) * 100
                    : 0
                  const esperada = getPosturaEsperada(lote?.edad_semanas ?? null)
                  const ok = esperada.min === 0 && esperada.max === 0
                    ? true
                    : postura >= esperada.min

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="table-td">{formatearFecha(p.fecha)}</td>
                      <td className="table-td">{(p.lote as any)?.galpon?.nombre ?? '—'}</td>
                      <td className="table-td">{(p.lote as any)?.nombre ?? '—'}</td>
                      <td className="table-td text-right font-semibold">
                        {p.huevos.toLocaleString('es-AR')}
                      </td>
                      <td className="table-td text-right">
                        <span
                          className={`font-medium ${
                            ok ? 'text-green-700' : 'text-amber-600'
                          }`}
                        >
                          {postura.toFixed(1)}%
                        </span>
                      </td>
                      <td className="table-td text-right">
                        {p.muertes > 0 ? (
                          <span className="text-red-600 font-medium">{p.muertes}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <CargaProduccionModal
          galpones={galpones}
          lotes={lotes}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
