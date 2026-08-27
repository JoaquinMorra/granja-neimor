'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Venta, MetodoPagoCliente } from '@/types'
import { formatearPeso, formatearFecha, hoyISO } from '@/lib/utils'
import { X } from 'lucide-react'

const METODOS: MetodoPagoCliente[] = ['Efectivo', 'Transferencia', 'Cheque', 'Mercado Pago', 'Otro']

type Props = {
  cliente: string
  ventaInicial?: Venta
  onClose: () => void
}

export default function RegistrarPagoModal({ cliente, ventaInicial, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargandoVentas, setCargandoVentas] = useState(true)
  // Se trae directo de la base, sin depender de la lista de ventas de la
  // página (recortada a las 500 más recientes de TODOS los clientes) — si
  // no, un cliente con historial largo puede tener deuda vieja invisible acá.
  const [ventasPendientes, setVentasPendientes] = useState<Venta[]>(ventaInicial ? [ventaInicial] : [])
  const [form, setForm] = useState({
    fecha_pago: hoyISO(),
    metodo: 'Transferencia' as MetodoPagoCliente,
    referencia: '',
    monto: ventaInicial ? ventaInicial.monto_debe.toString() : '',
    notas: '',
  })
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>(
    ventaInicial ? { [ventaInicial.id]: ventaInicial.monto_debe.toString() } : {}
  )

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargandoVentas(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('ventas')
        .select('*')
        .eq('cliente', cliente)
        .gt('monto_debe', 0)
      if (!cancelado) {
        setVentasPendientes(data ?? [])
        setCargandoVentas(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [cliente])

  const deudaTotal = ventasPendientes.reduce((s, v) => s + v.monto_debe, 0)
  const monto = parseFloat(form.monto || '0')
  const totalAsignado = Object.values(asignaciones).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  // "Monto pagado" siempre refleja la suma de lo asignado: si el usuario baja
  // lo que le aplica a una venta puntual (pagó menos de lo que debía), el
  // total pagado tiene que bajar con él. Antes quedaban desincronizados y el
  // pago se guardaba por el monto viejo (más alto) aunque se haya aplicado menos.
  function setAsignacion(ventaId: string, valor: string, maxDebe: number) {
    const num = parseFloat(valor)
    if (valor !== '' && (isNaN(num) || num < 0)) return
    if (num > maxDebe) valor = maxDebe.toString()
    const nuevasAsignaciones = { ...asignaciones, [ventaId]: valor }
    setAsignaciones(nuevasAsignaciones)
    const total = Object.values(nuevasAsignaciones).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    setForm((p) => ({ ...p, monto: total > 0 ? total.toString() : p.monto }))
  }

  function aplicarAutomatico() {
    let restante = monto
    const nuevo: Record<string, string> = {}
    const ordenadas = [...ventasPendientes].sort((a, b) => a.fecha.localeCompare(b.fecha))
    for (const v of ordenadas) {
      if (restante <= 0) break
      const aplicar = Math.min(restante, v.monto_debe)
      if (aplicar > 0) nuevo[v.id] = aplicar.toString()
      restante -= aplicar
    }
    setAsignaciones(nuevo)
    // Si el monto pagado era mayor a toda la deuda pendiente, no queda dónde
    // aplicar la diferencia — se ajusta el monto a lo que realmente se pudo
    // asignar, en vez de guardar un pago más grande que lo que cubre.
    const totalAsignadoNuevo = Object.values(nuevo).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    if (Math.abs(totalAsignadoNuevo - monto) > 0.01) {
      setForm((p) => ({ ...p, monto: totalAsignadoNuevo.toString() }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!monto || monto <= 0) { setError('El monto pagado debe ser mayor a 0.'); return }
    if (Math.abs(totalAsignado - monto) > 0.01) {
      setError('El monto pagado no coincide con lo asignado a las ventas. Usá "Aplicar automático" o ajustá los montos para que coincidan.')
      return
    }

    const asignacionesArray = Object.entries(asignaciones)
      .map(([venta_id, v]) => ({ venta_id, monto_asignado: parseFloat(v || '0') }))
      .filter((a) => a.monto_asignado > 0)

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: err } = await supabase.rpc('registrar_pago', {
      p_cliente: cliente,
      p_fecha_pago: form.fecha_pago,
      p_monto: monto,
      p_metodo: form.metodo,
      p_referencia: form.referencia.trim() || null,
      p_notas: form.notas.trim() || null,
      p_created_by: user?.id ?? null,
      p_asignaciones: asignacionesArray,
    })

    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Registrar pago</h2>
            <p className="text-sm text-slate-500">{cliente} · Deuda actual: {formatearPeso(deudaTotal)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha del pago</label>
              <input type="date" value={form.fecha_pago}
                onChange={(e) => setForm((p) => ({ ...p, fecha_pago: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Método</label>
              <select value={form.metodo}
                onChange={(e) => setForm((p) => ({ ...p, metodo: e.target.value as MetodoPagoCliente }))}
                className="input">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Referencia (opcional)</label>
            <input type="text" value={form.referencia}
              onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))}
              className="input" placeholder="Op. #1234 - Banco X" />
          </div>
          <div>
            <label className="label">Monto pagado</label>
            <input type="number" min="0" step="0.01" value={form.monto}
              onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              className="input" placeholder="0" required />
          </div>

          {cargandoVentas && (
            <p className="text-xs text-slate-400">Cargando ventas pendientes del cliente...</p>
          )}
          {!cargandoVentas && ventasPendientes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Aplicar a</label>
                <button type="button" onClick={aplicarAutomatico}
                  className="text-xs text-blue-600 hover:underline">
                  Aplicar automático (más antigua primero)
                </button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {[...ventasPendientes].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 truncate">{formatearFecha(v.fecha)} · {v.tipo_venta} x{v.cantidad}</p>
                      <p className="text-xs text-slate-500">Debe: {formatearPeso(v.monto_debe)}</p>
                    </div>
                    <input type="number" min="0" max={v.monto_debe} step="0.01"
                      value={asignaciones[v.id] ?? ''}
                      onChange={(e) => setAsignacion(v.id, e.target.value, v.monto_debe)}
                      className="input w-28 text-right" placeholder="0" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Asignado: {formatearPeso(totalAsignado)} de {formatearPeso(monto)}
              </p>
            </div>
          )}

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea value={form.notas}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              className="input resize-none" rows={2} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Confirmar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
