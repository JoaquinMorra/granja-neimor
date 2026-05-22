'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ConfigCostos } from '@/types'
import { formatearPeso } from '@/lib/utils'
import { ArrowLeft, Save } from 'lucide-react'

type Props = { config: ConfigCostos }

export default function ConfiguracionClient({ config }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    costo_recria_por_ave: config.costo_recria_por_ave.toString(),
    vida_util_semanas: config.vida_util_semanas.toString(),
    precio_kg_alimento: config.precio_kg_alimento?.toString() ?? '0',
  })

  const amortizacionPorSemana =
    parseFloat(form.costo_recria_por_ave || '0') / parseFloat(form.vida_util_semanas || '1')

  const precioKg = parseFloat(form.precio_kg_alimento || '0')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      costo_recria_por_ave: parseFloat(form.costo_recria_por_ave),
      vida_util_semanas: parseInt(form.vida_util_semanas),
      precio_kg_alimento: precioKg,
      updated_at: new Date().toISOString(),
    }

    const { error: err } = config.id
      ? await supabase.from('config_costos').update(payload).eq('id', config.id)
      : await supabase.from('config_costos').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }

    setSaved(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/costos')
      router.refresh()
    }, 1200)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/costos" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft size={14} /> Costos
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">Configuración</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Configuración de costos</h1>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Precio alimento */}
          <div>
            <label className="label">Precio del alimento ($/kg)</label>
            <input type="number" min="0" step="any"
              value={form.precio_kg_alimento}
              onChange={(e) => setForm((p) => ({ ...p, precio_kg_alimento: e.target.value }))}
              className="input" required />
            <p className="text-xs text-slate-500 mt-1">
              Precio actual del kg de alimento balanceado. Se usa para calcular el costo de alimento por consumo estimado.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-1">Consumo de referencia</p>
            <p className="text-xs text-amber-700">Blancas: 115 g/gallina/día · Coloradas: 120 g/gallina/día</p>
            {precioKg > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-amber-800">
                  Blancas: {formatearPeso(0.115 * precioKg)}/gallina/día
                </p>
                <p className="text-xs text-amber-800">
                  Coloradas: {formatearPeso(0.120 * precioKg)}/gallina/día
                </p>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Amortización aves */}
          <div>
            <label className="label">Costo de recría por ave ($)</label>
            <input type="number" min="0" step="any"
              value={form.costo_recria_por_ave}
              onChange={(e) => setForm((p) => ({ ...p, costo_recria_por_ave: e.target.value }))}
              className="input" required />
            <p className="text-xs text-slate-500 mt-1">
              Lo que cuesta producir una pollita lista para postura
            </p>
          </div>
          <div>
            <label className="label">Vida útil del ave (semanas)</label>
            <input type="number" min="1" step="1"
              value={form.vida_util_semanas}
              onChange={(e) => setForm((p) => ({ ...p, vida_util_semanas: e.target.value }))}
              className="input" required />
            <p className="text-xs text-slate-500 mt-1">
              Semanas de postura activa. Ej: 75 semanas
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">Amortización por gallina/semana</p>
            <p className="text-2xl font-bold text-blue-900">{formatearPeso(amortizacionPorSemana)}</p>
            <p className="text-xs text-blue-600 mt-1">
              = ${parseFloat(form.costo_recria_por_ave || '0').toLocaleString('es-AR')} ÷ {form.vida_util_semanas} semanas
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
              ¡Guardado! Volviendo a Costos...
            </div>
          )}

          <button type="submit" disabled={loading || saved} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={16} />
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </form>
      </div>
    </div>
  )
}
