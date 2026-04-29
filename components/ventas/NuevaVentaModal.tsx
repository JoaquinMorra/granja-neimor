'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { TipoVenta, MetodoPago, EstadoVenta, Venta } from '@/types'
import { TIPOS_VENTA, calcularEquivalenteHuevos, hoyISO } from '@/lib/utils'

type Props = {
  clientesExistentes: string[]
  ventaEditar?: Venta
  onClose: () => void
}

export default function NuevaVentaModal({ clientesExistentes, ventaEditar, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clienteSugerencias, setClienteSugerencias] = useState<string[]>([])

  const [form, setForm] = useState({
    fecha: ventaEditar?.fecha ?? hoyISO(),
    cliente: ventaEditar?.cliente ?? '',
    tipo_venta: ventaEditar?.tipo_venta ?? ('CAJON' as TipoVenta),
    cantidad: ventaEditar?.cantidad?.toString() ?? '',
    estado: ventaEditar?.estado ?? ('PENDIENTE' as EstadoVenta),
    metodo_pago: ventaEditar?.metodo_pago ?? ('' as MetodoPago | ''),
    monto_cobrado: ventaEditar?.monto_cobrado?.toString() ?? '',
    monto_debe: ventaEditar?.monto_debe?.toString() ?? '',
    notas: ventaEditar?.notas ?? '',
  })

  const equivalenteHuevos = form.cantidad
    ? calcularEquivalenteHuevos(form.tipo_venta, parseFloat(form.cantidad))
    : 0

  function handleClienteChange(val: string) {
    setForm((prev) => ({ ...prev, cliente: val }))
    if (val.length >= 2) {
      setClienteSugerencias(
        clientesExistentes
          .filter((c) => c.toLowerCase().includes(val.toLowerCase()))
          .slice(0, 5)
      )
    } else {
      setClienteSugerencias([])
    }
  }

  function handleUpdate(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!form.cliente.trim()) {
      setError('El cliente es obligatorio.')
      setLoading(false)
      return
    }
    if (!form.cantidad || parseFloat(form.cantidad) <= 0) {
      setError('La cantidad debe ser mayor a 0.')
      setLoading(false)
      return
    }

    const payload = {
      fecha: form.fecha,
      cliente: form.cliente.trim(),
      tipo_venta: form.tipo_venta,
      cantidad: parseFloat(form.cantidad),
      equivalente_huevos: equivalenteHuevos,
      estado: form.estado,
      metodo_pago: form.metodo_pago || null,
      monto_cobrado: parseFloat(form.monto_cobrado || '0'),
      monto_debe: form.estado === 'PAGO' ? 0 : parseFloat(form.monto_debe || '0'),
      notas: form.notas || null,
    }

    const supabase = createClient()
    const { error: err } = ventaEditar
      ? await supabase.from('ventas').update(payload).eq('id', ventaEditar.id)
      : await supabase.from('ventas').insert(payload)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

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
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => handleUpdate('fecha', e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="relative">
              <label className="label">Cliente</label>
              <input
                type="text"
                value={form.cliente}
                onChange={(e) => handleClienteChange(e.target.value)}
                className="input"
                placeholder="Nombre del cliente"
                autoComplete="off"
              />
              {clienteSugerencias.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 overflow-hidden">
                  {clienteSugerencias.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, cliente: c }))
                        setClienteSugerencias([])
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de venta</label>
              <select
                value={form.tipo_venta}
                onChange={(e) => handleUpdate('tipo_venta', e.target.value)}
                className="input"
              >
                {TIPOS_VENTA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.cantidad}
                onChange={(e) => handleUpdate('cantidad', e.target.value)}
                className="input"
                placeholder="0"
                required
              />
              {equivalenteHuevos > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  = {equivalenteHuevos.toLocaleString('es-AR')} huevos
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estado de pago</label>
              <select
                value={form.estado}
                onChange={(e) => handleUpdate('estado', e.target.value)}
                className="input"
              >
                <option value="PAGO">PAGO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="PARCIAL">PARCIAL</option>
              </select>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select
                value={form.metodo_pago}
                onChange={(e) => handleUpdate('metodo_pago', e.target.value)}
                className="input"
              >
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
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monto_cobrado}
                onChange={(e) => handleUpdate('monto_cobrado', e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Monto debe ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.estado === 'PAGO' ? '0' : form.monto_debe}
                onChange={(e) => handleUpdate('monto_debe', e.target.value)}
                className="input"
                placeholder="0"
                readOnly={form.estado === 'PAGO'}
              />
              {form.estado === 'PAGO' && (
                <p className="text-xs text-green-600 mt-1">Pago completo</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              value={form.notas}
              onChange={(e) => handleUpdate('notas', e.target.value)}
              className="input resize-none"
              rows={2}
              placeholder="Observaciones..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : ventaEditar ? 'Guardar cambios' : 'Registrar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
