'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NuevaVentaModal from '@/components/ventas/NuevaVentaModal'
import RegistrarPagoModal from '@/components/ventas/RegistrarPagoModal'
import type { Venta, Producto, PrecioEspecialCliente, ClienteConfig, Pago, PagoVenta } from '@/types'
import { formatearFecha, formatearPeso, PUNTO_EQUILIBRIO_CAJONES } from '@/lib/utils'
import { Plus, CheckCircle, Edit, Trash2, X, Download, Banknote } from 'lucide-react'

type Periodo = { inicio: string; fin: string; label: string }

type Props = {
  ventas: Venta[]
  ventasPeriodo: { cliente: string; equivalente_huevos: number; estado: string; monto_cobrado: number; monto_debe: number }[]
  clientesExistentes: string[]
  periodoLabel: string
  periodoInicio: string
  periodos: Periodo[]
  productos: Producto[]
  preciosEspeciales: (PrecioEspecialCliente & { producto?: { codigo: string } })[]
  clientesConfig: ClienteConfig[]
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'PAGO') return <span className="badge-pago">PAGO</span>
  if (estado === 'PENDIENTE') return <span className="badge-pendiente">PENDIENTE</span>
  return <span className="badge-parcial">PARCIAL</span>
}

type Movimiento =
  | { fecha: string; tipo: 'venta'; venta: Venta }
  | { fecha: string; tipo: 'pago'; pago: Pago }

function CuentaCorrienteModal({
  cliente, onClose,
}: {
  cliente: string
  onClose: () => void
}) {
  const [rango, setRango] = useState<'30' | '90' | 'todo'>('90')
  const [pagoDetalle, setPagoDetalle] = useState<Pago | null>(null)
  const [loading, setLoading] = useState(true)
  const [ventasCliente, setVentasCliente] = useState<Venta[]>([])
  const [pagosCliente, setPagosCliente] = useState<Pago[]>([])
  const [pagosVentas, setPagosVentas] = useState<PagoVenta[]>([])

  // Se trae el historial completo de ESTE cliente puntual, sin depender de
  // la lista de ventas de la página (recortada a las 500 más recientes de
  // TODOS los clientes) — si no, un cliente con historial largo puede
  // mostrar pagos migrados sin la venta que los originó, descuadrando el saldo.
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setLoading(true)
      const supabase = createClient()
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from('ventas').select('*').eq('cliente', cliente),
        supabase.from('pagos').select('*').eq('cliente', cliente),
      ])
      if (cancelado) return
      const pagosIds = (p ?? []).map((pago) => pago.id)
      const { data: pv } = pagosIds.length > 0
        ? await supabase.from('pagos_ventas').select('*').in('pago_id', pagosIds)
        : { data: [] }
      if (cancelado) return
      setVentasCliente(v ?? [])
      setPagosCliente(p ?? [])
      setPagosVentas(pv ?? [])
      setLoading(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [cliente])

  const movimientos: Movimiento[] = [
    ...ventasCliente.map((v): Movimiento => ({ fecha: v.fecha, tipo: 'venta', venta: v })),
    ...pagosCliente.map((p): Movimiento => ({ fecha: p.fecha_pago, tipo: 'pago', pago: p })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  let saldo = 0
  const filas = movimientos.map((m) => {
    const debe = m.tipo === 'venta' ? m.venta.monto_cobrado + m.venta.monto_debe : 0
    const haber = m.tipo === 'pago' ? m.pago.monto : 0
    saldo += debe - haber
    return { ...m, debe, haber, saldo }
  })

  const cutoff = rango === 'todo' ? null : new Date(Date.now() - Number(rango) * 86400000).toISOString().slice(0, 10)
  const primerVisibleIdx = cutoff ? filas.findIndex((f) => f.fecha >= cutoff) : 0
  const filasVisibles = primerVisibleIdx === -1 ? [] : filas.slice(primerVisibleIdx)
  const saldoAnterior = primerVisibleIdx > 0 ? filas[primerVisibleIdx - 1].saldo : 0

  const saldoActual = filas.length > 0 ? filas[filas.length - 1].saldo : 0

  const ventasDelPagoDetalle = pagoDetalle
    ? pagosVentas
        .filter((pv) => pv.pago_id === pagoDetalle.id)
        .map((pv) => ({ pv, venta: ventasCliente.find((v) => v.id === pv.venta_id) }))
    : []

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Cuenta corriente — {cliente}</h2>
            <p className="text-sm text-slate-500">Saldo actual: <span className={saldoActual > 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>{formatearPeso(Math.abs(saldoActual))}{saldoActual < 0 ? ' (a favor)' : ''}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <a href={`/ventas/cuenta-corriente/${encodeURIComponent(cliente)}/pdf`} target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <Download size={14} /> Descargar PDF
            </a>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
        </div>
        <div className="px-6 pt-4">
          <select value={rango} onChange={(e) => setRango(e.target.value as typeof rango)} className="input w-auto text-sm">
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="todo">Todo</option>
          </select>
        </div>
        <div className="overflow-auto flex-1 p-6 pt-3">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-100">
                <th className="table-th">Fecha</th>
                <th className="table-th">Detalle</th>
                <th className="table-th text-right">Debe</th>
                <th className="table-th text-right">Haber</th>
                <th className="table-th text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="table-td text-center text-slate-400 py-8">Cargando historial completo del cliente...</td>
                </tr>
              ) : (
                <>
                  {primerVisibleIdx > 0 && (
                    <tr className="bg-slate-50">
                      <td className="table-td text-xs text-slate-500" colSpan={4}>Saldo anterior</td>
                      <td className={`table-td text-right font-semibold ${saldoAnterior > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {formatearPeso(Math.abs(saldoAnterior))}{saldoAnterior < 0 ? ' (a favor)' : ''}
                      </td>
                    </tr>
                  )}
                  {filasVisibles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="table-td text-center text-slate-400 py-8">Sin movimientos en el período</td>
                    </tr>
                  ) : (
                    filasVisibles.map((f, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-slate-50 ${f.tipo === 'pago' ? 'cursor-pointer' : ''}`}
                        onClick={() => f.tipo === 'pago' && setPagoDetalle(f.pago)}
                      >
                        <td className="table-td whitespace-nowrap">{formatearFecha(f.fecha)}</td>
                        <td className="table-td text-xs">
                          {f.tipo === 'venta'
                            ? `Venta ${f.venta.tipo_venta} x${f.venta.cantidad}`
                            : `Pago ${f.pago.metodo}${f.pago.referencia ? ' — ' + f.pago.referencia : ''}`}
                        </td>
                        <td className="table-td text-right text-red-700">{f.debe > 0 ? formatearPeso(f.debe) : '—'}</td>
                        <td className="table-td text-right text-green-700">{f.haber > 0 ? formatearPeso(f.haber) : '—'}</td>
                        <td className={`table-td text-right font-semibold ${f.saldo > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {formatearPeso(Math.abs(f.saldo))}{f.saldo < 0 ? ' (a favor)' : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagoDetalle && (
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); e.target === e.currentTarget && setPagoDetalle(null) }}>
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Detalle del pago</h3>
              <button onClick={() => setPagoDetalle(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-2 text-sm">
              <p><span className="text-slate-500">Fecha:</span> {formatearFecha(pagoDetalle.fecha_pago)}</p>
              <p><span className="text-slate-500">Método:</span> {pagoDetalle.metodo}</p>
              <p><span className="text-slate-500">Referencia:</span> {pagoDetalle.referencia ?? '—'}</p>
              <p><span className="text-slate-500">Monto:</span> {formatearPeso(pagoDetalle.monto)}</p>
              {pagoDetalle.notas && <p><span className="text-slate-500">Notas:</span> {pagoDetalle.notas}</p>}
              <div className="pt-2 border-t border-slate-100 mt-2">
                <p className="text-slate-500 mb-1">Aplicado a:</p>
                {ventasDelPagoDetalle.length === 0 ? (
                  <p className="text-slate-400 text-xs">Sin ventas asociadas</p>
                ) : (
                  <ul className="space-y-1">
                    {ventasDelPagoDetalle.map(({ pv, venta }) => (
                      <li key={pv.id} className="text-xs text-slate-600">
                        {venta ? `${formatearFecha(venta.fecha)} · ${venta.tipo_venta} x${venta.cantidad}` : 'Venta eliminada'} — {formatearPeso(pv.monto_asignado)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VentasClient({
  ventas, ventasPeriodo, clientesExistentes, periodoLabel, periodoInicio, periodos,
  productos, preciosEspeciales, clientesConfig,
}: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [ventaEditar, setVentaEditar] = useState<Venta | undefined>()
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [vista, setVista] = useState<'historial' | 'deudas'>('historial')
  const [pagoParaCliente, setPagoParaCliente] = useState<{ cliente: string; ventaInicial?: Venta } | null>(null)
  const [cuentaCorriente, setCuentaCorriente] = useState<string | null>(null)

  const cajonesVendidosPeriodo = ventasPeriodo.reduce((s, v) => s + v.equivalente_huevos / 360, 0)
  const deudaTotalPeriodo = ventasPeriodo.reduce((s, v) => s + (v.monto_debe ?? 0), 0)
  const ingresadoPeriodo = ventasPeriodo.reduce((s, v) => s + (v.monto_cobrado ?? 0), 0)

  const hoy = new Date()

  // Deudas por cliente con datos extra
  const deudasPorCliente = useMemo(() => {
    const mapa = new Map<string, { total: number; ventasMasVieja: string | null; cantidadVentas: number }>()
    ventas
      .filter((v) => v.estado !== 'PAGO' && v.monto_debe > 0)
      .forEach((v) => {
        const actual = mapa.get(v.cliente)
        const masVieja = actual?.ventasMasVieja
          ? (v.fecha < actual.ventasMasVieja ? v.fecha : actual.ventasMasVieja)
          : v.fecha
        mapa.set(v.cliente, {
          total: (actual?.total ?? 0) + v.monto_debe,
          ventasMasVieja: masVieja,
          cantidadVentas: (actual?.cantidadVentas ?? 0) + 1,
        })
      })
    return Array.from(mapa.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([cliente, data]) => {
        const config = clientesConfig.find((c) => c.cliente === cliente)
        const diasDeuda = data.ventasMasVieja
          ? Math.floor((hoy.getTime() - new Date(data.ventasMasVieja + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
          : 0
        return {
          cliente,
          total: data.total,
          cantidadVentas: data.cantidadVentas,
          diasDeuda,
          limiteCredito: config?.limite_credito ?? null,
          excedeLimite: config?.limite_credito != null && data.total > config.limite_credito,
        }
      })
  }, [ventas, clientesConfig, hoy])

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
          <select
            value={periodoInicio}
            onChange={(e) => router.push(`/ventas?periodo=${e.target.value}`)}
            className="input w-auto text-sm"
          >
            {[...periodos].reverse().map((p) => (
              <option key={p.inicio} value={p.inicio}>{p.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => { setVentaEditar(undefined); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span className="hidden sm:inline">Nueva venta</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cajones vendidos (período)</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{cajonesVendidosPeriodo.toFixed(1)}</p>
          <p className="text-xs text-slate-500 mt-1">Punto de equilibrio: {PUNTO_EQUILIBRIO_CAJONES}/sem</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                cajonesVendidosPeriodo >= PUNTO_EQUILIBRIO_CAJONES * 4 ? 'bg-green-500'
                : cajonesVendidosPeriodo >= PUNTO_EQUILIBRIO_CAJONES * 3 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min((cajonesVendidosPeriodo / (PUNTO_EQUILIBRIO_CAJONES * 4)) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresado (período)</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{formatearPeso(ingresadoPeriodo)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deuda pendiente (período)</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{formatearPeso(deudaTotalPeriodo)}</p>
          <p className="text-xs text-slate-500 mt-1">{deudasPorCliente.length} clientes con deuda</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ventas registradas (período)</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{ventasPeriodo.length}</p>
          <p className="text-xs text-slate-500 mt-1">{periodoLabel}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setVista('historial')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            vista === 'historial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}>
          Historial
        </button>
        <button onClick={() => setVista('deudas')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            vista === 'deudas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}>
          Deudas por cliente
          {deudasPorCliente.length > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {deudasPorCliente.length}
            </span>
          )}
        </button>
      </div>

      {/* Vista: Deudas por cliente */}
      {vista === 'deudas' && (
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
                  <th className="table-th text-right">Ventas</th>
                  <th className="table-th text-right">Días deuda</th>
                  <th className="table-th text-right">Límite crédito</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deudasPorCliente.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-td text-center text-slate-400 py-10">
                      <CheckCircle className="inline-block mb-2 text-green-400" size={28} />
                      <br />No hay deudas pendientes
                    </td>
                  </tr>
                ) : (
                  deudasPorCliente.map(({ cliente, total, cantidadVentas, diasDeuda, limiteCredito, excedeLimite }) => (
                    <tr
                      key={cliente}
                      onClick={() => setCuentaCorriente(cliente)}
                      className={`cursor-pointer hover:bg-slate-50 ${excedeLimite ? 'bg-red-50' : ''}`}
                    >
                      <td className="table-td font-medium">{cliente}</td>
                      <td className={`table-td text-right font-bold ${excedeLimite ? 'text-red-700' : 'text-red-700'}`}>
                        {formatearPeso(total)}
                      </td>
                      <td className="table-td text-right">{cantidadVentas}</td>
                      <td className={`table-td text-right ${diasDeuda > 30 ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                        {diasDeuda} días
                      </td>
                      <td className="table-td text-right text-slate-500">
                        {limiteCredito != null ? (
                          <span className={excedeLimite ? 'text-red-600 font-semibold' : ''}>
                            {formatearPeso(limiteCredito)}
                            {excedeLimite && ' ⚠️'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="table-td text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPagoParaCliente({ cliente }) }}
                          title="Registrar pago"
                          className="text-slate-400 hover:text-green-600 transition-colors"
                        >
                          <Banknote size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista: Historial */}
      {vista === 'historial' && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-wrap gap-3">
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto text-sm">
                <option value="todos">Todos los estados</option>
                <option value="PAGO">PAGO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="PARCIAL">PARCIAL</option>
              </select>
              <input type="text" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}
                className="input w-auto text-sm" placeholder="Buscar cliente..." />
              <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} className="input w-auto text-sm" />
              <input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} className="input w-auto text-sm" />
              <span className="text-sm text-slate-500 self-center ml-auto">{ventasFiltradas.length} registros</span>
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
                    <td colSpan={10} className="table-td text-center text-slate-400 py-8">Sin ventas para los filtros aplicados</td>
                  </tr>
                ) : (
                  ventasFiltradas.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="table-td whitespace-nowrap">{formatearFecha(v.fecha)}</td>
                      <td className="table-td font-medium">{v.cliente}</td>
                      <td className="table-td text-xs">
                        {v.tipo_venta}
                        {v.precio_modificado && (
                          <span className="ml-1 text-amber-500" title={`Motivo: ${v.motivo_precio}`}>★</span>
                        )}
                      </td>
                      <td className="table-td text-right">{v.cantidad}</td>
                      <td className="table-td text-right">{v.equivalente_huevos.toLocaleString()}</td>
                      <td className="table-td"><EstadoBadge estado={v.estado} /></td>
                      <td className="table-td text-xs text-slate-500">{v.metodo_pago ?? '—'}</td>
                      <td className="table-td text-right">{v.monto_cobrado > 0 ? formatearPeso(v.monto_cobrado) : '—'}</td>
                      <td className="table-td text-right">
                        {v.monto_debe > 0
                          ? <span className="text-red-700 font-semibold">{formatearPeso(v.monto_debe)}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          {v.estado !== 'PAGO' && (
                            <button onClick={() => setPagoParaCliente({ cliente: v.cliente, ventaInicial: v })}
                              title="Registrar pago" className="text-green-600 hover:text-green-800 transition-colors">
                              <CheckCircle size={16} />
                            </button>
                          )}
                          <button onClick={() => handleEditar(v)} title="Editar"
                            className="text-slate-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                          <button onClick={() => handleEliminar(v.id)} title="Eliminar"
                            className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
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

      {/* Modal nueva venta */}
      {modalOpen && (
        <NuevaVentaModal
          clientesExistentes={clientesExistentes}
          ventaEditar={ventaEditar}
          onClose={() => { setModalOpen(false); setVentaEditar(undefined) }}
          productos={productos}
          preciosEspeciales={preciosEspeciales}
        />
      )}

      {/* Modal registrar pago */}
      {pagoParaCliente && (
        <RegistrarPagoModal
          cliente={pagoParaCliente.cliente}
          ventaInicial={pagoParaCliente.ventaInicial}
          onClose={() => setPagoParaCliente(null)}
        />
      )}

      {/* Modal cuenta corriente */}
      {cuentaCorriente && (
        <CuentaCorrienteModal
          cliente={cuentaCorriente}
          onClose={() => setCuentaCorriente(null)}
        />
      )}
    </div>
  )
}
