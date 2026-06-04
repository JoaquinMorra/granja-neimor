'use client'

import { useState, useMemo, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import CargaProduccionModal from '@/components/produccion/CargaProduccionModal'
import type { Galpon, LoteConCalculos, ProduccionDiaria } from '@/types'
import { formatearFecha, getPosturaEsperada, hoyISO } from '@/lib/utils'
import {
  Plus, Egg, Filter, AlertTriangle, Edit, Trash2,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, X,
} from 'lucide-react'

// ── Modales inline ─────────────────────────────────────────────────────────────

function EditarCargaModal({ produccion, onClose }: { produccion: ProduccionDiaria; onClose: () => void }) {
  const router = useRouter()
  const [huevos, setHuevos] = useState(produccion.huevos.toString())
  const [muertes, setMuertes] = useState(produccion.muertes.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const galponNombre = (produccion.lote as any)?.galpon?.nombre ?? '—'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const nuevosHuevos = parseInt(huevos || '0')
    const nuevasMuertes = parseInt(muertes || '0')

    const { error: err } = await supabase
      .from('produccion_diaria')
      .update({ huevos: nuevosHuevos, muertes: nuevasMuertes })
      .eq('id', produccion.id)

    if (err) { setError(err.message); setLoading(false); return }

    await supabase.from('auditoria_produccion').insert({
      produccion_id: produccion.id,
      accion: 'UPDATE',
      user_id: user?.id ?? null,
      valores_antes: { huevos: produccion.huevos, muertes: produccion.muertes },
      valores_despues: { huevos: nuevosHuevos, muertes: nuevasMuertes },
    })

    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Editar carga</h2>
            <p className="text-xs text-slate-500 mt-0.5">{galponNombre} · {formatearFecha(produccion.fecha)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Huevos</label>
              <input type="number" min="0" value={huevos}
                onChange={(e) => setHuevos(e.target.value)}
                className="input text-center text-lg font-bold" />
            </div>
            <div>
              <label className="label">Muertes</label>
              <input type="number" min="0" value={muertes}
                onChange={(e) => setMuertes(e.target.value)}
                className="input text-center" />
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmarEliminarModal({
  produccion, loading, onClose, onConfirmar,
}: {
  produccion: ProduccionDiaria; loading: boolean; onClose: () => void; onConfirmar: () => void
}) {
  const galponNombre = (produccion.lote as any)?.galpon?.nombre ?? '—'
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Confirmar eliminación</h2>
          <p className="text-sm text-slate-600 mb-5">
            ¿Eliminar la carga de <strong>{galponNombre}</strong> del día{' '}
            <strong>{formatearFecha(produccion.fecha)}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button
              type="button" onClick={onConfirmar} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
  produccionReciente: ProduccionDiaria[]
}

export default function ProduccionClient({ galpones, lotes, produccionReciente }: Props) {
  const router = useRouter()
  const historialRef = useRef<HTMLDivElement>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ProduccionDiaria | null>(null)
  const [eliminando, setEliminando] = useState<ProduccionDiaria | null>(null)
  const [loadingEliminar, setLoadingEliminar] = useState(false)
  const [filtroGalpon, setFiltroGalpon] = useState('todos')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroSoloFuturas, setFiltroSoloFuturas] = useState(false)
  const [galponExpandido, setGalponExpandido] = useState<string | null>(null)

  const hoy = hoyISO()
  const fecha7dAtras = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]

  // ── Alerta: fechas futuras ──────────────────────────────────────────────────
  const cantFuturas = useMemo(
    () => produccionReciente.filter(p => p.fecha > hoy).length,
    [produccionReciente, hoy]
  )

  // ── Resumen de hoy ─────────────────────────────────────────────────────────
  const { huevosHoyTotal, huevosHoyColoradas, huevosHoyBlancas } = useMemo(() => {
    const hoyProd = produccionReciente.filter(p => p.fecha === hoy)
    return {
      huevosHoyTotal:     hoyProd.reduce((s, p) => s + p.huevos, 0),
      huevosHoyColoradas: hoyProd.filter(p => (p.lote as any)?.galpon?.tipo === 'coloradas').reduce((s, p) => s + p.huevos, 0),
      huevosHoyBlancas:   hoyProd.filter(p => (p.lote as any)?.galpon?.tipo === 'blancas').reduce((s, p) => s + p.huevos, 0),
    }
  }, [produccionReciente, hoy])

  // ── Filtro base (para tabla 7 días) ────────────────────────────────────────
  const produccionFiltradaBase = useMemo(() => {
    return produccionReciente.filter(p => {
      const gNombre = (p.lote as any)?.galpon?.nombre
      if (filtroGalpon !== 'todos' && gNombre !== filtroGalpon) return false
      if (filtroFechaDesde && p.fecha < filtroFechaDesde) return false
      if (filtroFechaHasta && p.fecha > filtroFechaHasta) return false
      return true
    })
  }, [produccionReciente, filtroGalpon, filtroFechaDesde, filtroFechaHasta])

  // ── Filtro historial (agrega solo-futuras) ─────────────────────────────────
  const produccionFiltrada = useMemo(() => {
    if (!filtroSoloFuturas) return produccionFiltradaBase
    return produccionFiltradaBase.filter(p => p.fecha > hoy)
  }, [produccionFiltradaBase, filtroSoloFuturas, hoy])

  // ── Tabla 7 días ───────────────────────────────────────────────────────────
  const totalesPorFecha = useMemo(() => {
    const mapa = new Map<string, { huevos: number; cajones: number; coloradas: number; blancas: number }>()
    produccionFiltradaBase.forEach(p => {
      const tipo = (p.lote as any)?.galpon?.tipo
      const prev = mapa.get(p.fecha) ?? { huevos: 0, cajones: 0, coloradas: 0, blancas: 0 }
      mapa.set(p.fecha, {
        huevos:    prev.huevos + p.huevos,
        cajones:   prev.cajones + p.huevos / 360,
        coloradas: prev.coloradas + (tipo === 'coloradas' ? p.huevos : 0),
        blancas:   prev.blancas   + (tipo === 'blancas'   ? p.huevos : 0),
      })
    })
    return Array.from(mapa.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)
  }, [produccionFiltradaBase])

  // ── Rendimiento por galpón ─────────────────────────────────────────────────
  const rendimientoPorGalpon = useMemo(() => {
    return galpones.map(galpon => {
      const lotesGalpon = lotes.filter(l => l.galpon_id === galpon.id && l.activo)
      const gallinasActivas = lotesGalpon.reduce((s, l) => s + l.gallinas_actuales, 0)

      const sumaEdad = lotesGalpon.reduce((s, l) => s + (l.edad_semanas ?? 0) * l.gallinas_actuales, 0)
      const edadPonderada = gallinasActivas > 0 ? sumaEdad / gallinasActivas : null
      const posturaEsperada = getPosturaEsperada(edadPonderada)

      // Solo datos pasados y de hoy (excluye fechas futuras)
      const prodGalpon = produccionReciente.filter(
        p => (p.lote as any)?.galpon?.nombre === galpon.nombre && p.fecha <= hoy
      )

      // Agrupar por fecha sumando todos los lotes del galpón
      const huevosPorFecha = new Map<string, number>()
      prodGalpon.forEach(p => {
        huevosPorFecha.set(p.fecha, (huevosPorFecha.get(p.fecha) ?? 0) + p.huevos)
      })

      const allEntries = Array.from(huevosPorFecha.entries())
      const entries7   = allEntries.filter(([f]) => f >= fecha7dAtras)

      const suma7 = entries7.reduce((s, [, v]) => s + v, 0)
      const dias7 = entries7.length
      const avg7  = dias7 > 0 ? suma7 / dias7 : 0

      const suma30 = allEntries.reduce((s, [, v]) => s + v, 0)
      const dias30 = allEntries.length
      const avg30  = dias30 > 0 ? suma30 / dias30 : 0

      const postura7  = gallinasActivas > 0 ? (avg7  / gallinasActivas) * 100 : 0
      const postura30 = gallinasActivas > 0 ? (avg30 / gallinasActivas) * 100 : 0

      let tendencia: 'subiendo' | 'estable' | 'bajando' = 'estable'
      if (avg30 > 0) {
        if (avg7 > avg30 * 1.05) tendencia = 'subiendo'
        else if (avg7 < avg30 * 0.95) tendencia = 'bajando'
      }

      const detalle = allEntries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, huevos]) => ({
          fecha,
          huevos,
          posturaPct: gallinasActivas > 0 ? (huevos / gallinasActivas) * 100 : 0,
        }))

      return { galpon, gallinasActivas, avg7: Math.round(avg7), avg30: Math.round(avg30), postura7, postura30, tendencia, posturaEsperada, detalle }
    })
  }, [galpones, lotes, produccionReciente, hoy, fecha7dAtras])

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleEliminar() {
    if (!eliminando) return
    setLoadingEliminar(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('auditoria_produccion').insert({
      produccion_id: eliminando.id,
      accion: 'DELETE',
      user_id: user?.id ?? null,
      valores_antes: { huevos: eliminando.huevos, muertes: eliminando.muertes },
      valores_despues: null,
    })

    await supabase
      .from('produccion_diaria')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eliminando.id)

    setLoadingEliminar(false)
    setEliminando(null)
    router.refresh()
  }

  function handleVerFuturas() {
    setFiltroSoloFuturas(true)
    setTimeout(() => historialRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

      {/* Alerta: fechas futuras */}
      {cantFuturas > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={18} />
          <p className="text-sm text-amber-800 flex-1">
            Hay <strong>{cantFuturas} carga{cantFuturas > 1 ? 's' : ''}</strong> con fecha futura.{' '}
            <button onClick={handleVerFuturas} className="underline font-medium">Ver y corregir</button>
          </p>
        </div>
      )}

      {/* Cards resumen del día */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total cajones hoy</p>
          <p className="text-3xl font-bold text-slate-800">{(huevosHoyTotal / 360).toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">{huevosHoyTotal.toLocaleString('es-AR')} huevos</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-l-orange-400">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cajones coloradas</p>
          <p className="text-3xl font-bold text-orange-700">{(huevosHoyColoradas / 360).toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">{huevosHoyColoradas.toLocaleString('es-AR')} huevos</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-l-blue-400">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cajones blancas</p>
          <p className="text-3xl font-bold text-blue-700">{(huevosHoyBlancas / 360).toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">{huevosHoyBlancas.toLocaleString('es-AR')} huevos</p>
        </div>
      </div>

      {/* Cards de lotes por galpón */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {galpones.map((g) => {
          const lotesGalpon = lotes.filter((l) => l.galpon_id === g.id && l.activo)
          const totalGallinas = lotesGalpon.reduce((s, l) => s + l.gallinas_actuales, 0)
          return (
            <div key={g.id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${g.tipo === 'coloradas' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                <span className="font-semibold text-slate-800 text-sm">{g.nombre}</span>
                <span className="text-xs text-slate-400 ml-auto">{g.tipo === 'coloradas' ? 'Coloradas' : 'Blancas'}</span>
              </div>
              <div className="space-y-2">
                {lotesGalpon.map((l) => {
                  const postura = getPosturaEsperada(l.edad_semanas)
                  return (
                    <div key={l.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2 py-1.5">
                      <span className="text-slate-600 font-medium">{l.nombre}</span>
                      <div className="text-right">
                        <span className="text-slate-800 font-semibold">{l.gallinas_actuales.toLocaleString()}</span>
                        <span className="text-slate-400 ml-1">gall.</span>
                        {l.edad_semanas !== null && (
                          <div className="text-slate-400">{l.edad_semanas}s · esp. {postura.min}-{postura.max}%</div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500">Total</span>
                  <span className="text-xs font-bold text-slate-800">{totalGallinas.toLocaleString()} gallinas</span>
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
                <th className="table-th text-right">Cajones total</th>
                <th className="table-th text-right">Caj. coloradas</th>
                <th className="table-th text-right">Caj. blancas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {totalesPorFecha.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-td text-center text-slate-400 py-8">Sin registros</td>
                </tr>
              ) : (
                totalesPorFecha.map(([fecha, t]) => (
                  <tr key={fecha} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{formatearFecha(fecha)}</td>
                    <td className="table-td text-right">{t.huevos.toLocaleString('es-AR')}</td>
                    <td className="table-td text-right font-semibold text-slate-800">{t.cajones.toFixed(1)}</td>
                    <td className="table-td text-right text-orange-700">{(t.coloradas / 360).toFixed(1)}</td>
                    <td className="table-td text-right text-blue-700">{(t.blancas / 360).toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rendimiento por galpón */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Rendimiento por galpón</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Promedios calculados sobre días con carga registrada · click en una fila para ver detalle
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Galpón</th>
                <th className="table-th">Color</th>
                <th className="table-th text-right">Gallinas</th>
                <th className="table-th text-right">Prom. 7 días</th>
                <th className="table-th text-right">Prom. 30 días</th>
                <th className="table-th text-right">% Post. 7d</th>
                <th className="table-th text-right">% Post. 30d</th>
                <th className="table-th text-center">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {rendimientoPorGalpon.map((r) => (
                <Fragment key={r.galpon.id}>
                  <tr
                    className="hover:bg-slate-50 cursor-pointer border-b border-slate-50"
                    onClick={() => setGalponExpandido(prev => prev === r.galpon.id ? null : r.galpon.id)}
                  >
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${r.galpon.tipo === 'coloradas' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                        <span className="font-semibold">{r.galpon.nombre}</span>
                        {galponExpandido === r.galpon.id
                          ? <ChevronUp size={14} className="text-slate-400" />
                          : <ChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </td>
                    <td className="table-td text-xs capitalize text-slate-500">{r.galpon.tipo}</td>
                    <td className="table-td text-right">{r.gallinasActivas.toLocaleString('es-AR')}</td>
                    <td className="table-td text-right font-semibold">{r.avg7.toLocaleString('es-AR')}</td>
                    <td className="table-td text-right text-slate-600">{r.avg30.toLocaleString('es-AR')}</td>
                    <td className="table-td text-right font-semibold">{r.postura7.toFixed(1)}%</td>
                    <td className="table-td text-right text-slate-600">{r.postura30.toFixed(1)}%</td>
                    <td className="table-td text-center">
                      {r.tendencia === 'subiendo' && (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium text-xs">
                          <TrendingUp size={14} /> subiendo
                        </span>
                      )}
                      {r.tendencia === 'bajando' && (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium text-xs">
                          <TrendingDown size={14} /> bajando
                        </span>
                      )}
                      {r.tendencia === 'estable' && (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-medium text-xs">
                          <Minus size={14} /> estable
                        </span>
                      )}
                    </td>
                  </tr>
                  {galponExpandido === r.galpon.id && (
                    <tr>
                      <td colSpan={8} className="p-5 bg-slate-50 border-b border-slate-100">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700">
                              Producción diaria — últimos 30 días
                            </p>
                            {r.posturaEsperada.min > 0 && (
                              <p className="text-xs text-slate-500">
                                Postura esperada: {r.posturaEsperada.min}–{r.posturaEsperada.max}%
                              </p>
                            )}
                          </div>
                          {r.detalle.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={r.detalle} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v: number) => v.toLocaleString('es-AR')} />
                                <Tooltip
                                  formatter={(val: number) => [val.toLocaleString('es-AR') + ' huevos']}
                                  labelFormatter={(label: string) => formatearFecha(label)}
                                />
                                <Bar
                                  dataKey="huevos"
                                  fill={r.galpon.tipo === 'coloradas' ? '#fb923c' : '#60a5fa'}
                                  radius={[2, 2, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-sm text-slate-400 py-4">Sin datos en los últimos 30 días</p>
                          )}
                          <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-slate-50">
                                <tr className="border-b border-slate-200">
                                  <th className="py-1 text-left text-slate-500 font-medium">Fecha</th>
                                  <th className="py-1 text-right text-slate-500 font-medium">Huevos</th>
                                  <th className="py-1 text-right text-slate-500 font-medium">% Postura</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {[...r.detalle].reverse().map(({ fecha, huevos, posturaPct }) => (
                                  <tr key={fecha}>
                                    <td className="py-1 text-slate-600">{formatearFecha(fecha)}</td>
                                    <td className="py-1 text-right font-semibold text-slate-800">
                                      {huevos.toLocaleString('es-AR')}
                                    </td>
                                    <td className={`py-1 text-right font-medium ${
                                      r.posturaEsperada.min > 0 && posturaPct < r.posturaEsperada.min
                                        ? 'text-amber-600' : 'text-green-700'
                                    }`}>
                                      {posturaPct.toFixed(1)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de cargas */}
      <div className="card" ref={historialRef}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mr-auto">
              <Filter size={16} className="text-slate-400" />
              Historial de cargas (30 días)
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
              type="date" value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="input w-auto text-sm"
            />
            <input
              type="date" value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="input w-auto text-sm"
            />
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox" checked={filtroSoloFuturas}
                onChange={(e) => setFiltroSoloFuturas(e.target.checked)}
                className="rounded"
              />
              Solo futuras
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Fecha</th>
                <th className="table-th">Galpón</th>
                <th className="table-th text-right">Huevos</th>
                <th className="table-th text-right">Muertes</th>
                <th className="table-th text-right">Cajones</th>
                <th className="table-th">Cargado el</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {produccionFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center text-slate-400 py-8">
                    Sin registros para los filtros aplicados
                  </td>
                </tr>
              ) : (
                produccionFiltrada.map((p) => {
                  const esFutura = p.fecha > hoy
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 ${esFutura ? 'bg-amber-50' : ''}`}>
                      <td className="table-td font-medium">
                        {formatearFecha(p.fecha)}
                        {esFutura && (
                          <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                            futura
                          </span>
                        )}
                      </td>
                      <td className="table-td">{(p.lote as any)?.galpon?.nombre ?? '—'}</td>
                      <td className="table-td text-right font-semibold">{p.huevos.toLocaleString('es-AR')}</td>
                      <td className="table-td text-right">
                        {p.muertes > 0
                          ? <span className="text-red-600 font-medium">{p.muertes}</span>
                          : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="table-td text-right text-slate-600">{(p.huevos / 360).toFixed(2)}</td>
                      <td className="table-td text-xs text-slate-400">
                        {new Date(p.created_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditando(p)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => setEliminando(p)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {modalOpen && (
        <CargaProduccionModal
          galpones={galpones}
          lotes={lotes}
          produccionReciente={produccionReciente}
          onClose={() => setModalOpen(false)}
        />
      )}
      {editando && (
        <EditarCargaModal produccion={editando} onClose={() => setEditando(null)} />
      )}
      {eliminando && (
        <ConfirmarEliminarModal
          produccion={eliminando}
          loading={loadingEliminar}
          onClose={() => setEliminando(null)}
          onConfirmar={handleEliminar}
        />
      )}
    </div>
  )
}
