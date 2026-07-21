'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor, CompraProveedor, PagoProveedor, EstadoCompra, MetodoPagoProveedor } from '@/types'
import { formatearPeso, formatearFecha, hoyISO, CATEGORIA_CAJA_POR_TIPO_PROVEEDOR } from '@/lib/utils'
import { puedeEliminarCompra } from '@/lib/compras/puede-eliminar'
import { ArrowLeft, Plus, X, CheckCircle, AlertCircle, Trash2, Ban, Lock, Eye } from 'lucide-react'

type Props = {
  proveedor: Proveedor
  compras: CompraProveedor[]
  pagos: PagoProveedor[]
}

const TIPO_LABELS: Record<string, string> = {
  alimento: 'Alimento', maples: 'Maples', sanidad: 'Sanidad',
  servicios: 'Servicios', mantenimiento: 'Mantenimiento', otros: 'Otros',
}

const ESTADO_STYLES: Record<EstadoCompra, string> = {
  pendiente: 'bg-red-100 text-red-800',
  parcial: 'bg-amber-100 text-amber-800',
  pagada: 'bg-green-100 text-green-800',
}

// ─── Modal Nueva Compra ───────────────────────────────────────
function NuevaCompraModal({
  proveedor,
  onClose,
}: {
  proveedor: Proveedor
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    fecha: hoyISO(),
    descripcion: '',
    cantidad: '',
    unidad: proveedor.tipo === 'alimento' ? 'kg' : 'unidad',
    precio_unitario: '',
    total: '',
    vencimiento: '',
    kg_alimento: '',
    notas: '',
  })

  const totalCalculado =
    form.cantidad && form.precio_unitario
      ? (parseFloat(form.cantidad) * parseFloat(form.precio_unitario)).toFixed(2)
      : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria.'); return }
    const total = parseFloat(form.total || totalCalculado)
    if (!total || total <= 0) { setError('El total debe ser mayor a 0.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('compras_proveedor').insert({
      proveedor_id: proveedor.id,
      fecha: form.fecha,
      descripcion: form.descripcion.trim(),
      cantidad: parseFloat(form.cantidad || '1'),
      unidad: form.unidad,
      precio_unitario: parseFloat(form.precio_unitario || '0'),
      total,
      vencimiento: form.vencimiento || null,
      kg_alimento: proveedor.tipo === 'alimento' && form.kg_alimento ? parseFloat(form.kg_alimento) : null,
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
          <h2 className="text-lg font-semibold text-slate-800">Nueva compra — {proveedor.nombre}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Vencimiento (opcional)</label>
              <input type="date" value={form.vencimiento}
                onChange={(e) => setForm((p) => ({ ...p, vencimiento: e.target.value }))}
                className="input" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <input type="text" value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              className="input" placeholder="Ej: Alimento pellet 24/06" required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Cantidad</label>
              <input type="number" min="0" step="any" value={form.cantidad}
                onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))}
                className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input type="text" value={form.unidad}
                onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))}
                className="input" placeholder="kg, bolsa..." />
            </div>
            <div>
              <label className="label">Precio unitario ($)</label>
              <input type="number" min="0" step="any" value={form.precio_unitario}
                onChange={(e) => setForm((p) => ({ ...p, precio_unitario: e.target.value }))}
                className="input" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Total ($)</label>
            <input type="number" min="0" step="any"
              value={form.total || totalCalculado}
              onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))}
              className="input" placeholder={totalCalculado || '0'} required />
            {totalCalculado && !form.total && (
              <p className="text-xs text-slate-500 mt-1">Calculado automáticamente: {formatearPeso(parseFloat(totalCalculado))}</p>
            )}
          </div>
          {proveedor.tipo === 'alimento' && (
            <div>
              <label className="label">Kg de alimento</label>
              <input type="number" min="0" step="any" value={form.kg_alimento}
                onChange={(e) => setForm((p) => ({ ...p, kg_alimento: e.target.value }))}
                className="input" placeholder="0" />
              <p className="text-xs text-slate-500 mt-1">Se usa para calcular el costo del período</p>
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
          <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Esta compra registra una deuda. No genera movimiento en Caja hasta que se registre un pago.
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Registrar compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Nuevo Pago ─────────────────────────────────────────
function NuevoPagoModal({
  proveedor,
  compras,
  onClose,
}: {
  proveedor: Proveedor
  compras: CompraProveedor[]
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const comprasPendientes = compras.filter((c) => c.estado !== 'pagada')

  const [form, setForm] = useState({
    fecha: hoyISO(),
    monto: '',
    metodo: 'efectivo' as MetodoPagoProveedor,
    comprasSeleccionadas: [] as string[],
    notas: '',
  })

  const saldoSeleccionado = form.comprasSeleccionadas.reduce((s, id) => {
    const c = comprasPendientes.find((cp) => cp.id === id)
    return s + (c ? c.total - c.monto_pagado : 0)
  }, 0)

  function toggleCompra(id: string) {
    setForm((p) => {
      const sel = p.comprasSeleccionadas.includes(id)
        ? p.comprasSeleccionadas.filter((x) => x !== id)
        : [...p.comprasSeleccionadas, id]
      const nuevoMonto = sel.reduce((s, cid) => {
        const c = comprasPendientes.find((cp) => cp.id === cid)
        return s + (c ? c.total - c.monto_pagado : 0)
      }, 0)
      return { ...p, comprasSeleccionadas: sel, monto: nuevoMonto > 0 ? nuevoMonto.toFixed(2) : p.monto }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) { setError('El monto debe ser mayor a 0.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    // 1. Insertar pago sin movimiento_caja_id todavía
    const { data: pago, error: errPago } = await supabase
      .from('pagos_proveedor')
      .insert({
        proveedor_id: proveedor.id,
        fecha: form.fecha,
        monto,
        metodo: form.metodo,
        compras_asociadas: form.comprasSeleccionadas,
        notas: form.notas.trim() || null,
      })
      .select()
      .single()

    if (errPago || !pago) { setError(errPago?.message ?? 'Error al guardar'); setLoading(false); return }

    // 2. Crear movimiento en Caja
    const categoria = CATEGORIA_CAJA_POR_TIPO_PROVEEDOR[proveedor.tipo] ?? 'Otros'
    const medio_pago = form.metodo === 'transferencia' ? 'TRANSFERENCIA' : 'EFECTIVO'
    const { data: movCaja, error: errCaja } = await supabase
      .from('caja')
      .insert({
        fecha: form.fecha,
        tipo: 'EGRESO',
        categoria,
        descripcion: `Pago a ${proveedor.nombre}${form.notas ? ': ' + form.notas : ''}`,
        monto,
        medio_pago,
        pago_proveedor_id: pago.id,
      })
      .select()
      .single()

    if (errCaja || !movCaja) { setError(errCaja?.message ?? 'Error al crear movimiento'); setLoading(false); return }

    // 3. Actualizar pago con movimiento_caja_id
    await supabase.from('pagos_proveedor').update({ movimiento_caja_id: movCaja.id }).eq('id', pago.id)

    // 4. Actualizar compras seleccionadas (distribución greedy)
    if (form.comprasSeleccionadas.length > 0) {
      let remaining = monto
      for (const compraId of form.comprasSeleccionadas) {
        if (remaining <= 0) break
        const compra = compras.find((c) => c.id === compraId)
        if (!compra) continue
        const saldo = compra.total - compra.monto_pagado
        const pagar = Math.min(remaining, saldo)
        const nuevoPagado = compra.monto_pagado + pagar
        const nuevoEstado: EstadoCompra = nuevoPagado >= compra.total ? 'pagada' : 'parcial'
        await supabase
          .from('compras_proveedor')
          .update({ monto_pagado: nuevoPagado, estado: nuevoEstado })
          .eq('id', compraId)
        remaining -= pagar
      }
    }

    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Nuevo pago — {proveedor.nombre}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Método</label>
              <select value={form.metodo}
                onChange={(e) => setForm((p) => ({ ...p, metodo: e.target.value as MetodoPagoProveedor }))}
                className="input">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Monto ($)</label>
            <input type="number" min="0" step="any" value={form.monto}
              onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              className="input" placeholder="0" required />
          </div>

          {comprasPendientes.length > 0 && (
            <div>
              <label className="label">Compras asociadas (opcional)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {comprasPendientes.map((c) => {
                  const saldo = c.total - c.monto_pagado
                  const checked = form.comprasSeleccionadas.includes(c.id)
                  return (
                    <label key={c.id} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input type="checkbox" checked={checked}
                        onChange={() => toggleCompra(c.id)}
                        className="mt-0.5 accent-blue-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{c.descripcion}</p>
                        <p className="text-xs text-slate-500">{formatearFecha(c.fecha)} — Saldo: {formatearPeso(saldo)}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
              {saldoSeleccionado > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Saldo seleccionado: {formatearPeso(saldoSeleccionado)}
                </p>
              )}
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
          <p className="text-xs text-slate-500 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            Se generará automáticamente un egreso en Caja de categoría "{CATEGORIA_CAJA_POR_TIPO_PROVEEDOR[proveedor.tipo] ?? 'Otros'}".
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Confirmar eliminar/anular compra ────────────────────
function ConfirmarAccionCompraModal({
  compra,
  proveedor,
  accion,
  loading,
  onClose,
  onConfirmar,
}: {
  compra: CompraProveedor
  proveedor: Proveedor
  accion: 'eliminar' | 'anular'
  loading: boolean
  onClose: () => void
  onConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const saldo = compra.total - compra.monto_pagado

  function handleConfirmar() {
    if (accion === 'anular' && !motivo.trim()) {
      setError('El motivo de anulación es obligatorio.')
      return
    }
    onConfirmar(motivo.trim())
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            ¿Estás seguro que querés {accion} esta compra?
          </h2>
          <div className="text-sm text-slate-600 space-y-1 mb-3">
            <p>Proveedor: <span className="font-medium text-slate-800">{proveedor.nombre}</span></p>
            <p>Fecha: <span className="font-medium text-slate-800">{formatearFecha(compra.fecha)}</span></p>
            <p>Monto: <span className="font-medium text-slate-800">{formatearPeso(compra.total)}</span></p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 mb-4">
            Esta acción va a reducir la deuda con {proveedor.nombre} en {formatearPeso(saldo)}.
          </div>
          {accion === 'anular' && (
            <div className="mb-4">
              <label className="label">Motivo de anulación</label>
              <textarea value={motivo}
                onChange={(e) => { setMotivo(e.target.value); setError(null) }}
                className="input resize-none" rows={2} required />
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="button" onClick={handleConfirmar} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50 capitalize">
              {loading ? `${accion === 'eliminar' ? 'Eliminando' : 'Anulando'}...` : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Ver motivo de anulación ──────────────────────────────
function VerMotivoModal({ compra, onClose }: { compra: CompraProveedor; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Motivo de anulación</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-2">
          <p className="text-xs text-slate-500">
            Anulada el {compra.anulada_en ? formatearFecha(compra.anulada_en) : '—'}
          </p>
          <p className="text-sm text-slate-700">{compra.motivo_anulacion || 'Sin motivo registrado.'}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function ProveedorDetalleClient({ proveedor, compras, pagos }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'compras' | 'pagos'>('compras')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false)
  const [modalCompra, setModalCompra] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [accionCompra, setAccionCompra] = useState<{ compra: CompraProveedor; accion: 'eliminar' | 'anular' } | null>(null)
  const [verMotivo, setVerMotivo] = useState<CompraProveedor | null>(null)
  const [loadingAccion, setLoadingAccion] = useState(false)

  const comprasActivas = compras.filter((c) => !c.anulada_en)
  const saldoPendiente = comprasActivas.reduce((s, c) => s + (c.total - c.monto_pagado), 0)
  const totalComprado = comprasActivas.reduce((s, c) => s + c.total, 0)
  const totalPagado = comprasActivas.reduce((s, c) => s + c.monto_pagado, 0)

  function tienePagosAsociados(compraId: string) {
    return pagos.some((p) => p.compras_asociadas?.includes(compraId))
  }

  const comprasFiltradas = compras
    .filter((c) => (filtroEstado === 'todos' ? true : c.estado === filtroEstado))
    .filter((c) => (mostrarAnuladas ? true : !c.anulada_en))
    .sort((a, b) => {
      if (!!a.anulada_en !== !!b.anulada_en) return a.anulada_en ? 1 : -1
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    })

  async function handleEliminarCompra() {
    if (!accionCompra) return
    const { compra } = accionCompra
    setLoadingAccion(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('auditoria_compras_proveedor').insert({
      compra_id: compra.id,
      accion: 'ELIMINAR',
      user_id: user?.id ?? null,
      valores_antes: compra,
      valores_despues: null,
    })
    await supabase.from('compras_proveedor').delete().eq('id', compra.id)

    setLoadingAccion(false)
    setAccionCompra(null)
    router.refresh()
  }

  async function handleAnularCompra(motivo: string) {
    if (!accionCompra) return
    const { compra } = accionCompra
    setLoadingAccion(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const anuladaEn = new Date().toISOString()

    await supabase.from('auditoria_compras_proveedor').insert({
      compra_id: compra.id,
      accion: 'ANULAR',
      user_id: user?.id ?? null,
      valores_antes: compra,
      valores_despues: { anulada_en: anuladaEn, anulada_por: user?.id ?? null, motivo_anulacion: motivo },
    })
    await supabase.from('compras_proveedor')
      .update({ anulada_en: anuladaEn, anulada_por: user?.id ?? null, motivo_anulacion: motivo })
      .eq('id', compra.id)

    setLoadingAccion(false)
    setAccionCompra(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/proveedores" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft size={14} /> Proveedores
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{proveedor.nombre}</span>
      </div>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{proveedor.nombre}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{TIPO_LABELS[proveedor.tipo] ?? proveedor.tipo}</p>
            {proveedor.contacto && (
              <p className="text-sm text-slate-600 mt-1">{proveedor.contacto}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">Saldo pendiente</p>
            <p className={`text-3xl font-bold ${saldoPendiente > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {formatearPeso(saldoPendiente)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500">Total comprado</p>
            <p className="font-semibold text-slate-800">{formatearPeso(totalComprado)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total pagado</p>
            <p className="font-semibold text-green-700">{formatearPeso(totalPagado)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Compras</p>
            <p className="font-semibold text-slate-800">{compras.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs + acciones */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {(['compras', 'pagos'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'compras' && (
            <button onClick={() => setModalCompra(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={15} /> Nueva compra
            </button>
          )}
          <button onClick={() => setModalPago(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nuevo pago
          </button>
        </div>
      </div>

      {/* Tab: Compras */}
      {tab === 'compras' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 mr-auto">Compras</h3>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={mostrarAnuladas}
                onChange={(e) => setMostrarAnuladas(e.target.checked)}
                className="accent-blue-600" />
              Mostrar anuladas
            </label>
            <select value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input w-auto text-sm">
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagada">Pagada</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">Fecha</th>
                  <th className="table-th">Descripción</th>
                  <th className="table-th text-right">Cantidad</th>
                  <th className="table-th text-right">P. Unit</th>
                  <th className="table-th text-right">Total</th>
                  <th className="table-th text-right">Pagado</th>
                  <th className="table-th text-right">Saldo</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Venc.</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {comprasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="table-td text-center text-slate-400 py-8">Sin compras</td>
                  </tr>
                ) : (
                  comprasFiltradas.map((c) => {
                    const anulada = !!c.anulada_en
                    const decision = puedeEliminarCompra(c, tienePagosAsociados(c.id))
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50 ${anulada ? 'opacity-50' : ''}`}>
                        <td className={`table-td whitespace-nowrap ${anulada ? 'line-through' : ''}`}>{formatearFecha(c.fecha)}</td>
                        <td className="table-td">
                          <p className={`font-medium text-slate-800 ${anulada ? 'line-through' : ''}`}>{c.descripcion}</p>
                          {c.notas && <p className="text-xs text-slate-400">{c.notas}</p>}
                          {c.kg_alimento && <p className="text-xs text-amber-600">{c.kg_alimento} kg alimento</p>}
                        </td>
                        <td className={`table-td text-right ${anulada ? 'line-through' : ''}`}>{c.cantidad} {c.unidad}</td>
                        <td className={`table-td text-right ${anulada ? 'line-through' : ''}`}>{formatearPeso(c.precio_unitario)}</td>
                        <td className={`table-td text-right font-semibold ${anulada ? 'line-through' : ''}`}>{formatearPeso(c.total)}</td>
                        <td className="table-td text-right text-green-700">{formatearPeso(c.monto_pagado)}</td>
                        <td className="table-td text-right text-red-700 font-semibold">
                          {formatearPeso(c.total - c.monto_pagado)}
                        </td>
                        <td className="table-td">
                          {anulada ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                              Anulada
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLES[c.estado]}`}>
                              {c.estado}
                            </span>
                          )}
                        </td>
                        <td className="table-td text-xs text-slate-500">
                          {c.vencimiento ? formatearFecha(c.vencimiento) : '—'}
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-1 justify-end">
                            {anulada ? (
                              <button onClick={() => setVerMotivo(c)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Ver motivo">
                                <Eye size={14} />
                              </button>
                            ) : decision.accion === 'bloqueada' ? (
                              <span title={decision.motivoBloqueo}>
                                <Lock size={14} className="text-slate-300" />
                              </span>
                            ) : decision.accion === 'eliminar' ? (
                              <button onClick={() => setAccionCompra({ compra: c, accion: 'eliminar' })}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <button onClick={() => setAccionCompra({ compra: c, accion: 'anular' })}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Anular">
                                <Ban size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Pagos */}
      {tab === 'pagos' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Pagos registrados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-th">Fecha</th>
                  <th className="table-th text-right">Monto</th>
                  <th className="table-th">Método</th>
                  <th className="table-th">Compras asociadas</th>
                  <th className="table-th">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-td text-center text-slate-400 py-8">Sin pagos registrados</td>
                  </tr>
                ) : (
                  pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="table-td whitespace-nowrap">{formatearFecha(p.fecha)}</td>
                      <td className="table-td text-right font-bold text-green-700">{formatearPeso(p.monto)}</td>
                      <td className="table-td capitalize">{p.metodo}</td>
                      <td className="table-td text-xs text-slate-500">
                        {p.compras_asociadas?.length
                          ? `${p.compras_asociadas.length} compra${p.compras_asociadas.length > 1 ? 's' : ''}`
                          : '—'}
                      </td>
                      <td className="table-td text-xs text-slate-500">{p.notas ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalCompra && (
        <NuevaCompraModal proveedor={proveedor} onClose={() => setModalCompra(false)} />
      )}
      {modalPago && (
        <NuevoPagoModal proveedor={proveedor} compras={compras} onClose={() => setModalPago(false)} />
      )}
      {accionCompra && (
        <ConfirmarAccionCompraModal
          compra={accionCompra.compra}
          proveedor={proveedor}
          accion={accionCompra.accion}
          loading={loadingAccion}
          onClose={() => setAccionCompra(null)}
          onConfirmar={accionCompra.accion === 'eliminar' ? handleEliminarCompra : handleAnularCompra}
        />
      )}
      {verMotivo && (
        <VerMotivoModal compra={verMotivo} onClose={() => setVerMotivo(null)} />
      )}
    </div>
  )
}
