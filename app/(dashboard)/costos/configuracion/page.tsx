import { createClient } from '@/lib/supabase/server'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionCostosPage() {
  const supabase = await createClient()
  const { data: config } = await supabase.from('config_costos').select('*').limit(1).single()

  return <ConfiguracionClient config={config ?? { id: '', costo_recria_por_ave: 3000, vida_util_semanas: 75, precio_kg_alimento: 0, updated_at: '' }} />
}
