'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Producto, ColorProducto, CategoriaProducto } from '@/types'
import { formatearPeso, hoyISO } from '@/lib/utils'
import { Plus, X, Edit, Package } from 'lucide-react'

type Props = { productos: Producto[] }

const COLOR_LABELS: Record<ColorProducto, string> = {
  blanco: 'Blanco', colorado: 'Colorado', mixto: 'Mixto',
}
const CATEGORIA_LABELS: Record<CategoriaProducto, string> = {
  super: 'Super', n1: 'N°1', n2: 'N°2', n3: 'N°3', sin_clasificar: 'Sin clasificar',
}

const emptyForm = {
  codigo: '', nombre: '', descripcion: '',
  color: 'colorado' as ColorProducto,
  categoria: 'sin_clasificar' as CategoriaProducto,
  unidades_por_caja: '',
  precio_mayorista: '',
  precio_minorista: '',
  activo: true,
}

function ProductoModal({
  producto,
  onClose,
}: {
  producto?: Producto
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(
    producto
      ? {
          codigo: producto.codigo,
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? '',
          color: producto.color,
          categoria: producto.categoria,
          unidades_por_caja: producto.unidades_por_caja.toString(),
          precio_mayorista: producto.precio_mayorista.toString(),
          precio_minorista: producto.precio_minorista.toString(),
          activo: producto.activo,
        }
      : { ...emptyForm }
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nombre.trim()) { setError('Código y nombre son obligatorios.'); return }
    if (!form.precio_mayorista || !form.precio_minorista) { setError('Los precios son obligatorios.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const payload = {
      codigo: form.codigo.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      color: form.color,
      categoria: form.categoria,
      unidades_por_caja: parseInt(form.unidades_por_caja || '1'),
      precio_mayorista: parseFloat(form.precio_mayorista),
      precio_minorista: parseFloat(form.precio_minorista),
      activo: form.activo,
    }
    const { error: err } = producto
      ? await supabase.from('productos').update(payload).eq('id', producto.id)
      : await supabase.from('productos').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {producto ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Código (SKU)</label>
              <input type="text" value={form.codigo}
                onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
                className="input font-mono" placeholder="CAJON" required />
            </div>
            <div>
              <label className="label">Nombre</label>
              <input type="text" value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                className="input" placeholder="Cajón colorado" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Color</label>
              <select value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value as ColorProducto }))}
                className="input">
                {Object.entries(COLOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select value={form.categoria}
                onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value as CategoriaProducto }))}
                className="input">
                {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Unidades por caja/bulto</label>
            <input type="number" min="1" value={form.unidades_por_caja}
              onChange={(e) => setForm((p) => ({ ...p, unidades_por_caja: e.target.value }))}
              className="input" placeholder="360" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Precio mayorista ($)</label>
              <input type="number" min="0" step="any" value={form.precio_mayorista}
                onChange={(e) => setForm((p) => ({ ...p, precio_mayorista: e.target.value }))}
                className="input" placeholder="0" required />
            </div>
            <div>
              <label className="label">Precio minorista ($)</label>
              <input type="number" min="0" step="any" value={form.precio_minorista}
                onChange={(e) => setForm((p) => ({ ...p, precio_minorista: e.target.value }))}
                className="input" placeholder="0" required />
            </div>
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <input type="text" value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              className="input" />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : producto ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProductosClient({ productos }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Producto | undefined>()

  async function toggleActivo(p: Producto) {
    const supabase = createClient()
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Catálogo de SKUs y precios</p>
        </div>
        <div className="flex gap-2">
          <Link href="/productos/precios-especiales" className="btn-secondary text-sm">
            Precios especiales
          </Link>
          <button onClick={() => { setEditando(undefined); setModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">SKU</th>
                <th className="table-th">Nombre</th>
                <th className="table-th">Color</th>
                <th className="table-th">Categoría</th>
                <th className="table-th text-right">Unidades</th>
                <th className="table-th text-right">P. Mayorista</th>
                <th className="table-th text-right">P. Minorista</th>
                <th className="table-th">Estado</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-td text-center text-slate-400 py-12">
                    <Package size={36} className="mx-auto mb-2 text-slate-300" />
                    No hay productos. Hacé click en "Nuevo producto".
                  </td>
                </tr>
              ) : (
                productos.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50 ${!p.activo ? 'opacity-50' : ''}`}>
                    <td className="table-td font-mono text-xs font-semibold text-slate-700">{p.codigo}</td>
                    <td className="table-td font-medium">{p.nombre}</td>
                    <td className="table-td">{COLOR_LABELS[p.color]}</td>
                    <td className="table-td">{CATEGORIA_LABELS[p.categoria]}</td>
                    <td className="table-td text-right">{p.unidades_por_caja}</td>
                    <td className="table-td text-right font-semibold">{formatearPeso(p.precio_mayorista)}</td>
                    <td className="table-td text-right">{formatearPeso(p.precio_minorista)}</td>
                    <td className="table-td">
                      <button
                        onClick={() => toggleActivo(p)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          p.activo ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="table-td">
                      <button
                        onClick={() => { setEditando(p); setModal(true) }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ProductoModal
          producto={editando}
          onClose={() => { setModal(false); setEditando(undefined) }}
        />
      )}
    </div>
  )
}
