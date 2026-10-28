'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Venta } from '@/types'
import { formatearFecha, formatearPeso, PUNTO_EQUILIBRIO_CAJONES } from '@/lib/utils'
import MobileCard from '@/components/ui/MobileCard'
import FilterChips from '@/components/ui/FilterChips'
import FAB from '@/components/ui/FAB'
import BottomSheet from '@/components/ui/BottomSheet'
import { Search, Plus, CheckCircle2, Wallet, Edit, Trash2, CalendarDays } from 'lucide-react'

type Periodo = { inicio: string; fin: string; label: string }

type DeudaCliente = {
  cliente: string
  total: number
  cantidadVentas: number
  diasDeuda: number
  limiteCredito: number | null
  excedeLimite: boolean
}

type Props = {
  ventasFiltradas: Venta[]
  deudasPorCliente: DeudaCliente[]
  cajonesVendidosPeriodo: number
  ingresadoPeriodo: number
  deudaTotalPeriodo: number
  periodoLabel: string
  periodoInicio: string
  periodos: Periodo[]
  filtroEstado: string
  setFiltroEstado: (v: string) => void
  filtroCliente: string
  setFiltroCliente: (v: string) => void
  vista: 'historial' | 'deudas'
  setVista: (v: 'historial' | 'deudas') => void
  onNuevaVenta: () => void
  onEditar: (v: Venta) => void
  onEliminar: (id: string) => void
  onRegistrarPago: (cliente: string, ventaInicial?: Venta) => void
  onVerCuentaCorriente: (cliente: string) => void
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'PAGO') return <span className="badge-pago">PAGO</span>
  if (estado === 'PENDIENTE') return <span className="badge-pendiente">PENDIENTE</span>
  return <span className="badge-parcial">PARCIAL</span>
}

export default function VentasMobileView({
  ventasFiltradas, deudasPorCliente,
  cajonesVendidosPeriodo, ingresadoPeriodo, deudaTotalPeriodo,
  periodoLabel, periodoInicio, periodos,
  filtroEstado, setFiltroEstado, filtroCliente, setFiltroCliente,
  vista, setVista, onNuevaVenta, onEditar, onEliminar, onRegistrarPago, onVerCuentaCorriente,
}: Props) {
  const router = useRouter()
  const [periodoPickerAbierto, setPeriodoPickerAbierto] = useState(false)

  return (
    <div className="lg:hidden space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
          <p className="text-lg font-bold text-blue-900">{cajonesVendidosPeriodo.toFixed(1)}</p>
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Cajones</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
          <p className="text-lg font-bold text-green-700 truncate">{formatearPeso(ingresadoPeriodo)}</p>
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Facturado</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 text-center">
          <p className="text-lg font-bold text-red-700 truncate">{formatearPeso(deudaTotalPeriodo)}</p>
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Pendiente</p>
        </div>
      </div>

      <button
        onClick={() => setPeriodoPickerAbierto(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full"
      >
        <CalendarDays size={13} /> {periodoLabel}
      </button>

      {/* Tabs Ventas / Deudas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
        <button onClick={() => setVista('historial')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            vista === 'historial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}>
          Ventas
        </button>
        <button onClick={() => setVista('deudas')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors relative ${
            vista === 'deudas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}>
          Deudas
          {deudasPorCliente.length > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{deudasPorCliente.length}</span>
          )}
        </button>
      </div>

      {vista === 'historial' ? (
        <>
          {/* Buscador + filtros */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}
              className="input pl-9" placeholder="Buscar cliente..." />
          </div>
          <FilterChips
            opciones={[
              { value: 'todos', label: 'Todas' },
              { value: 'PAGO', label: 'Pagas' },
              { value: 'PENDIENTE', label: 'Pendientes' },
              { value: 'PARCIAL', label: 'Parciales' },
            ]}
            valor={filtroEstado}
            onChange={setFiltroEstado}
          />

          {/* Lista de ventas */}
          <div className="pb-20">
            {ventasFiltradas.length === 0 ? (
              <MobileCard><p className="text-center text-slate-400 py-6">Sin ventas para los filtros aplicados</p></MobileCard>
            ) : (
              ventasFiltradas.map((v) => (
                <MobileCard key={v.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-lg truncate">{v.cliente}</p>
                      <p className="text-sm text-slate-500">{v.cantidad} {v.tipo_venta}</p>
                      <p className="text-xs text-slate-400">{formatearFecha(v.fecha)} · {v.metodo_pago ?? 'sin método'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-800">{formatearPeso(v.monto_cobrado + v.monto_debe)}</p>
                      <div className="mt-1"><EstadoBadge estado={v.estado} /></div>
                    </div>
                  </div>

                  {v.estado !== 'PAGO' && (
                    <button
                      onClick={() => onRegistrarPago(v.cliente, v)}
                      className="w-full mt-3 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-2.5 text-sm"
                    >
                      <CheckCircle2 size={16} /> MARCAR COMO PAGADO
                    </button>
                  )}

                  <div className="flex gap-4 mt-3 pt-2 border-t border-slate-100">
                    <button onClick={() => onVerCuentaCorriente(v.cliente)} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium py-1">
                      <Wallet size={14} /> Cuenta corriente
                    </button>
                    <button onClick={() => onEditar(v)} className="flex items-center gap-1.5 text-sm text-blue-600 font-medium py-1 ml-auto">
                      <Edit size={14} /> Editar
                    </button>
                    <button onClick={() => onEliminar(v.id)} className="flex items-center gap-1.5 text-sm text-red-600 font-medium py-1">
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                </MobileCard>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="pb-20">
          {deudasPorCliente.length === 0 ? (
            <MobileCard>
              <CheckCircle2 className="mx-auto mb-2 text-green-400" size={28} />
              <p className="text-center text-slate-400">No hay deudas pendientes</p>
            </MobileCard>
          ) : (
            deudasPorCliente.map((d) => (
              <MobileCard key={d.cliente} onClick={() => onVerCuentaCorriente(d.cliente)} className={d.excedeLimite ? 'border border-red-200' : ''}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{d.cliente}</p>
                    <p className="text-xs text-slate-400">{d.cantidadVentas} venta{d.cantidadVentas !== 1 ? 's' : ''} · {d.diasDeuda} días</p>
                  </div>
                  <p className="font-bold text-red-700 text-lg">{formatearPeso(d.total)}</p>
                </div>
                {d.excedeLimite && (
                  <p className="text-xs text-red-600 font-medium mt-1">⚠️ Supera el límite de crédito ({formatearPeso(d.limiteCredito!)})</p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onRegistrarPago(d.cliente) }}
                  className="w-full mt-3 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-2.5 text-sm"
                >
                  <CheckCircle2 size={16} /> REGISTRAR PAGO
                </button>
              </MobileCard>
            ))
          )}
        </div>
      )}

      <FAB onClick={onNuevaVenta} icon={<Plus size={26} />} label="Nueva venta" />

      <BottomSheet abierto={periodoPickerAbierto} onClose={() => setPeriodoPickerAbierto(false)} titulo="Elegir período">
        <div className="space-y-1">
          {[...periodos].reverse().map((p) => (
            <button
              key={p.inicio}
              onClick={() => { setPeriodoPickerAbierto(false); router.push(`/ventas?periodo=${p.inicio}`) }}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium ${
                p.inicio === periodoInicio ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
