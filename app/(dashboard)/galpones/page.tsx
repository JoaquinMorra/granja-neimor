import { createClient } from '@/lib/supabase/server'
import GalponesClient from './GalponesClient'

export default async function GalponesPage() {
  const supabase = await createClient()

  const [{ data: galpones }, { data: lotes }, { data: configRaw }] = await Promise.all([
    supabase.from('galpones').select('*').order('orden'),
    supabase.from('gallinas_actuales').select('*, galpon:galpones(*)').order('nombre'),
    supabase.from('config_costos').select('consumo_coloradas_g_dia, consumo_blancas_g_dia').limit(1).single(),
  ])

  return (
    <GalponesClient
      galpones={galpones ?? []}
      lotes={lotes ?? []}
      consumoColoradasGDia={configRaw?.consumo_coloradas_g_dia ?? 120}
      consumoBlancasGDia={configRaw?.consumo_blancas_g_dia ?? 113}
    />
  )
}
