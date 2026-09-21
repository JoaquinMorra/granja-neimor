'use client'

import { useMemo, useState } from 'react'
import CuentaCorrienteModal from '@/components/ventas/CuentaCorrienteModal'
import type { SaldoCliente } from '@/types'
import { formatearFecha, formatearPeso } from '@/lib/utils'
import { Search, Wallet, Users } from 'lucide-react'

type Props = {
  saldosClientes: SaldoCliente[]
}

type Filtro = 'todos' | 'con-deuda' | 'al-dia' | 'dormidos'
type Orden = 'nombre' | 'saldo' | 'ultima-venta' | 'total-facturado'

const DORMIDO_DIAS = 30

export default function ClientesClient({ saldosClientes }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [cuentaCorriente, setCuentaCorriente] = useState<string | null>(null)

  const hoy = Date.now()

  const conDeuda = saldosClientes.filter((c) => c.saldo > 0).length
  const dormidos = saldosClientes.filter((c) => esDormido(c, hoy)).length

  const filtrados = useMemo(() => {
    let lista = saldosClientes

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      lista = lista.filter((c) => c.cliente.toLowerCase().includes(q))
    }

    if (filtro === 'con-deuda') lista = lista.filter((c) => c.saldo > 0)
    else if (filtro === 'al-dia') lista = lista.filter((c) => c.saldo <= 0)
    else if (filtro === 'dormidos') lista = lista.filter((c) => esDormido(c, hoy))

    const ordenada = [...lista]
    if (orden === 'nombre') ordenada.sort((a, b) => a.cliente.localeCompare(b.cliente))
    else if (orden === 'saldo') ordenada.sort((a, b) => b.saldo - a.saldo)
    else if (orden === 'ultima-venta') ordenada.sort((a, b) => (b.ultima_venta ?? '').localeCompare(a.ultima_venta ?? ''))
    else if (orden === 'total-facturado') ordenada.sort((a, b) => b.total_facturado - a.total_facturado)

    return ordenada
  }, [saldosClientes, busqueda, filtro, orden, hoy])

  function esDormido(c: SaldoCliente, ahoraMs: number): boolean {
    if (!c.ultima_venta) return true
    const dias = (ahoraMs - new Date(c.ultima_venta + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
    return dias > DORMIDO_DIAS
  }

  const filtroBtn = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      activo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cuenta corriente de cualquier cliente, tenga deuda o no</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 flex items-center gap-2"><Users size={18} className="text-slate-400" />{saldosClientes.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Con deuda</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{conDeuda}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dormidos (+{DORMIDO_DIAS}d)</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{dormidos}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="input pl-9" placeholder="Buscar cliente..." />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFiltro('todos')} className={filtroBtn(filtro === 'todos')}>Todos</button>
              <button onClick={() => setFiltro('con-deuda')} className={filtroBtn(filtro === 'con-deuda')}>Con deuda</button>
              <button onClick={() => setFiltro('al-dia')} className={filtroBtn(filtro === 'al-dia')}>Al día</button>
              <button onClick={() => setFiltro('dormidos')} className={filtroBtn(filtro === 'dormidos')}>Dormidos</button>
            </div>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="input w-auto text-sm ml-auto">
              <option value="nombre">Ordenar por nombre</option>
              <option value="saldo">Ordenar por saldo</option>
              <option value="ultima-venta">Ordenar por última venta</option>
              <option value="total-facturado">Ordenar por total facturado</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Nombre</th>
                <th className="table-th">Última venta</th>
                <th className="table-th text-right">Total facturado</th>
                <th className="table-th text-right">Total cobrado</th>
                <th className="table-th text-right">Saldo actual</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-td text-center text-slate-400 py-10">
                    Sin clientes para los filtros aplicados
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.cliente} onClick={() => setCuentaCorriente(c.cliente)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="table-td font-medium">{c.cliente}</td>
                    <td className="table-td text-xs text-slate-500">{c.ultima_venta ? formatearFecha(c.ultima_venta) : '—'}</td>
                    <td className="table-td text-right">{formatearPeso(c.total_facturado)}</td>
                    <td className="table-td text-right text-green-700">{formatearPeso(c.total_cobrado)}</td>
                    <td className={`table-td text-right font-semibold ${c.saldo > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {formatearPeso(Math.abs(c.saldo))}{c.saldo < 0 ? ' (a favor)' : ''}
                    </td>
                    <td className="table-td text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setCuentaCorriente(c.cliente) }}
                        className="text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center gap-1 text-xs font-medium"
                        title="Ver cuenta corriente"
                      >
                        <Wallet size={14} /> Ver cuenta corriente
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cuentaCorriente && (
        <CuentaCorrienteModal cliente={cuentaCorriente} onClose={() => setCuentaCorriente(null)} />
      )}
    </div>
  )
}
