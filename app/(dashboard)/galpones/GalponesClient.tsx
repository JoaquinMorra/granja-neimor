'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Galpon, LoteConCalculos } from '@/types'
import { getPosturaEsperada, calcularEdadSemanas } from '@/lib/utils'
import { Plus, X, Edit, Trash2, Building2, Egg } from 'lucide-react'

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
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

export default function GalponesClient({ galpones, lotes }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLote, setEditingLote] = useState<LoteConCalculos | undefined>()
  const [galponParaNuevoLote, setGalponParaNuevoLote] = useState<string | undefined>()

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

  // Consumo estimado de alimento
  const totalGallinasActivas = lotes
    .filter((l) => l.activo)
    .reduce((s, l) => s + l.gallinas_actuales, 0)
  const consumoAlimentoDiario = totalGallinasActivas * 0.13

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Galpones y lotes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de galpones, lotes y seguimiento de plantel</p>
        </div>
      </div>

      {/* Consumo estimado */}
      <div className="card p-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total gallinas activas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalGallinasActivas.toLocaleString('es-AR')}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumo alimento estimado / día</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{consumoAlimentoDiario.toFixed(0)} kg</p>
          <p className="text-xs text-slate-400 mt-0.5">@ 0.13 kg/gallina/día</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumo alimento estimado / mes</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{(consumoAlimentoDiario * 30).toFixed(0)} kg</p>
        </div>
      </div>

      {/* Galpones */}
      <div className="space-y-6">
        {galpones.map((galpon) => {
          const lotesGalpon = lotes.filter((l) => l.galpon_id === galpon.id)
          const lotesActivos = lotesGalpon.filter((l) => l.activo)
          const totalGallinas = lotesActivos.reduce((s, l) => s + l.gallinas_actuales, 0)
          const totalMuertes = lotesActivos.reduce((s, l) => s + l.total_muertes, 0)

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
                    <p className="text-xs text-slate-500">{totalMuertes} muertes acumuladas</p>
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
                        <td colSpan={8} className="table-td text-center text-slate-400 py-6">
                          Sin lotes registrados
                        </td>
                      </tr>
                    ) : (
                      lotesGalpon.map((lote) => {
                        const postura = getPosturaEsperada(lote.edad_semanas)
                        return (
                          <tr
                            key={lote.id}
                            className={`hover:bg-slate-50 ${!lote.activo ? 'opacity-50' : ''}`}
                          >
                            <td className="table-td font-medium">{lote.nombre}</td>
                            <td className="table-td text-right">{lote.gallinas_inicial.toLocaleString()}</td>
                            <td className="table-td text-right">
                              {lote.total_muertes > 0 ? (
                                <span className="text-red-600">{lote.total_muertes}</span>
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
                        )
                      })
                    )}
                  </tbody>
                  {lotesActivos.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="table-td font-bold text-slate-700">Total activos</td>
                        <td className="table-td text-right font-bold">
                          {lotesActivos.reduce((s, l) => s + l.gallinas_inicial, 0).toLocaleString()}
                        </td>
                        <td className="table-td text-right font-bold text-red-700">
                          {totalMuertes}
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
    </div>
  )
}
