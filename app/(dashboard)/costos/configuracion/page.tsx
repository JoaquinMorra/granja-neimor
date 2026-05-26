import { createClient } from '@/lib/supabase/server'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionCostosPage() {
  const supabase = await createClient()

  const [{ data: config }, { data: ultimaCompra }] = await Promise.all([
    supabase.from('config_costos').select('*').limit(1).single(),
    supabase
      .from('compras_proveedor')
      .select('total, kg_alimento, fecha')
      .not('kg_alimento', 'is', null)
      .gt('kg_alimento', 0)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const precioSugerido =
    ultimaCompra && ultimaCompra.kg_alimento > 0
      ? Math.round(ultimaCompra.total / ultimaCompra.kg_alimento)
      : null

  const defaults = {
    id: '',
    costo_recria_por_ave: 0,
    vida_util_semanas: 75,
    precio_kg_alimento: 0,
    consumo_coloradas_g_dia: 120,
    consumo_blancas_g_dia: 113,
    sueldos_mensuales: 0,
    maples_mensuales: 0,
    otros_gastos_mensuales: 0,
    postura_esperada_pct: 70,
    updated_at: '',
  }

  return (
    <ConfiguracionClient
      config={config ?? defaults}
      precioSugerido={precioSugerido}
      fechaUltimaCompra={ultimaCompra?.fecha ?? null}
    />
  )
}
