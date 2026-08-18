'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Galpon, LoteConCalculos, VentaGallinas } from '@/types'
import { getPosturaEsperada, calcularEdadSemanas, formatearPeso, formatearFecha, hoyISO } from '@/lib/utils'
import { Plus, X, Edit, Building2, Banknote, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
  consumoColoradasGDia: number
  consumoBlancasGDia: number
  ventasGallinas: VentaGallinas[]
}

type LoteFormData = {
  galpon_id: string
  nombre: string
  gallinas_inicial: string
  fecha_nacimiento: string
  activo: boolean
}

function LoteModal({
  galponId,
  lote,
  galpones,
  onClose,
}: {
  galponId?: string
  lote?: LoteConCalculos
  galpones: Galpon[]
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<LoteFormData>({
    galpon_id: lote?.galpon_id ?? galponId ?? galpones[0]?.id ?? '',
    nombre: lote?.nombre ?? '',
    gallinas_inicial: lote?.gallinas_inicial?.toString() ?? '',
    fecha_nacimiento: lote?.fecha_nacimiento ?? '',
    activo: lote?.activo ?? true,
  })

  function update(field: keyof LoteFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.gallinas_inicial || parseInt(form.gallinas_inicial) <= 0) {
      setError('La cantidad de gallinas debe ser mayor a 0.')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()

    const data = {
      galpon_id: form.galpon_id,
      nombre: form.nombre.trim(),
      gallinas_inicial: parseInt(form.gallinas_inicial),
      fecha_nacimiento: form.fecha_nacimiento || null,
      activo: form.activo,
    }

    const { error: err } = lote
      ? await supabase.from('lotes').update(data).eq('id', lote.id)
      : await supabase.from('lotes').insert(data)

    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {lote ? 'Editar lote' : 'Nuevo lote'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Galpón</label>
            <select value={form.galpon_id}
              onChange={(e) => update('galpon_id', e.target.value)}
              className="input" disabled={!!lote}>
              {galpones.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre del lote</label>
              <input type="text" value={form.nombre}
                onChange={(e) => update('nombre', e.target.value)}
                className="input" placeholder="Ej: Lote 1" required />
            </div>
            <div>
              <label className="label">Gallinas iniciales</label>
              <input type="number" min="1" value={form.gallinas_inicial}
                onChange={(e) => update('gallinas_inicial', e.target.value)}
                className="input" placeholder="0" required />
            </div>
          </div>

          <div>
            <label className="label">Fecha de nacimiento (opcional)</label>
            <input type="date" value={form.fecha_nacimiento}
              onChange={(e) => update('fecha_nacimiento', e.target.value)}
              className="input" />
            <p className="text-xs text-slate-500 mt-1">
              Se usa para calcular la edad en semanas y la postura esperada
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="activo" checked={form.activo}
              onChange={(e) => update('activo', e.target.checked)}
              className="rounded" />
            <label htmlFor="activo" className="text-sm text-slate-700">Lote activo</label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : lote ? 'Guardar cambios' : 'Crear lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Registrar venta de gallinas ─────────────────────────
function VentaGallinasModal({
  lote,
  onClose,
}: {
  lote: LoteConCalculos
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    fecha: hoyISO(),
    cantidad: '',
    precio_unitario: '',
    observaciones: '',
  })

  const cantidad = parseInt(form.cantidad || '0')
  const precioUnitario = parseFloat(form.precio_unitario || '0')
  const montoTotal = cantidad > 0 && precioUnitario > 0 ? cantidad * precioUnitario : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cantidad || cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    if (cantidad > lote.gallinas_actuales) {
      setError(`El lote tiene ${lote.gallinas_actuales.toLocaleString()} gallinas actuales, no se pueden vender ${cantidad.toLocaleString()}.`)
      return
    }
    if (!precioUnitario || precioUnitario <= 0) { setError('El precio unitario debe ser mayor a 0.'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: venta, error: errVenta } = await supabase
      .from('ventas_gallinas')
      .insert({
        lote_id: lote.id,
        fecha: form.fecha,
        cantidad,
        precio_unitario: precioUnitario,
        observaciones: form.observaciones.trim() || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (errVenta || !venta) { setError(errVenta?.message ?? 'Error al guardar'); setLoading(false); return }

    const { data: movCaja, error: errCaja } = await supabase
      .from('caja')
      .insert({
        fecha: form.fecha,
        tipo: 'INGRESO',
        categoria: 'Venta gallinas',
        descripcion: `Venta de ${cantidad} gallinas del ${lote.galpon?.nombre ?? 'galpón'} — ${lote.nombre}`,
        monto: montoTotal,
      })
      .select()
      .single()

    if (errCaja || !movCaja) { setError(errCaja?.message ?? 'Error al crear el ingreso en Caja'); setLoading(false); return }

    await supabase.from('ventas_gallinas').update({ caja_id: movCaja.id }).eq('id', venta.id)

    router.refresh()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            Venta de gallinas — {lote.galpon?.nombre} · {lote.nombre}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            Gallinas actuales en el lote: <span className="font-semibold text-slate-700">{lote.gallinas_actuales.toLocaleString()}</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input type="number" min="1" max={lote.gallinas_actuales} value={form.cantidad}
                onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))}
                className="input" placeholder="0" required />
            </div>
          </div>
          <div>
            <label className="label">Precio unitario ($ por gallina)</label>
            <input type="number" min="0" step="any" value={form.precio_unitario}
              onChange={(e) => setForm((p) => ({ ...p, precio_unitario: e.target.value }))}
              className="input" placeholder="0" required />
          </div>
          <div>
            <label className="label">Monto total</label>
            <p className="text-lg font-bold text-green-700">{formatearPeso(montoTotal)}</p>
          </div>
          <div>
            <label className="label">Observaciones (opcional)</label>
            <textarea value={form.observaciones}
              onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
              className="input resize-none" rows={2} placeholder="Ej: vendidas al camal El Progreso" />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <p className="text-xs text-slate-500 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            Se generará automáticamente un ingreso en Caja de categoría "Venta gallinas".
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : 'Confirmar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Confirmar anular venta ───────────────────────────────
function ConfirmarAnularVentaModal({
  venta,
  loading,
  onClose,
  onConfirmar,
}: {
  venta: VentaGallinas
  loading: boolean
  onClose: () => void
  onConfirmar: () => void
}) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">¿Anular esta venta?</h2>
          <p className="text-sm text-slate-600 mb-5">
            Se suman {venta.cantidad.toLocaleString()} gallinas de vuelta al lote y se elimina el ingreso
            de {formatearPeso(venta.monto_total)} en Caja.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="button" onClick={onConfirmar} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
              {loading ? 'Anulando...' : 'Anular venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GalponesClient({ galpones, lotes, consumoColoradasGDia, consumoBlancasGDia, ventasGallinas }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLote, setEditingLote] = useState<LoteConCalculos | undefined>()
  const [galponParaNuevoLote, setGalponParaNuevoLote] = useState<string | undefined>()
  const [loteParaVenta, setLoteParaVenta] = useState<LoteConCalculos | undefined>()
  const [loteVentasAbierto, setLoteVentasAbierto] = useState<string | null>(null)
  const [anulandoVenta, setAnulandoVenta] = useState<VentaGallinas | null>(null)
  const [loadingAnular, setLoadingAnular] = useState(false)

  function openNuevoLote(galponId: string) {
    setEditingLote(undefined)
    setGalponParaNuevoLote(galponId)
    setModalOpen(true)
  }

  function openEditLote(lote: LoteConCalculos) {
    setEditingLote(lote)
    setGalponParaNuevoLote(undefined)
    setModalOpen(true)
  }

  async function toggleActivo(lote: LoteConCalculos) {
    const supabase = createClient()
    await supabase.from('lotes').update({ activo: !lote.activo }).eq('id', lote.id)
    router.refresh()
  }

  async function handleAnularVenta() {
    if (!anulandoVenta) return
    setLoadingAnular(true)
    const supabase = createClient()
    if (anulandoVenta.caja_id) {
      await supabase.from('caja').delete().eq('id', anulandoVenta.caja_id)
    }
    await supabase.from('ventas_gallinas').delete().eq('id', anulandoVenta.id)
    setLoadingAnular(false)
    setAnulandoVenta(null)
    router.refresh()
  }

  // Consumo diferenciado por tipo
  const lotesActivos = lotes.filter((l) => l.activo)
  const gallinasColoradas = lotesActivos
    .filter((l) => (l.galpon as any)?.tipo === 'coloradas')
    .reduce((s, l) => s + l.gallinas_actuales, 0)
  const gallinasBlancas = lotesActivos
    .filter((l) => (l.galpon as any)?.tipo === 'blancas')
    .reduce((s, l) => s + l.gallinas_actuales, 0)
  const totalGallinasActivas = gallinasColoradas + gallinasBlancas

  const consumoColoradasDia = gallinasColoradas * consumoColoradasGDia / 1000
  const consumoBlancasDia = gallinasBlancas * consumoBlancasGDia / 1000
  const consumoTotalDia = consumoColoradasDia + consumoBlancasDia

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Galpones y lotes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de galpones, lotes y seguimiento de plantel</p>
        </div>
      </div>

      {/* Resumen de consumo */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total gallinas activas</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalGallinasActivas.toLocaleString('es-AR')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{galpones.length} galpones</p>
          </div>
          {gallinasColoradas > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumo coloradas</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">{consumoColoradasDia.toFixed(0)} kg/día</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {gallinasColoradas.toLocaleString('es-AR')} gallinas @ {consumoColoradasGDia}g
              </p>
            </div>
          )}
          {gallinasBlancas > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumo blancas</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{consumoBlancasDia.toFixed(0)} kg/día</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {gallinasBlancas.toLocaleString('es-AR')} gallinas @ {consumoBlancasGDia}g
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 pt-4 flex gap-8">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumo total / día</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{consumoTotalDia.toFixed(0)} kg</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumo total / mes</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{(consumoTotalDia * 30).toFixed(0)} kg</p>
          </div>
        </div>
      </div>

      {/* Galpones */}
      <div className="space-y-6">
        {galpones.map((galpon) => {
          const lotesGalpon = lotes.filter((l) => l.galpon_id === galpon.id)
          const lotesActivosGalpon = lotesGalpon.filter((l) => l.activo)
          const totalGallinas = lotesActivosGalpon.reduce((s, l) => s + l.gallinas_actuales, 0)
          const totalMuertes = lotesActivosGalpon.reduce((s, l) => s + l.total_muertes, 0)
          const totalVendidas = lotesActivosGalpon.reduce((s, l) => s + l.total_vendidas, 0)
          const consumoGalponDia = totalGallinas * (galpon.tipo === 'coloradas' ? consumoColoradasGDia : consumoBlancasGDia) / 1000

          return (
            <div key={galpon.id} className="card overflow-hidden">
              {/* Header galpón */}
              <div className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between ${
                galpon.tipo === 'coloradas' ? 'bg-orange-50' : 'bg-blue-50'
              }`}>
                <div className="flex items-center gap-3">
                  <Building2 size={20} className={galpon.tipo === 'coloradas' ? 'text-orange-500' : 'text-blue-500'} />
                  <div>
                    <h3 className="font-bold text-slate-800">{galpon.nombre}</h3>
                    <p className="text-xs text-slate-500 capitalize">{galpon.tipo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800">{totalGallinas.toLocaleString()} gallinas</p>
                    <p className="text-xs text-slate-500">{totalMuertes} muertes · {consumoGalponDia.toFixed(0)} kg/día</p>
                  </div>
                  <button
                    onClick={() => openNuevoLote(galpon.id)}
                    className="btn-secondary text-xs flex items-center gap-1 py-1.5"
                  >
                    <Plus size={14} />
                    Nuevo lote
                  </button>
                </div>
              </div>

              {/* Lotes */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="table-th">Lote</th>
                      <th className="table-th text-right">Gallinas iniciales</th>
                      <th className="table-th text-right">Muertes</th>
                      <th className="table-th text-right">Vendidas</th>
                      <th className="table-th text-right">Actuales</th>
                      <th className="table-th text-center">Edad</th>
                      <th className="table-th text-center">Postura esperada</th>
                      <th className="table-th text-center">Estado</th>
                      <th className="table-th"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lotesGalpon.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="table-td text-center text-slate-400 py-6">
                          Sin lotes registrados
                        </td>
                      </tr>
                    ) : (
                      lotesGalpon.map((lote) => {
                        const postura = getPosturaEsperada(lote.edad_semanas)
                        const ventasLote = ventasGallinas.filter((v) => v.lote_id === lote.id)
                        const historialAbierto = loteVentasAbierto === lote.id
                        return (
                          <Fragment key={lote.id}>
                          <tr
                            className={`hover:bg-slate-50 ${!lote.activo ? 'opacity-50' : ''}`}
                          >
                            <td className="table-td font-medium">{lote.nombre}</td>
                            <td className="table-td text-right">{lote.gallinas_inicial.toLocaleString()}</td>
                            <td className="table-td text-right">
                              {lote.total_muertes > 0 ? (
                                <span className="text-red-600">{lote.total_muertes}</span>
                              ) : '0'}
                            </td>
                            <td className="table-td text-right">
                              {lote.total_vendidas > 0 ? (
                                <button
                                  onClick={() => setLoteVentasAbierto(historialAbierto ? null : lote.id)}
                                  className="text-amber-700 hover:underline inline-flex items-center gap-0.5"
                                  title="Ver historial de ventas"
                                >
                                  {lote.total_vendidas}
                                  {historialAbierto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              ) : '0'}
                            </td>
                            <td className="table-td text-right font-bold text-slate-800">
                              {lote.gallinas_actuales.toLocaleString()}
                            </td>
                            <td className="table-td text-center">
                              {lote.edad_semanas !== null
                                ? <span className="text-sm font-medium">{lote.edad_semanas} sem</span>
                                : <span className="text-slate-400 text-xs">Sin fecha</span>}
                            </td>
                            <td className="table-td text-center text-sm">
                              {postura.min > 0
                                ? <span className="text-blue-700">{postura.min}-{postura.max}%</span>
                                : <span className="text-slate-400">No pone</span>}
                            </td>
                            <td className="table-td text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  lote.activo
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {lote.activo ? 'Activo' : 'Retirado'}
                              </span>
                            </td>
                            <td className="table-td">
                              <div className="flex items-center gap-2 justify-end">
                                {lote.activo && lote.gallinas_actuales > 0 && (
                                  <button
                                    onClick={() => setLoteParaVenta(lote)}
                                    className="text-slate-400 hover:text-green-600 transition-colors"
                                    title="Registrar venta de gallinas"
                                  >
                                    <Banknote size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditLote(lote)}
                                  className="text-slate-400 hover:text-blue-600 transition-colors"
                                  title="Editar"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => toggleActivo(lote)}
                                  className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                    lote.activo
                                      ? 'text-slate-400 hover:text-red-600'
                                      : 'text-slate-400 hover:text-green-600'
                                  }`}
                                  title={lote.activo ? 'Retirar lote' : 'Reactivar lote'}
                                >
                                  {lote.activo ? 'Retirar' : 'Activar'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {historialAbierto && (
                            <tr className="bg-amber-50/40">
                              <td colSpan={9} className="px-4 py-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  Ventas de gallinas — {lote.nombre}
                                </p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-xs text-slate-500">
                                        <th className="pb-1 pr-4">Fecha</th>
                                        <th className="pb-1 pr-4 text-right">Cantidad</th>
                                        <th className="pb-1 pr-4 text-right">P. Unit.</th>
                                        <th className="pb-1 pr-4 text-right">Monto</th>
                                        <th className="pb-1 pr-4">Observaciones</th>
                                        <th className="pb-1"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-100">
                                      {ventasLote.map((v) => (
                                        <tr key={v.id}>
                                          <td className="py-1.5 pr-4 whitespace-nowrap">{formatearFecha(v.fecha)}</td>
                                          <td className="py-1.5 pr-4 text-right">{v.cantidad.toLocaleString()}</td>
                                          <td className="py-1.5 pr-4 text-right">{formatearPeso(v.precio_unitario)}</td>
                                          <td className="py-1.5 pr-4 text-right font-semibold text-green-700">{formatearPeso(v.monto_total)}</td>
                                          <td className="py-1.5 pr-4 text-slate-500">{v.observaciones ?? '—'}</td>
                                          <td className="py-1.5">
                                            {v.cierre_id ? (
                                              <span className="text-xs text-slate-400">Cerrada</span>
                                            ) : (
                                              <button
                                                onClick={() => setAnulandoVenta(v)}
                                                className="text-slate-400 hover:text-red-600 transition-colors"
                                                title="Anular venta"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                  {lotesActivosGalpon.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="table-td font-bold text-slate-700">Total activos</td>
                        <td className="table-td text-right font-bold">
                          {lotesActivosGalpon.reduce((s, l) => s + l.gallinas_inicial, 0).toLocaleString()}
                        </td>
                        <td className="table-td text-right font-bold text-red-700">
                          {totalMuertes}
                        </td>
                        <td className="table-td text-right font-bold text-amber-700">
                          {totalVendidas}
                        </td>
                        <td className="table-td text-right font-bold text-green-800">
                          {totalGallinas.toLocaleString()}
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {modalOpen && (
        <LoteModal
          galpones={galpones}
          lote={editingLote}
          galponId={galponParaNuevoLote}
          onClose={() => setModalOpen(false)}
        />
      )}
      {loteParaVenta && (
        <VentaGallinasModal lote={loteParaVenta} onClose={() => setLoteParaVenta(undefined)} />
      )}
      {anulandoVenta && (
        <ConfirmarAnularVentaModal
          venta={anulandoVenta}
          loading={loadingAnular}
          onClose={() => setAnulandoVenta(null)}
          onConfirmar={handleAnularVenta}
        />
      )}
    </div>
  )
}
