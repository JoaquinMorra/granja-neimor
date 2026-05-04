'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Caja } from '@/types'
import { formatearFecha, formatearPeso, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, hoyISO } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Plus, X, TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'

type Periodo = { inicio: string; fin: string; label: string }

type Props = {
  movimientos: Caja[]
  resumenMensual: { fecha: string; tipo: string; monto: number }[]
  periodoLabel: string
  periodos: Periodo[]
}

function NuevoMovimientoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    fecha: hoyISO(),
    tipo: 'INGRESO' as 'INGRESO' | 'EGRESO',
    medio_pago: 'EFECTIVO' as 'EFECTIVO' | 'TRANSFERENCIA',
    categoria: '',
    descripcion: '',
    monto: '',
  })

  const categorias = form.tipo === 'INGRESO' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO

  function handleTipoChange(tipo: 'INGRESO' | 'EGRESO') {
    setForm((prev) => ({ ...prev, tipo, categoria: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.categoria) { setError('Seleccioná una categoría.'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { setError('El monto debe ser mayor a 0.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('caja').insert({
      fecha: form.fecha,
      tipo: form.tipo,
      medio_pago: form.medio_pago,
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      monto: parseFloat(form.monto),
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Nuevo movimiento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Tipo</label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => handleTipoChange('INGRESO')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.tipo === 'INGRESO'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-green-400'
                  }`}>
                  INGRESO
                </button>
                <button type="button"
                  onClick={() => handleTipoChange('EGRESO')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.tipo === 'EGRESO'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-red-400'
                  }`}>
                  EGRESO
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Medio de pago</label>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, medio_pago: 'EFECTIVO' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.medio_pago === 'EFECTIVO'
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                }`}>
                Efectivo
              </button>
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, medio_pago: 'TRANSFERENCIA' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.medio_pago === 'TRANSFERENCIA'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                }`}>
                Transferencia
              </button>
            </div>
          </div>

          <div>
            <label className="label">Categoría</label>
            <select value={form.categoria}
              onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
              className="input" required>
              <option value="">Seleccioná una categoría</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Descripción (opcional)</label>
            <input type="text" value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              className="input" placeholder="Detalle del movimiento..." />
          </div>

          <div>
            <label className="label">Monto ($)</label>
            <input type="number" min="0" step="0.01" value={form.monto}
              onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              className="input" placeholder="0" required />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CajaClient({ movimientos, resumenMensual, periodoLabel, periodos }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos')

  const totalIngresos = movimientos
    .filter((m) => m.tipo === 'INGRESO')
    .reduce((s, m) => s + m.monto, 0)
  const totalEgresos = movimientos
    .filter((m) => m.tipo === 'EGRESO')
    .reduce((s, m) => s + m.monto, 0)
  const saldoMes = totalIngresos - totalEgresos

  const ingresosEfectivo = movimientos
    .filter((m) => m.tipo === 'INGRESO' && m.medio_pago === 'EFECTIVO')
    .reduce((s, m) => s + m.monto, 0)
  const egresosEfectivo = movimientos
    .filter((m) => m.tipo === 'EGRESO' && m.medio_pago === 'EFECTIVO')
    .reduce((s, m) => s + m.monto, 0)
  const saldoEfectivo = ingresosEfectivo - egresosEfectivo

  const ingresosTransf = movimientos
    .filter((m) => m.tipo === 'INGRESO' && m.medio_pago === 'TRANSFERENCIA')
    .reduce((s, m) => s + m.monto, 0)
  const egresosTransf = movimientos
    .filter((m) => m.tipo === 'EGRESO' && m.medio_pago === 'TRANSFERENCIA')
    .reduce((s, m) => s + m.monto, 0)
  const saldoTransf = ingresosTransf - egresosTransf

  // Resumen por categoría
  const egresosPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    movimientos
      .filter((m) => m.tipo === 'EGRESO')
      .forEach((m) => {
        mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.monto)
      })
    return Array.from(mapa.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([categoria, monto]) => ({ categoria, monto }))
  }, [movimientos])

  // Gráfico por período (6 al 5)
  const graficoMensual = useMemo(() => {
    return periodos.map(({ inicio, fin, label }) => {
      const ingresos = resumenMensual
        .filter((m) => m.tipo === 'INGRESO' && m.fecha >= inicio && m.fecha <= fin)
        .reduce((s, m) => s + m.monto, 0)
      const egresos = resumenMensual
        .filter((m) => m.tipo === 'EGRESO' && m.fecha >= inicio && m.fecha <= fin)
        .reduce((s, m) => s + m.monto, 0)
      return { mes: label, ingresos, egresos }
    })
  }, [resumenMensual, periodos])

  const movimientosFiltrados = movimientos.filter((m) => {
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caja</h1>
          <p className="text-sm text-slate-500 mt-0.5">Período {periodoLabel}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span className="hidden sm:inline">Nuevo movimiento</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-green-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresos del mes</p>
            </div>
            <p className="text-2xl font-bold text-green-800">{formatearPeso(totalIngresos)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={16} className="text-red-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Egresos del mes</p>
            </div>
            <p className="text-2xl font-bold text-red-800">{formatearPeso(totalEgresos)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo del mes</p>
            </div>
            <p className={`text-2xl font-bold ${saldoMes >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {formatearPeso(saldoMes)}
            </p>
          </div>
        </div>

        {/* KPIs efectivo */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-slate-400">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresos — Efectivo</p>
            </div>
            <p className="text-xl font-bold text-green-700">{formatearPeso(ingresosEfectivo)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-slate-400">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Egresos — Efectivo</p>
            </div>
            <p className="text-xl font-bold text-red-700">{formatearPeso(egresosEfectivo)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-slate-400">
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-slate-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo — Efectivo</p>
            </div>
            <p className={`text-xl font-bold ${saldoEfectivo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatearPeso(saldoEfectivo)}
            </p>
          </div>
        </div>

        {/* KPIs transferencias */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-blue-400">
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresos — Transf.</p>
            </div>
            <p className="text-xl font-bold text-green-700">{formatearPeso(ingresosTransf)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-blue-400">
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Egresos — Transf.</p>
            </div>
            <p className="text-xl font-bold text-red-700">{formatearPeso(egresosTransf)}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-blue-400">
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo — Transf.</p>
            </div>
            <p className={`text-xl font-bold ${saldoTransf >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatearPeso(saldoTransf)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Flujo de caja — últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={graficoMensual} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [formatearPeso(value)]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Egresos por categoría */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Egresos por categoría (mes)</h3>
          <div className="space-y-3">
            {egresosPorCategoria.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin egresos este mes</p>
            ) : (
              egresosPorCategoria.map(({ categoria, monto }) => {
                const pct = totalEgresos > 0 ? (monto / totalEgresos) * 100 : 0
                return (
                  <div key={categoria}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{categoria}</span>
                      <span className="font-semibold text-slate-800">{formatearPeso(monto)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 mr-auto">Movimientos del mes</h3>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="todos">Todos</option>
              <option value="INGRESO">Solo ingresos</option>
              <option value="EGRESO">Solo egresos</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Fecha</th>
                <th className="table-th">Tipo</th>
                <th className="table-th">Medio</th>
                <th className="table-th">Categoría</th>
                <th className="table-th">Descripción</th>
                <th className="table-th text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-td text-center text-slate-400 py-8">
                    Sin movimientos
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="table-td">{formatearFecha(m.fecha)}</td>
                    <td className="table-td">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.tipo === 'INGRESO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {m.tipo}
                      </span>
                    </td>
                    <td className="table-td">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.medio_pago === 'TRANSFERENCIA'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m.medio_pago === 'TRANSFERENCIA' ? 'Transf.' : 'Efectivo'}
                      </span>
                    </td>
                    <td className="table-td">{m.categoria}</td>
                    <td className="table-td text-slate-500">{m.descripcion ?? '—'}</td>
                    <td
                      className={`table-td text-right font-semibold ${
                        m.tipo === 'INGRESO' ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {m.tipo === 'INGRESO' ? '+' : '-'} {formatearPeso(m.monto)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <NuevoMovimientoModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
