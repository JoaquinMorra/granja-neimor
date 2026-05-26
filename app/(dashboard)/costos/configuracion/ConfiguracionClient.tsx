'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ConfigCostos } from '@/types'
import { formatearPeso, formatearFechaCorta } from '@/lib/utils'
import { ArrowLeft, Save } from 'lucide-react'

type Props = {
  config: ConfigCostos
  precioSugerido: number | null
  fechaUltimaCompra: string | null
}

export default function ConfiguracionClient({ config, precioSugerido, fechaUltimaCompra }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    precio_kg_alimento:      (config.precio_kg_alimento ?? 0).toString(),
    consumo_coloradas_g_dia: (config.consumo_coloradas_g_dia ?? 120).toString(),
    consumo_blancas_g_dia:   (config.consumo_blancas_g_dia ?? 113).toString(),
    sueldos_mensuales:       (config.sueldos_mensuales ?? 0).toString(),
    maples_mensuales:        (config.maples_mensuales ?? 0).toString(),
    otros_gastos_mensuales:  (config.otros_gastos_mensuales ?? 0).toString(),
    postura_esperada_pct:    (config.postura_esperada_pct ?? 70).toString(),
    costo_recria_por_ave:    (config.costo_recria_por_ave ?? 0).toString(),
    vida_util_semanas:       (config.vida_util_semanas ?? 75).toString(),
  })

  const f = (key: keyof typeof form) => parseFloat(form[key] || '0')
  const amortizacionPorSemana = f('costo_recria_por_ave') / (f('vida_util_semanas') || 1)
  const alimentoDiarioKg = (f('consumo_coloradas_g_dia') + f('consumo_blancas_g_dia')) / 1000

  function set(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      precio_kg_alimento:      f('precio_kg_alimento'),
      consumo_coloradas_g_dia: f('consumo_coloradas_g_dia'),
      consumo_blancas_g_dia:   f('consumo_blancas_g_dia'),
      sueldos_mensuales:       f('sueldos_mensuales'),
      maples_mensuales:        f('maples_mensuales'),
      otros_gastos_mensuales:  f('otros_gastos_mensuales'),
      postura_esperada_pct:    f('postura_esperada_pct'),
      costo_recria_por_ave:    f('costo_recria_por_ave'),
      vida_util_semanas:       parseInt(form.vida_util_semanas),
      updated_at:              new Date().toISOString(),
    }

    const { error: err } = config.id
      ? await supabase.from('config_costos').update(payload).eq('id', config.id)
      : await supabase.from('config_costos').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }

    setSaved(true)
    setLoading(false)
    setTimeout(() => { router.push('/costos'); router.refresh() }, 1200)
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
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Sección: Alimento */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Alimento</p>
            <div className="space-y-4">
              <div>
                <label className="label">Precio del alimento ($/kg)</label>
                <input type="number" min="0" step="any" value={form.precio_kg_alimento}
                  onChange={(e) => set('precio_kg_alimento', e.target.value)}
                  className="input" required />
                {precioSugerido && fechaUltimaCompra && (
                  <p className="text-xs text-slate-400 mt-1">
                    Última compra registrada ({formatearFechaCorta(fechaUltimaCompra)}):
                    {' '}{formatearPeso(precioSugerido)}/kg —{' '}
                    <button
                      type="button"
                      onClick={() => set('precio_kg_alimento', precioSugerido.toString())}
                      className="text-blue-600 hover:underline"
                    >
                      usar este valor
                    </button>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Consumo coloradas (g/día)</label>
                  <input type="number" min="0" step="0.1" value={form.consumo_coloradas_g_dia}
                    onChange={(e) => set('consumo_coloradas_g_dia', e.target.value)}
                    className="input" required />
                </div>
                <div>
                  <label className="label">Consumo blancas (g/día)</label>
                  <input type="number" min="0" step="0.1" value={form.consumo_blancas_g_dia}
                    onChange={(e) => set('consumo_blancas_g_dia', e.target.value)}
                    className="input" required />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Sección: Presupuesto mensual */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Presupuesto mensual</p>
            <div className="space-y-4">
              <div>
                <label className="label">Sueldos ($)</label>
                <input type="number" min="0" step="any" value={form.sueldos_mensuales}
                  onChange={(e) => set('sueldos_mensuales', e.target.value)}
                  className="input" />
              </div>
              <div>
                <label className="label">Maples ($)</label>
                <input type="number" min="0" step="any" value={form.maples_mensuales}
                  onChange={(e) => set('maples_mensuales', e.target.value)}
                  className="input" />
              </div>
              <div>
                <label className="label">Otros gastos ($)</label>
                <input type="number" min="0" step="any" value={form.otros_gastos_mensuales}
                  onChange={(e) => set('otros_gastos_mensuales', e.target.value)}
                  className="input" />
                <p className="text-xs text-slate-400 mt-1">Combustible, mantenimiento, peaje, ferretería, etc.</p>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Sección: Producción esperada */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Producción esperada</p>
            <div>
              <label className="label">% Postura esperada del plantel</label>
              <input type="number" min="1" max="100" step="0.1" value={form.postura_esperada_pct}
                onChange={(e) => set('postura_esperada_pct', e.target.value)}
                className="input" required />
              <p className="text-xs text-slate-400 mt-1">Usado para calcular cajones esperados en el costo estándar</p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Sección: Amortización aves */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Amortización de aves</p>
            <div className="space-y-4">
              <div>
                <label className="label">Costo de recría por ave ($)</label>
                <input type="number" min="0" step="any" value={form.costo_recria_por_ave}
                  onChange={(e) => set('costo_recria_por_ave', e.target.value)}
                  className="input" />
                <p className="text-xs text-slate-400 mt-1">Lo que cuesta producir una pollita lista para postura</p>
              </div>
              <div>
                <label className="label">Vida útil en postura (semanas)</label>
                <input type="number" min="1" step="1" value={form.vida_util_semanas}
                  onChange={(e) => set('vida_util_semanas', e.target.value)}
                  className="input" />
              </div>
            </div>

            {amortizacionPorSemana > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
                <p className="text-sm font-medium text-blue-800 mb-1">Amortización por gallina/semana</p>
                <p className="text-2xl font-bold text-blue-900">{formatearPeso(amortizacionPorSemana)}</p>
                <p className="text-xs text-blue-600 mt-1">
                  = {formatearPeso(f('costo_recria_por_ave'))} ÷ {form.vida_util_semanas} semanas
                </p>
              </div>
            )}
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
