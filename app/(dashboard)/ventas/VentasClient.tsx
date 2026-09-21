'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NuevaVentaModal from '@/components/ventas/NuevaVentaModal'
import RegistrarPagoModal from '@/components/ventas/RegistrarPagoModal'
import CuentaCorrienteModal from '@/components/ventas/CuentaCorrienteModal'
import type { Venta, Producto, PrecioEspecialCliente, ClienteConfig, SaldoCliente } from '@/types'
import { formatearFecha, formatearPeso, PUNTO_EQUILIBRIO_CAJONES } from '@/lib/utils'
import { Plus, CheckCircle, Edit, Trash2, Banknote } from 'lucide-react'

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
  saldosClientes: SaldoCliente[]
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'PAGO') return <span className="badge-pago">PAGO</span>
  if (estado === 'PENDIENTE') return <span className="badge-pendiente">PENDIENTE</span>
  return <span className="badge-parcial">PARCIAL</span>
}

export default function VentasClient({
  ventas, ventasPeriodo, clientesExistentes, periodoLabel, periodoInicio, periodos,
  productos, preciosEspeciales, clientesConfig, saldosClientes,
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

  // Deudas por cliente: sale de vista_saldos_clientes (sin límite de filas),
  // no de la lista `ventas` de esta página (recortada a las 500 más
  // recientes de TODOS los clientes) — antes eso hacía que un cliente con
  // historial largo apareciera con menos deuda acá que en su cuenta corriente.
  const deudasPorCliente = useMemo(() => {
    return saldosClientes
      .filter((s) => s.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .map((s) => {
        const config = clientesConfig.find((c) => c.cliente === s.cliente)
        const diasDeuda = s.fecha_venta_pendiente_mas_vieja
          ? Math.floor((hoy.getTime() - new Date(s.fecha_venta_pendiente_mas_vieja + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
          : 0
        return {
          cliente: s.cliente,
          total: s.saldo,
          cantidadVentas: s.cantidad_ventas_pendientes,
          diasDeuda,
          limiteCredito: config?.limite_credito ?? null,
          excedeLimite: config?.limite_credito != null && s.saldo > config.limite_credito,
        }
      })
  }, [saldosClientes, clientesConfig, hoy])

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
