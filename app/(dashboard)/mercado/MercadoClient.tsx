'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatearFecha, formatearPeso, hoyISO } from '@/lib/utils'
import {
  Plus, X, Truck, ShoppingBag, Package, AlertTriangle, Trash2, Edit, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── Tipos locales ──────────────────────────────────────────────────────────────

type Producto = {
  id: string; codigo: string; nombre: string
  precio_mayorista: number; precio_minorista: number; unidades_por_caja: number
}

type TransItem = {
  id: string; producto_id: string; cantidad: number
  producto: { id: string; codigo: string; nombre: string; unidades_por_caja: number } | null
}

type Transferencia = {
  id: string; fecha: string; notas: string | null; created_at: string; items: TransItem[]
}

type CierreItem = {
  id: string; producto_id: string; cantidad: number
  precio_unitario: number; total_linea: number
  producto: { id: string; codigo: string; nombre: string; unidades_por_caja: number; precio_minorista: number } | null
}

type Cierre = {
  id: string; fecha: string; notas: string | null
  total_efectivo: number; total_transferencia: number; created_at: string; items: CierreItem[]
}

type LineaTrans = { producto_id: string; cantidad: string }
type LineaCierre = { producto_id: string; cantidad: string; precio_unitario: string }

// cajones equivalentes: unidades × (unidades_por_caja / 360)
function cajEquiv(cantidad: number, unidadesPorCaja: number) {
  return cantidad * unidadesPorCaja / 360
}

// ── Modal: Nueva / Editar Transferencia ────────────────────────────────────────

function TransferenciaModal({
  productos, editando, onClose,
}: {
  productos: Producto[]; editando?: Transferencia | null; onClose: () => void
}) {
  const router = useRouter()
  const [fecha, setFecha] = useState(editando?.fecha ?? hoyISO())
  const [notas, setNotas] = useState(editando?.notas ?? '')
  const [lineas, setLineas] = useState<LineaTrans[]>(
    editando?.items.length
      ? editando.items.map(i => ({ producto_id: i.producto_id, cantidad: String(i.cantidad) }))
      : [{ producto_id: '', cantidad: '' }]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addLinea() { setLineas(p => [...p, { producto_id: '', cantidad: '' }]) }
  function removeLinea(i: number) { setLineas(p => p.filter((_, idx) => idx !== i)) }
  function setLinea(i: number, key: keyof LineaTrans, val: string) {
    setLineas(p => { const n = [...p]; n[i] = { ...n[i], [key]: val }; return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validas = lineas.filter(l => l.producto_id && parseFloat(l.cantidad || '0') > 0)
    if (validas.length === 0) { setError('Agregá al menos un producto con cantidad mayor a 0.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    if (editando) {
      // Actualizar header
      const { error: upErr } = await supabase.from('puesto_transferencias')
        .update({ fecha, notas: notas || null }).eq('id', editando.id)
      if (upErr) { setError(upErr.message); setLoading(false); return }

      // Reemplazar items
      await supabase.from('puesto_transferencia_items').delete().eq('transferencia_id', editando.id)
      await supabase.from('puesto_transferencia_items').insert(
        validas.map(l => ({ transferencia_id: editando.id, producto_id: l.producto_id, cantidad: parseFloat(l.cantidad) }))
      )
    } else {
      // Crear nueva
      const { data: trans, error: transErr } = await supabase.from('puesto_transferencias')
        .insert({ fecha, notas: notas || null }).select().single()
      if (transErr || !trans) { setError(transErr?.message ?? 'Error al crear transferencia'); setLoading(false); return }

      const { error: itemsErr } = await supabase.from('puesto_transferencia_items').insert(
        validas.map(l => ({ transferencia_id: trans.id, producto_id: l.producto_id, cantidad: parseFloat(l.cantidad) }))
      )
      if (itemsErr) {
        await supabase.from('puesto_transferencias').delete().eq('id', trans.id)
        setError(itemsErr.message); setLoading(false); return
      }
    }

    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {editando ? 'Editar transferencia' : 'Nueva transferencia al puesto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <input type="text" value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Ej: envío tarde" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 font-medium text-slate-600">Producto</th>
                  <th className="text-center py-2 font-medium text-slate-600">Cantidad</th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">
                      <select value={l.producto_id} onChange={e => setLinea(i, 'producto_id', e.target.value)} className="input text-sm">
                        <option value="">Seleccioná producto</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" min="0" step="0.5" value={l.cantidad}
                        onChange={e => setLinea(i, 'cantidad', e.target.value)}
                        className="input text-center" placeholder="0" />
                    </td>
                    <td className="py-2 pl-1">
                      {lineas.length > 1 && (
                        <button type="button" onClick={() => removeLinea(i)} className="text-slate-300 hover:text-red-500"><X size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addLinea} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus size={14} /> Agregar producto
          </button>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: Cierre del día ─────────────────────────────────────────────────────

function CierreModal({
  productos, editando, onClose,
}: {
  productos: Producto[]; editando?: Cierre | null; onClose: () => void
}) {
  const router = useRouter()
  const [fecha, setFecha] = useState(editando?.fecha ?? hoyISO())
  const [notas, setNotas] = useState(editando?.notas ?? '')
  const [lineas, setLineas] = useState<LineaCierre[]>(
    editando?.items.length
      ? editando.items.map(i => ({
          producto_id: i.producto_id,
          cantidad: String(i.cantidad),
          precio_unitario: String(i.precio_unitario),
        }))
      : [{ producto_id: '', cantidad: '', precio_unitario: '' }]
  )
  const [totalEfectivo, setTotalEfectivo] = useState(editando ? String(editando.total_efectivo) : '')
  const [totalTransferencia, setTotalTransferencia] = useState(editando ? String(editando.total_transferencia) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addLinea() { setLineas(p => [...p, { producto_id: '', cantidad: '', precio_unitario: '' }]) }
  function removeLinea(i: number) { setLineas(p => p.filter((_, idx) => idx !== i)) }
  function setLinea(i: number, key: keyof LineaCierre, val: string) {
    setLineas(p => { const n = [...p]; n[i] = { ...n[i], [key]: val }; return n })
  }
  function handleProductoChange(i: number, productoId: string) {
    const prod = productos.find(p => p.id === productoId)
    setLineas(p => {
      const n = [...p]
      n[i] = { ...n[i], producto_id: productoId, precio_unitario: prod?.precio_minorista ? String(prod.precio_minorista) : '' }
      return n
    })
  }

  const subtotal = lineas.reduce((s, l) => {
    const cant = parseFloat(l.cantidad || '0')
    const precio = parseFloat(l.precio_unitario || '0')
    return s + cant * precio
  }, 0)

  const totalCobrado = parseFloat(totalEfectivo || '0') + parseFloat(totalTransferencia || '0')
  const diferencia = subtotal > 0 ? Math.abs(totalCobrado - subtotal) / subtotal : 0
  const muestraWarning = subtotal > 0 && diferencia > 0.05

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validas = lineas.filter(l => l.producto_id && parseFloat(l.cantidad || '0') > 0)
    if (validas.length === 0) { setError('Agregá al menos un producto vendido.'); return }

    const efectivoNum = parseFloat(totalEfectivo || '0')
    const transferenciaNum = parseFloat(totalTransferencia || '0')
    if (efectivoNum + transferenciaNum <= 0) { setError('El total cobrado debe ser mayor a 0.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      fecha,
      notas: notas || null,
      total_efectivo: efectivoNum,
      total_transferencia: transferenciaNum,
    }

    let cierreId: string

    if (editando) {
      // Eliminar movimientos de caja asociados
      await supabase.from('caja').delete().eq('puesto_cierre_id', editando.id)
      // Eliminar items anteriores
      await supabase.from('puesto_cierre_items').delete().eq('cierre_id', editando.id)
      // Actualizar header
      const { error: upErr } = await supabase.from('puesto_cierres').update(payload).eq('id', editando.id)
      if (upErr) { setError(upErr.message); setLoading(false); return }
      cierreId = editando.id
    } else {
      // Crear cierre
      const { data: cierre, error: cierreErr } = await supabase.from('puesto_cierres')
        .insert(payload).select().single()
      if (cierreErr || !cierre) { setError(cierreErr?.message ?? 'Error al crear cierre'); setLoading(false); return }
      cierreId = cierre.id
    }

    // Insertar items
    const items = validas.map(l => ({
      cierre_id: cierreId,
      producto_id: l.producto_id,
      cantidad: parseFloat(l.cantidad),
      precio_unitario: parseFloat(l.precio_unitario || '0'),
      total_linea: parseFloat(l.cantidad) * parseFloat(l.precio_unitario || '0'),
    }))
    const { error: itemsErr } = await supabase.from('puesto_cierre_items').insert(items)
    if (itemsErr) {
      if (!editando) await supabase.from('puesto_cierres').delete().eq('id', cierreId)
      setError(itemsErr.message); setLoading(false); return
    }

    // Insertar movimientos en Caja
    const cajaMov = []
    if (efectivoNum > 0) cajaMov.push({
      fecha, tipo: 'INGRESO', categoria: 'Ventas Puesto',
      descripcion: `Cierre puesto ${formatearFecha(fecha)}`,
      monto: efectivoNum, medio_pago: 'EFECTIVO', origen: 'puesto', puesto_cierre_id: cierreId,
    })
    if (transferenciaNum > 0) cajaMov.push({
      fecha, tipo: 'INGRESO', categoria: 'Ventas Puesto',
      descripcion: `Cierre puesto ${formatearFecha(fecha)}`,
      monto: transferenciaNum, medio_pago: 'TRANSFERENCIA', origen: 'puesto', puesto_cierre_id: cierreId,
    })

    if (cajaMov.length > 0) {
      const { error: cajaErr } = await supabase.from('caja').insert(cajaMov)
      if (cajaErr) {
        if (!editando) await supabase.from('puesto_cierres').delete().eq('id', cierreId)
        setError(`Error al registrar en Caja: ${cajaErr.message}`); setLoading(false); return
      }
    }

    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {editando ? 'Editar cierre' : 'Cierre del día'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <input type="text" value={notas} onChange={e => setNotas(e.target.value)} className="input" placeholder="Observaciones del día" />
            </div>
          </div>

          {/* Items vendidos */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 font-medium text-slate-600">Producto</th>
                  <th className="text-center py-2 font-medium text-slate-600">Cantidad</th>
                  <th className="text-center py-2 font-medium text-slate-600">Precio unit.</th>
                  <th className="text-right py-2 font-medium text-slate-600">Total</th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lineas.map((l, i) => {
                  const total = parseFloat(l.cantidad || '0') * parseFloat(l.precio_unitario || '0')
                  return (
                    <tr key={i}>
                      <td className="py-2 pr-2">
                        <select value={l.producto_id}
                          onChange={e => handleProductoChange(i, e.target.value)}
                          className="input text-sm">
                          <option value="">Seleccioná producto</option>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-1">
                        <input type="number" min="0" step="0.5" value={l.cantidad}
                          onChange={e => setLinea(i, 'cantidad', e.target.value)}
                          className="input text-center" placeholder="0" />
                      </td>
                      <td className="py-2 px-1">
                        <input type="number" min="0" step="1" value={l.precio_unitario}
                          onChange={e => setLinea(i, 'precio_unitario', e.target.value)}
                          className="input text-center" placeholder="0" />
                      </td>
                      <td className="py-2 pl-1 text-right text-slate-700 font-medium text-sm min-w-[80px]">
                        {total > 0 ? formatearPeso(total) : '—'}
                      </td>
                      <td className="py-2 pl-1">
                        {lineas.length > 1 && (
                          <button type="button" onClick={() => removeLinea(i)} className="text-slate-300 hover:text-red-500"><X size={16} /></button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addLinea} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus size={14} /> Agregar producto
          </button>

          {/* Subtotal */}
          <div className="flex justify-end">
            <p className="text-sm text-slate-600">
              Subtotal calculado: <span className="font-bold text-slate-800">{formatearPeso(subtotal)}</span>
            </p>
          </div>

          {/* Totales cobrados */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="label">Total cobrado — Efectivo ($)</label>
              <input type="number" min="0" step="1" value={totalEfectivo}
                onChange={e => setTotalEfectivo(e.target.value)} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Total cobrado — Transferencia ($)</label>
              <input type="number" min="0" step="1" value={totalTransferencia}
                onChange={e => setTotalTransferencia(e.target.value)} className="input" placeholder="0" />
            </div>
          </div>

          {muestraWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
              <span>
                El total cobrado ({formatearPeso(totalCobrado)}) difiere más del 5% del subtotal ({formatearPeso(subtotal)}).
                ¿Vendiste a otro precio o hubo regalo / merma?
              </span>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cierre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: Confirmar eliminar ──────────────────────────────────────────────────

function ConfirmarEliminarModal({
  titulo, descripcion, loading, onClose, onConfirmar,
}: {
  titulo: string; descripcion: string; loading: boolean; onClose: () => void; onConfirmar: () => void
}) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">{titulo}</h2>
          <p className="text-sm text-slate-600 mb-5">{descripcion}</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="button" onClick={onConfirmar} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

type Props = {
  periodos: { inicio: string; fin: string; label: string }[]
  periodoInicio: string
  periodoFin: string
  periodoLabel: string
  productos: Producto[]
  transferencias: Transferencia[]
  cierres: Cierre[]
  hayClosureHoy: boolean
}

export default function MercadoClient({
  periodos, periodoInicio, periodoFin, periodoLabel,
  productos, transferencias, cierres, hayClosureHoy,
}: Props) {
  const router = useRouter()
  const [modalTrans, setModalTrans] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [editandoTrans, setEditandoTrans] = useState<Transferencia | null>(null)
  const [editandoCierre, setEditandoCierre] = useState<Cierre | null>(null)
  const [elimTransferencia, setElimTransferencia] = useState<Transferencia | null>(null)
  const [elimCierre, setElimCierre] = useState<Cierre | null>(null)
  const [loadingElim, setLoadingElim] = useState(false)
  const [expandedStock, setExpandedStock] = useState(true)

  // ── Stock all-time por producto ───────────────────────────────────────────
  const stockPorProducto = useMemo(() => {
    const stock: Record<string, number> = {}
    for (const t of transferencias) {
      for (const item of t.items) {
        stock[item.producto_id] = (stock[item.producto_id] ?? 0) + item.cantidad
      }
    }
    for (const c of cierres) {
      for (const item of c.items) {
        stock[item.producto_id] = (stock[item.producto_id] ?? 0) - item.cantidad
      }
    }
    return stock
  }, [transferencias, cierres])

  const transferenciasTotalesPorProducto = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of transferencias) for (const i of t.items) m[i.producto_id] = (m[i.producto_id] ?? 0) + i.cantidad
    return m
  }, [transferencias])

  const cierreVentasTotalesPorProducto = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of cierres) for (const i of c.items) m[i.producto_id] = (m[i.producto_id] ?? 0) + i.cantidad
    return m
  }, [cierres])

  // ── KPIs del período seleccionado ────────────────────────────────────────
  const { ventasPeriodo, cajonesTransfPeriodo } = useMemo(() => {
    const cierresPeriodo = cierres.filter(c => c.fecha >= periodoInicio && c.fecha <= periodoFin)
    const transPeriodo = transferencias.filter(t => t.fecha >= periodoInicio && t.fecha <= periodoFin)

    const ventasPeriodo = cierresPeriodo.reduce((s, c) => s + c.total_efectivo + c.total_transferencia, 0)
    const cajonesTransfPeriodo = transPeriodo.reduce((s, t) => {
      return s + t.items.reduce((si, item) => {
        const prod = productos.find(p => p.id === item.producto_id)
        return si + cajEquiv(item.cantidad, prod?.unidades_por_caja ?? 360)
      }, 0)
    }, 0)

    return { ventasPeriodo, cajonesTransfPeriodo }
  }, [cierres, transferencias, periodoInicio, periodoFin, productos])

  const totalCajonesStock = useMemo(() => {
    return productos.reduce((s, prod) => {
      const q = stockPorProducto[prod.id] ?? 0
      return s + cajEquiv(q, prod.unidades_por_caja)
    }, 0)
  }, [productos, stockPorProducto])

  // ── Movimientos del período ───────────────────────────────────────────────
  const movimientosPeriodo = useMemo(() => {
    const trans = transferencias
      .filter(t => t.fecha >= periodoInicio && t.fecha <= periodoFin)
      .map(t => ({ tipo: 'TRANSFERENCIA' as const, data: t, fecha: t.fecha }))
    const cierre = cierres
      .filter(c => c.fecha >= periodoInicio && c.fecha <= periodoFin)
      .map(c => ({ tipo: 'CIERRE' as const, data: c, fecha: c.fecha }))
    return [...trans, ...cierre].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [transferencias, cierres, periodoInicio, periodoFin])

  // ── Handlers eliminar ─────────────────────────────────────────────────────
  async function handleEliminarTrans() {
    if (!elimTransferencia) return
    setLoadingElim(true)
    const supabase = createClient()
    await supabase.from('puesto_transferencias')
      .update({ deleted_at: new Date().toISOString() }).eq('id', elimTransferencia.id)
    setLoadingElim(false)
    setElimTransferencia(null)
    router.refresh()
  }

  async function handleEliminarCierre() {
    if (!elimCierre) return
    setLoadingElim(true)
    const supabase = createClient()
    await supabase.from('caja').delete().eq('puesto_cierre_id', elimCierre.id)
    await supabase.from('puesto_cierres')
      .update({ deleted_at: new Date().toISOString() }).eq('id', elimCierre.id)
    setLoadingElim(false)
    setElimCierre(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Puesto Mercado</h1>
          <p className="text-sm text-slate-500 mt-0.5">Período {periodoLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodoInicio}
            onChange={e => router.push(`/mercado?periodo=${e.target.value}`)}
            className="input w-auto text-sm"
          >
            {[...periodos].reverse().map(p => (
              <option key={p.inicio} value={p.inicio}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setEditandoTrans(null); setModalTrans(true) }}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Truck size={15} /> Nueva transferencia
          </button>
          {!hayClosureHoy && (
            <button
              onClick={() => { setEditandoCierre(null); setModalCierre(true) }}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <ShoppingBag size={15} /> Cierre del día
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Stock actual</p>
          <p className="text-3xl font-bold text-slate-800">{totalCajonesStock.toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">cajones equiv. (all time)</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-l-green-400">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ventas del período</p>
          <p className="text-3xl font-bold text-green-700">{formatearPeso(ventasPeriodo)}</p>
          <p className="text-xs text-slate-400 mt-1">{periodoLabel}</p>
        </div>
        <div className="card p-5 text-center border-l-4 border-l-blue-400">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Transferencias del período</p>
          <p className="text-3xl font-bold text-blue-700">{cajonesTransfPeriodo.toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">cajones equiv. transferidos</p>
        </div>
      </div>

      {/* Stock por SKU */}
      <div className="card overflow-hidden">
        <button
          className="w-full p-5 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
          onClick={() => setExpandedStock(p => !p)}
        >
          <div className="flex items-center gap-2">
            <Package size={18} className="text-slate-400" />
            <h3 className="font-semibold text-slate-800">Stock por SKU</h3>
            <span className="text-xs text-slate-400">(acumulado desde el inicio)</span>
          </div>
          {expandedStock ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {expandedStock && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">SKU</th>
                  <th className="table-th">Descripción</th>
                  <th className="table-th text-right">Transferido total</th>
                  <th className="table-th text-right">Vendido total</th>
                  <th className="table-th text-right">Stock actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {productos.map(prod => {
                  const transferido = transferenciasTotalesPorProducto[prod.id] ?? 0
                  const vendido = cierreVentasTotalesPorProducto[prod.id] ?? 0
                  const stock = stockPorProducto[prod.id] ?? 0
                  const sinStock = stock <= 0
                  return (
                    <tr key={prod.id} className={`hover:bg-slate-50 ${sinStock && (transferido > 0) ? 'bg-red-50' : ''}`}>
                      <td className="table-td font-mono text-xs font-semibold">{prod.codigo}</td>
                      <td className="table-td text-slate-600">{prod.nombre}</td>
                      <td className="table-td text-right">{transferido > 0 ? transferido.toLocaleString('es-AR') : '—'}</td>
                      <td className="table-td text-right">{vendido > 0 ? vendido.toLocaleString('es-AR') : '—'}</td>
                      <td className={`table-td text-right font-bold ${sinStock && transferido > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                        {stock.toLocaleString('es-AR')}
                        {sinStock && transferido > 0 && (
                          <span className="ml-1 text-xs text-red-500" title="Sin stock o con merma no registrada">⚠</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movimientos del período */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Movimientos del período</h3>
          <p className="text-xs text-slate-500 mt-0.5">{periodoLabel}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Fecha</th>
                <th className="table-th">Tipo</th>
                <th className="table-th">Detalle</th>
                <th className="table-th text-right">Importe</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {movimientosPeriodo.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-td text-center text-slate-400 py-8">
                    Sin movimientos en el período seleccionado
                  </td>
                </tr>
              ) : (
                movimientosPeriodo.map(mov => {
                  if (mov.tipo === 'TRANSFERENCIA') {
                    const t = mov.data as Transferencia
                    const resumen = t.items.map(i => {
                      const p = productos.find(p => p.id === i.producto_id)
                      return `${i.cantidad} ${p?.codigo ?? '?'}`
                    }).join(', ')
                    return (
                      <tr key={`t-${t.id}`} className="hover:bg-slate-50">
                        <td className="table-td">{formatearFecha(t.fecha)}</td>
                        <td className="table-td">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Truck size={10} /> Transferencia
                          </span>
                        </td>
                        <td className="table-td text-sm text-slate-600">{resumen || '—'}</td>
                        <td className="table-td text-right text-slate-500 text-sm">—</td>
                        <td className="table-td">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => { setEditandoTrans(t); setModalTrans(true) }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => setElimTransferencia(t)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  } else {
                    const c = mov.data as Cierre
                    const resumen = c.items.map(i => {
                      const p = productos.find(p => p.id === i.producto_id)
                      return `${i.cantidad} ${p?.codigo ?? '?'}`
                    }).join(', ')
                    const total = c.total_efectivo + c.total_transferencia
                    return (
                      <tr key={`c-${c.id}`} className="hover:bg-slate-50">
                        <td className="table-td">{formatearFecha(c.fecha)}</td>
                        <td className="table-td">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <ShoppingBag size={10} /> Cierre venta
                          </span>
                        </td>
                        <td className="table-td text-sm text-slate-600">{resumen || '—'}</td>
                        <td className="table-td text-right font-semibold text-green-700">{formatearPeso(total)}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => { setEditandoCierre(c); setModalCierre(true) }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => setElimCierre(c)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {modalTrans && (
        <TransferenciaModal
          productos={productos}
          editando={editandoTrans}
          onClose={() => { setModalTrans(false); setEditandoTrans(null) }}
        />
      )}
      {modalCierre && (
        <CierreModal
          productos={productos}
          editando={editandoCierre}
          onClose={() => { setModalCierre(false); setEditandoCierre(null) }}
        />
      )}
      {elimTransferencia && (
        <ConfirmarEliminarModal
          titulo="Eliminar transferencia"
          descripcion={`¿Eliminar la transferencia del ${formatearFecha(elimTransferencia.fecha)}? Esta acción no se puede deshacer.`}
          loading={loadingElim}
          onClose={() => setElimTransferencia(null)}
          onConfirmar={handleEliminarTrans}
        />
      )}
      {elimCierre && (
        <ConfirmarEliminarModal
          titulo="Eliminar cierre"
          descripcion={`¿Eliminar el cierre del ${formatearFecha(elimCierre.fecha)}? También se eliminarán los movimientos de Caja asociados. Esta acción no se puede deshacer.`}
          loading={loadingElim}
          onClose={() => setElimCierre(null)}
          onConfirmar={handleEliminarCierre}
        />
      )}
    </div>
  )
}
