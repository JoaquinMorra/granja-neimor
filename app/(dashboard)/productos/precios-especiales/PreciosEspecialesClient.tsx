'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PrecioEspecialCliente } from '@/types'
import { formatearPeso, formatearFecha, hoyISO } from '@/lib/utils'
import { Plus, X, ArrowLeft, Trash2, Edit } from 'lucide-react'

type ProductoMin = { id: string; codigo: string; nombre: string }
type Props = {
  precios: (PrecioEspecialCliente & { producto: ProductoMin | null })[]
  productos: ProductoMin[]
  clientesExistentes: string[]
}

function PrecioModal({
  precio,
  productos,
  clientesExistentes,
  onClose,
}: {
  precio?: PrecioEspecialCliente & { producto: ProductoMin | null }
  productos: ProductoMin[]
  clientesExistentes: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clienteSug, setClienteSug] = useState<string[]>([])
  const [form, setForm] = useState({
    cliente: precio?.cliente ?? '',
    producto_id: precio?.producto_id ?? (productos[0]?.id ?? ''),
    precio: precio?.precio?.toString() ?? '',
    motivo: precio?.motivo ?? '',
    vigente_desde: precio?.vigente_desde ?? hoyISO(),
    vigente_hasta: precio?.vigente_hasta ?? '',
  })

  function handleClienteChange(val: string) {
    setForm((p) => ({ ...p, cliente: val }))
    if (val.length >= 2) {
      setClienteSug(clientesExistentes.filter((c) => c.toLowerCase().includes(val.toLowerCase())).slice(0, 5))
    } else {
      setClienteSug([])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.cliente.trim() || !form.producto_id || !form.precio || !form.motivo.trim()) {
      setError('Todos los campos marcados son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const payload = {
      cliente: form.cliente.trim(),
      producto_id: form.producto_id,
      precio: parseFloat(form.precio),
      motivo: form.motivo.trim(),
      vigente_desde: form.vigente_desde,
      vigente_hasta: form.vigente_hasta || null,
    }
    const { error: err } = precio
      ? await supabase.from('precios_especiales_cliente').update(payload).eq('id', precio.id)
      : await supabase.from('precios_especiales_cliente').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {precio ? 'Editar precio especial' : 'Nuevo precio especial'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="relative">
            <label className="label">Cliente *</label>
            <input type="text" value={form.cliente}
              onChange={(e) => handleClienteChange(e.target.value)}
              className="input" placeholder="Nombre del cliente" autoComplete="off" required />
            {clienteSug.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 overflow-hidden">
                {clienteSug.map((c) => (
                  <button key={c} type="button"
                    onClick={() => { setForm((p) => ({ ...p, cliente: c })); setClienteSug([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Producto *</label>
            <select value={form.producto_id}
              onChange={(e) => setForm((p) => ({ ...p, producto_id: e.target.value }))}
              className="input" required>
              {productos.map((pr) => (
                <option key={pr.id} value={pr.id}>{pr.codigo} — {pr.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Precio especial ($) *</label>
            <input type="number" min="0" step="any" value={form.precio}
              onChange={(e) => setForm((p) => ({ ...p, precio: e.target.value }))}
              className="input" placeholder="0" required />
          </div>
          <div>
            <label className="label">Motivo *</label>
            <input type="text" value={form.motivo}
              onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
              className="input" placeholder="Ej: Volumen + cliente histórico" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vigente desde</label>
              <input type="date" value={form.vigente_desde}
                onChange={(e) => setForm((p) => ({ ...p, vigente_desde: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Vigente hasta (opcional)</label>
              <input type="date" value={form.vigente_hasta}
                onChange={(e) => setForm((p) => ({ ...p, vigente_hasta: e.target.value }))}
                className="input" />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : precio ? 'Guardar' : 'Crear precio especial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PreciosEspecialesClient({ precios, productos, clientesExistentes }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<(PrecioEspecialCliente & { producto: ProductoMin | null }) | undefined>()
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')

  const filtrados = useMemo(() => {
    return precios.filter((p) => {
      if (filtroCliente && !p.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false
      if (filtroProducto && p.producto_id !== filtroProducto) return false
      return true
    })
  }, [precios, filtroCliente, filtroProducto])

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminar este precio especial?')) return
    const supabase = createClient()
    await supabase.from('precios_especiales_cliente').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/productos" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft size={14} /> Productos
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">Precios especiales</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Precios especiales por cliente</h1>
        <button onClick={() => { setEditando(undefined); setModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nuevo precio especial
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input type="text" value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="input w-auto text-sm" placeholder="Buscar cliente..." />
        <select value={filtroProducto}
          onChange={(e) => setFiltroProducto(e.target.value)}
          className="input w-auto text-sm">
          <option value="">Todos los productos</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Cliente</th>
                <th className="table-th">Producto</th>
                <th className="table-th text-right">Precio especial</th>
                <th className="table-th">Motivo</th>
                <th className="table-th">Vigente desde</th>
                <th className="table-th">Vigente hasta</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center text-slate-400 py-10">
                    Sin precios especiales
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{p.cliente}</td>
                    <td className="table-td">
                      <span className="font-mono text-xs font-semibold">{p.producto?.codigo}</span>
                      <span className="text-slate-500 ml-1 text-xs">— {p.producto?.nombre}</span>
                    </td>
                    <td className="table-td text-right font-bold text-blue-700">{formatearPeso(p.precio)}</td>
                    <td className="table-td text-sm text-slate-500">{p.motivo}</td>
                    <td className="table-td text-sm">{formatearFecha(p.vigente_desde)}</td>
                    <td className="table-td text-sm text-slate-500">
                      {p.vigente_hasta ? formatearFecha(p.vigente_hasta) : 'Sin vencimiento'}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditando(p); setModal(true) }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleEliminar(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={14} />
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

      {modal && (
        <PrecioModal
          precio={editando}
          productos={productos}
          clientesExistentes={clientesExistentes}
          onClose={() => { setModal(false); setEditando(undefined) }}
        />
      )}
    </div>
  )
}
