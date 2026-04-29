'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { Galpon, LoteConCalculos } from '@/types'
import { getPosturaEsperada, hoyISO } from '@/lib/utils'

type Props = {
  galpones: Galpon[]
  lotes: LoteConCalculos[]
  onClose: () => void
}

type FilaProduccion = {
  lote_id: string
  huevos: string
  muertes: string
}

export default function CargaProduccionModal({ galpones, lotes, onClose }: Props) {
  const router = useRouter()
  const [fecha, setFecha] = useState(hoyISO())
  const [galponId, setGalponId] = useState(galpones[0]?.id ?? '')
  const [filas, setFilas] = useState<FilaProduccion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lotesGalpon = lotes.filter((l) => l.galpon_id === galponId && l.activo)

  function initFilas(gId: string) {
    const lotesFiltrados = lotes.filter((l) => l.galpon_id === gId && l.activo)
    setFilas(lotesFiltrados.map((l) => ({ lote_id: l.id, huevos: '', muertes: '' })))
  }

  function handleGalponChange(gId: string) {
    setGalponId(gId)
    initFilas(gId)
  }

  function updateFila(index: number, field: 'huevos' | 'muertes', value: string) {
    setFilas((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const registros = filas
      .filter((f) => f.huevos !== '' || f.muertes !== '')
      .map((f) => ({
        lote_id: f.lote_id,
        fecha,
        huevos: parseInt(f.huevos || '0'),
        muertes: parseInt(f.muertes || '0'),
      }))

    if (registros.length === 0) {
      setError('Ingresá al menos un valor de huevos o muertes.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase
      .from('produccion_diaria')
      .upsert(registros, { onConflict: 'lote_id,fecha' })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.refresh()
    onClose()
  }

  // Init filas on first render
  if (filas.length === 0 && lotesGalpon.length > 0) {
    initFilas(galponId)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Cargar producción</h2>
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
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Galpón</label>
              <select
                value={galponId}
                onChange={(e) => handleGalponChange(e.target.value)}
                className="input"
              >
                {galpones.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de lotes */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 font-medium text-slate-600">Lote</th>
                  <th className="text-center py-2 font-medium text-slate-600">Gallinas</th>
                  <th className="text-center py-2 font-medium text-slate-600">Edad</th>
                  <th className="text-center py-2 font-medium text-slate-600">Postura esperada</th>
                  <th className="text-center py-2 font-medium text-slate-600">Huevos</th>
                  <th className="text-center py-2 font-medium text-slate-600">Muertes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lotesGalpon.map((lote, idx) => {
                  const fila = filas[idx]
                  const postura = getPosturaEsperada(lote.edad_semanas)
                  const huevosNum = parseInt(fila?.huevos || '0')
                  const porcentaje = lote.gallinas_actuales > 0
                    ? (huevosNum / lote.gallinas_actuales) * 100
                    : 0
                  const porcentajeOk =
                    postura.min === 0 && postura.max === 0
                      ? true
                      : porcentaje >= postura.min && porcentaje <= postura.max + 5

                  return (
                    <tr key={lote.id} className="py-2">
                      <td className="py-2 font-medium text-slate-700">{lote.nombre}</td>
                      <td className="py-2 text-center text-slate-600">
                        {lote.gallinas_actuales.toLocaleString()}
                      </td>
                      <td className="py-2 text-center text-slate-600">
                        {lote.edad_semanas !== null ? `${lote.edad_semanas}s` : '—'}
                      </td>
                      <td className="py-2 text-center text-xs text-slate-500">
                        {postura.min}-{postura.max}%
                      </td>
                      <td className="py-2 px-1">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={fila?.huevos ?? ''}
                            onChange={(e) => updateFila(idx, 'huevos', e.target.value)}
                            className={`input text-center ${
                              fila?.huevos && !porcentajeOk
                                ? 'border-amber-400 bg-amber-50'
                                : ''
                            }`}
                            placeholder="0"
                          />
                          {fila?.huevos && (
                            <span
                              className={`text-xs block text-center mt-0.5 font-medium ${
                                porcentajeOk ? 'text-green-600' : 'text-amber-600'
                              }`}
                            >
                              {porcentaje.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min="0"
                          value={fila?.muertes ?? ''}
                          onChange={(e) => updateFila(idx, 'muertes', e.target.value)}
                          className="input text-center"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
              {loading ? 'Guardando...' : 'Guardar producción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
