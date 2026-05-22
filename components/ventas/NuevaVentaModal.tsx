'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, AlertTriangle } from 'lucide-react'
import type { TipoVenta, MetodoPago, EstadoVenta, Venta, Producto, PrecioEspecialCliente } from '@/types'
import { calcularEquivalenteHuevos, hoyISO, CODIGO_A_TIPO_VENTA } from '@/lib/utils'

type Props = {
  clientesExistentes: string[]
  ventaEditar?: Venta
  onClose: () => void
  productos: Producto[]
  preciosEspeciales: (PrecioEspecialCliente & { producto?: { codigo: string } })[]
}

export default function NuevaVentaModal({ clientesExistentes, ventaEditar, onClose, productos, preciosEspeciales }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clienteSugerencias, setClienteSugerencias] = useState<string[]>([])

  // Al editar, detectar el producto por tipo_venta si no viene producto_id
  const productoInicial = ventaEditar?.producto_id
    ? productos.find((p) => p.id === ventaEditar.producto_id)
    : productos.find((p) => CODIGO_A_TIPO_VENTA[p.codigo] === ventaEditar?.tipo_venta)

  const [form, setForm] = useState({
    fecha: ventaEditar?.fecha ?? hoyISO(),
    cliente: ventaEditar?.cliente ?? '',
    producto_id: productoInicial?.id ?? (productos[0]?.id ?? ''),
    cantidad: ventaEditar?.cantidad?.toString() ?? '',
    estado: ventaEditar?.estado ?? ('PENDIENTE' as EstadoVenta),
    metodo_pago: ventaEditar?.metodo_pago ?? ('' as MetodoPago | ''),
    monto_cobrado: ventaEditar?.monto_cobrado?.toString() ?? '',
    monto_debe: ventaEditar?.monto_debe?.toString() ?? '',
    notas: ventaEditar?.notas ?? '',
    motivo_precio: ventaEditar?.motivo_precio ?? '',
  })

  const [precioManual, setPrecioManual] = useState<string>(
    ventaEditar?.precio_unitario?.toString() ?? ''
  )
  const [precioModificado, setPrecioModificado] = useState(ventaEditar?.precio_modificado ?? false)

  const productoSeleccionado = productos.find((p) => p.id === form.producto_id)

  // Precio oficial: especial vigente > mayorista
  const hoy = hoyISO()
  const precioEspecialVigente = productoSeleccionado
    ? preciosEspeciales.find(
        (pe) =>
          pe.cliente.toLowerCase() === form.cliente.toLowerCase() &&
          pe.producto_id === form.producto_id &&
          pe.vigente_desde <= hoy &&
          (!pe.vigente_hasta || pe.vigente_hasta >= hoy)
      )
    : undefined

  const precioOficial = precioEspecialVigente?.precio ?? productoSeleccionado?.precio_mayorista ?? 0
  const precioActual = parseFloat(precioManual || '0')
  const deltaAbs = precioOficial > 0 ? Math.abs(precioActual - precioOficial) / precioOficial : 0
  const deltaSigno = precioActual - precioOficial
  const requiereMotivo = precioManual !== '' && deltaAbs > 0.10 && precioActual !== precioOficial

  // Cuando cambia cliente o producto, auto-completar precio
  useEffect(() => {
    if (!productoSeleccionado) return
    const hoy = hoyISO()
    const especial = preciosEspeciales.find(
      (pe) =>
        pe.cliente.toLowerCase() === form.cliente.toLowerCase() &&
        pe.producto_id === form.producto_id &&
        pe.vigente_desde <= hoy &&
        (!pe.vigente_hasta || pe.vigente_hasta >= hoy)
    )
    const precio = especial?.precio ?? productoSeleccionado.precio_mayorista
    setPrecioManual(precio.toString())
    setPrecioModificado(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cliente, form.producto_id])

  const tipoVenta = productoSeleccionado
    ? (CODIGO_A_TIPO_VENTA[productoSeleccionado.codigo] as TipoVenta | undefined) ?? productoSeleccionado.codigo as TipoVenta
    : 'CAJON' as TipoVenta

  const equivalenteHuevos = form.cantidad && productoSeleccionado
    ? calcularEquivalenteHuevos(tipoVenta, parseFloat(form.cantidad))
    : 0

  function handleClienteChange(val: string) {
    setForm((prev) => ({ ...prev, cliente: val }))
    if (val.length >= 2) {
      setClienteSugerencias(
        clientesExistentes.filter((c) => c.toLowerCase().includes(val.toLowerCase())).slice(0, 5)
      )
    } else {
      setClienteSugerencias([])
    }
  }

  function handlePrecioChange(val: string) {
    setPrecioManual(val)
    setPrecioModificado(val !== '' && parseFloat(val) !== precioOficial)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!form.cliente.trim()) { setError('El cliente es obligatorio.'); setLoading(false); return }
    if (!form.cantidad || parseFloat(form.cantidad) <= 0) { setError('La cantidad debe ser mayor a 0.'); setLoading(false); return }
    if (!precioManual || parseFloat(precioManual) <= 0) { setError('El precio unitario es obligatorio.'); setLoading(false); return }
    if (requiereMotivo && !form.motivo_precio.trim()) {
      setError(`El precio difiere más de 10% del oficial (${formatearPesoSimple(precioOficial)}). Ingresá un motivo.`)
      setLoading(false)
      return
    }

    const payload = {
      fecha: form.fecha,
      cliente: form.cliente.trim(),
      tipo_venta: tipoVenta,
      cantidad: parseFloat(form.cantidad),
      equivalente_huevos: equivalenteHuevos,
      estado: form.estado,
      metodo_pago: form.metodo_pago || null,
      monto_cobrado: parseFloat(form.monto_cobrado || '0'),
      monto_debe: form.estado === 'PAGO' ? 0 : parseFloat(form.monto_debe || '0'),
      notas: form.notas || null,
      producto_id: form.producto_id || null,
      precio_unitario: parseFloat(precioManual),
      precio_oficial: precioOficial,
      precio_modificado: precioModificado,
      motivo_precio: (requiereMotivo && form.motivo_precio.trim()) ? form.motivo_precio.trim() : null,
    }

    const supabase = createClient()
    const { error: err } = ventaEditar
      ? await supabase.from('ventas').update(payload).eq('id', ventaEditar.id)
      : await supabase.from('ventas').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {ventaEditar ? 'Editar venta' : 'Nueva venta'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input" required />
            </div>
            <div className="relative">
              <label className="label">Cliente</label>
              <input type="text" value={form.cliente}
                onChange={(e) => handleClienteChange(e.target.value)}
                className="input" placeholder="Nombre del cliente" autoComplete="off" />
              {clienteSugerencias.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 overflow-hidden">
                  {clienteSugerencias.map((c) => (
                    <button key={c} type="button"
                      onClick={() => { setForm((p) => ({ ...p, cliente: c })); setClienteSugerencias([]) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Producto</label>
              <select value={form.producto_id}
                onChange={(e) => setForm((p) => ({ ...p, producto_id: e.target.value }))}
                className="input" required>
                {productos.length === 0 && <option value="">Sin productos cargados</option>}
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input type="number" step="0.5" min="0" value={form.cantidad}
                onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))}
                className="input" placeholder="0" required />
              {equivalenteHuevos > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  = {equivalenteHuevos.toLocaleString('es-AR')} huevos
                </p>
              )}
            </div>
          </div>

          {/* Precio */}
          <div>
            <label className="label">Precio unitario ($)</label>
            <input type="number" min="0" step="any" value={precioManual}
              onChange={(e) => handlePrecioChange(e.target.value)}
              className={`input ${precioModificado ? 'border-amber-400 focus:ring-amber-400' : ''}`}
              placeholder="0" />
            <div className="flex items-center gap-2 mt-1">
              {precioEspecialVigente ? (
                <p className="text-xs text-blue-600">Precio especial vigente: {formatearPesoSimple(precioEspecialVigente.precio)}</p>
              ) : productoSeleccionado ? (
                <p className="text-xs text-slate-500">Precio mayorista: {formatearPesoSimple(productoSeleccionado.precio_mayorista)}</p>
              ) : null}
              {precioManual && precioActual !== precioOficial && (
                <p className={`text-xs ml-auto ${deltaSigno < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {deltaSigno > 0 ? '+' : ''}{formatearPesoSimple(deltaSigno)} ({(deltaAbs * 100).toFixed(1)}%)
                </p>
              )}
            </div>
          </div>

          {requiereMotivo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-600" />
                <p className="text-xs font-medium text-amber-800">Precio fuera de política ({(deltaAbs * 100).toFixed(1)}% de diferencia). Ingresá un motivo.</p>
              </div>
              <input type="text" value={form.motivo_precio}
                onChange={(e) => setForm((p) => ({ ...p, motivo_precio: e.target.value }))}
                className="input text-sm" placeholder="Motivo del precio especial..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estado de pago</label>
              <select value={form.estado}
                onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as EstadoVenta }))}
                className="input">
                <option value="PAGO">PAGO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="PARCIAL">PARCIAL</option>
              </select>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select value={form.metodo_pago}
                onChange={(e) => setForm((p) => ({ ...p, metodo_pago: e.target.value as MetodoPago | '' }))}
                className="input">
                <option value="">Sin especificar</option>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                <option value="EFECTIVO-TRANSF">EFECTIVO-TRANSF</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monto cobrado ($)</label>
              <input type="number" min="0" step="0.01" value={form.monto_cobrado}
                onChange={(e) => setForm((p) => ({ ...p, monto_cobrado: e.target.value }))}
                className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Monto debe ($)</label>
              <input type="number" min="0" step="0.01"
                value={form.estado === 'PAGO' ? '0' : form.monto_debe}
                onChange={(e) => setForm((p) => ({ ...p, monto_debe: e.target.value }))}
                className="input" placeholder="0"
                readOnly={form.estado === 'PAGO'} />
              {form.estado === 'PAGO' && (
                <p className="text-xs text-green-600 mt-1">Pago completo</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea value={form.notas}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              className="input resize-none" rows={2} placeholder="Observaciones..." />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : ventaEditar ? 'Guardar cambios' : 'Registrar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatearPesoSimple(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
