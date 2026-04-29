'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NuevaVentaModal from '@/components/ventas/NuevaVentaModal'
import type { Venta } from '@/types'
import {
  formatearFecha,
  formatearPeso,
  PUNTO_EQUILIBRIO_CAJONES,
} from '@/lib/utils'
import { Plus, CheckCircle, Edit, Trash2 } from 'lucide-react'

type Props = {
  ventas: Venta[]
  ventasMes: { cliente: string; equivalente_huevos: number; estado: string; monto_cobrado: number; monto_debe: number }[]
  clientesExistentes: string[]
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'PAGO') return <span className="badge-pago">PAGO</span>
  if (estado === 'PENDIENTE') return <span className="badge-pendiente">PENDIENTE</span>
  return <span className="badge-parcial">PARCIAL</span>
}

export default function VentasClient({ ventas, ventasMes, clientesExistentes }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<Venta | undefined>()
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [vista, setVista] = useState<'historial' | 'deudas'>('historial')
  const [markingPago, setMarkingPago] = useState<string | null>(null)
  const [pagoModal, setPagoModal] = useState<Venta | null>(null)
  const [montoPago, setMontoPago] = useState('')

  const cajonesVendidosMes = ventasMes.reduce((s, v) => s + v.equivalente_huevos / 360, 0)
  const deudaTotalMes = ventasMes.reduce((s, v) => s + (v.monto_debe ?? 0), 0)
  const ingresadoMes = ventasMes.reduce((s, v) => s + (v.monto_cobrado ?? 0), 0)

  // Deudas por cliente
  const deudasPorCliente = useMemo(() => {
    const mapa = new Map<string, number>()
    ventas
      .filter((v) => v.estado !== 'PAGO' && v.monto_debe > 0)
      .forEach((v) => {
        mapa.set(v.cliente, (mapa.get(v.cliente) ?? 0) + v.monto_debe)
      })
    return Array.from(mapa.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([cliente, total]) => ({ cliente, total }))
  }, [ventas])

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      if (filtroEstado !== 'todos' && v.estado !== filtroEstado) return false
      if (filtroCliente && !v.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false
      if (filtroFechaDesde && v.fecha < filtroFechaDesde) return false
      if (filtroFechaHasta && v.fecha > filtroFechaHasta) return false
      return true
    })
  }, [ventas, filtroEstado, filtroCliente, filtroFechaDesde, filtroFechaHasta])

  function handleEditar(venta: Venta) {
    setVentaEditar(venta)
    setModalOpen(true)
  }

  async function handleEliminar(ventaId: string) {
    if (!confirm('¿Seguro que querés eliminar esta venta?')) return
    const supabase = createClient()
    await supabase.from('ventas').delete().eq('id', ventaId)
    router.refresh()
  }

  function abrirPagoModal(venta: Venta) {
    setPagoModal(venta)
    setMontoPago(venta.monto_debe > 0 ? venta.monto_debe.toString() : '')
  }

  async function confirmarPago() {
    if (!pagoModal) return
    setMarkingPago(pagoModal.id)
    const supabase = createClient()
    const montoNuevo = parseFloat(montoPago || '0')
    await supabase
      .from('ventas')
      .update({
        estado: 'PAGO',
        monto_debe: 0,
        monto_cobrado: pagoModal.monto_cobrado + montoNuevo,
      })
      .eq('id', pagoModal.id)
    setPagoModal(null)
    setMontoPago('')
    setMarkingPago(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de ventas y cobranzas</p>
        </div>
        <button onClick={() => { setVentaEditar(undefined); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span className="hidden sm:inline">Nueva venta</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cajones vendidos (mes)</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{cajonesVendidosMes.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">Punto de equilibrio: {PUNTO_EQUILIBRIO_CAJONES}/sem</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                cajonesVendidosMes >= PUNTO_EQUILIBRIO_CAJONES * 4
                  ? 'bg-green-500'
                  : cajonesVendidosMes >= PUNTO_EQUILIBRIO_CAJONES * 3
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
              style={{ width: `${Math.min((cajonesVendidosMes / (PUNTO_EQUILIBRIO_CAJONES * 4)) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresado (mes)</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{formatearPeso(ingresadoMes)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deuda pendiente total</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{formatearPeso(deudaTotalMes)}</p>
          <p className="text-xs text-slate-500 mt-1">{deudasPorCliente.length} clientes con deuda</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ventas registradas (mes)</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{ventasMes.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setVista('historial')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            vista === 'historial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Historial
        </button>
        <button
          onClick={() => setVista('deudas')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            vista === 'deudas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Deudas por cliente
          {deudasPorCliente.length > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {deudasPorCliente.length}
            </span>
          )}
        </button>
      </div>

      {vista === 'deudas' ? (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Deuda por cliente</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">Cliente</th>
                  <th className="table-th text-right">Monto pendiente</th>
                  <th className="table-th text-right">Ventas pendientes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deudasPorCliente.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-td text-center text-slate-400 py-10">
                      <CheckCircle className="inline-block mb-2 text-green-400" size={28} />
                      <br />No hay deudas pendientes
                    </td>
                  </tr>
                ) : (
                  deudasPorCliente.map(({ cliente, total }) => {
                    const ventasCliente = ventas.filter(
                      (v) => v.cliente === cliente && v.estado !== 'PAGO'
                    ).length
                    return (
                      <tr key={cliente} className="hover:bg-slate-50">
                        <td className="table-td font-medium">{cliente}</td>
                        <td className="table-td text-right font-bold text-red-700">
                          {formatearPeso(total)}
                        </td>
                        <td className="table-td text-right">{ventasCliente} venta{ventasCliente > 1 ? 's' : ''}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Filtros */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-wrap gap-3">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="input w-auto text-sm"
              >
                <option value="todos">Todos los estados</option>
                <option value="PAGO">PAGO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="PARCIAL">PARCIAL</option>
              </select>
              <input
                type="text"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="input w-auto text-sm"
                placeholder="Buscar cliente..."
              />
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="input w-auto text-sm"
              />
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="input w-auto text-sm"
              />
              <span className="text-sm text-slate-500 self-center ml-auto">
                {ventasFiltradas.length} registros
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">Fecha</th>
                  <th className="table-th">Cliente</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th text-right">Cantidad</th>
                  <th className="table-th text-right">Huevos</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Método</th>
                  <th className="table-th text-right">Cobrado</th>
                  <th className="table-th text-right">Debe</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ventasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="table-td text-center text-slate-400 py-8">
                      Sin ventas para los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  ventasFiltradas.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="table-td whitespace-nowrap">{formatearFecha(v.fecha)}</td>
                      <td className="table-td font-medium">{v.cliente}</td>
                      <td className="table-td text-xs">{v.tipo_venta}</td>
                      <td className="table-td text-right">{v.cantidad}</td>
                      <td className="table-td text-right">{v.equivalente_huevos.toLocaleString()}</td>
                      <td className="table-td">
                        <EstadoBadge estado={v.estado} />
                      </td>
                      <td className="table-td text-xs text-slate-500">{v.metodo_pago ?? '—'}</td>
                      <td className="table-td text-right">
                        {v.monto_cobrado > 0 ? formatearPeso(v.monto_cobrado) : '—'}
                      </td>
                      <td className="table-td text-right">
                        {v.monto_debe > 0 ? (
                          <span className="text-red-700 font-semibold">{formatearPeso(v.monto_debe)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          {v.estado !== 'PAGO' && (
                            <button
                              onClick={() => abrirPagoModal(v)}
                              disabled={markingPago === v.id}
                              title="Registrar pago"
                              className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditar(v)}
                            title="Editar"
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleEliminar(v.id)}
                            title="Eliminar"
                            className="text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <NuevaVentaModal
          clientesExistentes={clientesExistentes}
          ventaEditar={ventaEditar}
          onClose={() => { setModalOpen(false); setVentaEditar(undefined) }}
        />
      )}

      {pagoModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setPagoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Registrar pago</h3>
            <p className="text-sm text-slate-500 mb-4">
              {pagoModal.cliente} — {pagoModal.tipo_venta} x{pagoModal.cantidad}
            </p>
            <div className="mb-4">
              <label className="label">Monto cobrado ahora ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                className="input"
                placeholder="0"
                autoFocus
              />
              {pagoModal.monto_cobrado > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Ya cobrado anteriormente: {formatearPeso(pagoModal.monto_cobrado)}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPagoModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={confirmarPago} className="btn-success flex-1">
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
