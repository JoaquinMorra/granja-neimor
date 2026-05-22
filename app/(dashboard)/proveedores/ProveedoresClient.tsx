'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor, TipoProveedor } from '@/types'
import { formatearPeso, formatearFecha, hoyISO } from '@/lib/utils'
import { Plus, X, Truck, AlertCircle } from 'lucide-react'

type ResumenProveedor = {
  proveedor: Proveedor
  saldoPendiente: number
  ultimaCompra: string | null
  ultimoPago: string | null
}

type Props = {
  resumen: ResumenProveedor[]
}

const TIPO_LABELS: Record<TipoProveedor, string> = {
  alimento: 'Alimento',
  maples: 'Maples',
  sanidad: 'Sanidad',
  servicios: 'Servicios',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
}

const TIPO_COLORS: Record<TipoProveedor, string> = {
  alimento: 'bg-amber-100 text-amber-800',
  maples: 'bg-blue-100 text-blue-800',
  sanidad: 'bg-green-100 text-green-800',
  servicios: 'bg-purple-100 text-purple-800',
  mantenimiento: 'bg-slate-100 text-slate-700',
  otros: 'bg-gray-100 text-gray-700',
}

function NuevoProveedorModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    tipo: 'alimento' as TipoProveedor,
    contacto: '',
    notas: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('proveedores').insert({
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      contacto: form.contacto.trim() || null,
      notas: form.notas.trim() || null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Nuevo proveedor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input type="text" value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              className="input" placeholder="Ej: Molino San Jorge" required />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoProveedor }))}
              className="input">
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Contacto (opcional)</label>
            <input type="text" value={form.contacto}
              onChange={(e) => setForm((p) => ({ ...p, contacto: e.target.value }))}
              className="input" placeholder="Teléfono o email..." />
          </div>
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
              {loading ? 'Guardando...' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProveedoresClient({ resumen }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const deudaTotal = resumen.reduce((s, r) => s + r.saldoPendiente, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proveedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Deuda total: {formatearPeso(deudaTotal)}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span className="hidden sm:inline">Nuevo proveedor</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Cards */}
      {resumen.length === 0 ? (
        <div className="card p-12 text-center">
          <Truck size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay proveedores cargados.</p>
          <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">
            Agregar primer proveedor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumen
            .sort((a, b) => b.saldoPendiente - a.saldoPendiente)
            .map(({ proveedor, saldoPendiente, ultimaCompra, ultimoPago }) => (
              <Link
                key={proveedor.id}
                href={`/proveedores/${proveedor.id}`}
                className="card p-5 hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{proveedor.nombre}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${TIPO_COLORS[proveedor.tipo]}`}>
                      {TIPO_LABELS[proveedor.tipo]}
                    </span>
                  </div>
                  {saldoPendiente > 0 && (
                    <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                </div>
                <p className={`text-2xl font-bold ${saldoPendiente > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {formatearPeso(saldoPendiente)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Saldo pendiente</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>Última compra: {ultimaCompra ? formatearFecha(ultimaCompra) : '—'}</span>
                  <span>Último pago: {ultimoPago ? formatearFecha(ultimoPago) : '—'}</span>
                </div>
                {proveedor.contacto && (
                  <p className="text-xs text-slate-400 mt-1">{proveedor.contacto}</p>
                )}
              </Link>
            ))}
        </div>
      )}

      {modalOpen && <NuevoProveedorModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
