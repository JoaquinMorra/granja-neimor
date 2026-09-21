'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Venta, Pago, PagoVenta } from '@/types'
import { formatearFecha, formatearPeso } from '@/lib/utils'
import { X, Download } from 'lucide-react'

type Movimiento =
  | { fecha: string; tipo: 'venta'; venta: Venta }
  | { fecha: string; tipo: 'pago'; pago: Pago }

export default function CuentaCorrienteModal({
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
  // ninguna lista recortada de otra página — si no, un cliente con historial
  // largo puede mostrar pagos migrados sin la venta que los originó,
  // descuadrando el saldo.
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

  // El "Haber" de cada pago usa lo efectivamente aplicado a ventas
  // (pagos_ventas.monto_asignado), no el monto bruto del pago — así el
  // saldo de este libro mayor siempre cierra exacto contra ventas.monto_debe,
  // aunque algún pago viejo haya quedado con un resto sin asignar.
  const asignadoPorPago = new Map<string, number>()
  for (const pv of pagosVentas) {
    asignadoPorPago.set(pv.pago_id, (asignadoPorPago.get(pv.pago_id) ?? 0) + pv.monto_asignado)
  }

  const movimientos: Movimiento[] = [
    ...ventasCliente.map((v): Movimiento => ({ fecha: v.fecha, tipo: 'venta', venta: v })),
    ...pagosCliente.map((p): Movimiento => ({ fecha: p.fecha_pago, tipo: 'pago', pago: p })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  let saldo = 0
  const filas = movimientos.map((m) => {
    const debe = m.tipo === 'venta' ? m.venta.monto_cobrado + m.venta.monto_debe : 0
    const haber = m.tipo === 'pago' ? (asignadoPorPago.get(m.pago.id) ?? 0) : 0
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
              <p><span className="text-slate-500">Monto recibido:</span> {formatearPeso(pagoDetalle.monto)}</p>
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
