import { createClient } from '@/lib/supabase/server'
import GalponesClient from './GalponesClient'

export default async function GalponesPage() {
  const supabase = await createClient()

  // 35 días cubre tanto "últimos 7 días" (postura real, muertes recientes)
  // como "lo que va del mes calendario" para la vista mobile de abajo —
  // la vista de escritorio no usa esto, sigue con la postura esperada (teórica).
  const treintaYCincoAtras = new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0]

  const [{ data: galpones }, { data: lotes }, { data: configRaw }, { data: ventasGallinas }, { data: produccionReciente }] = await Promise.all([
    supabase.from('galpones').select('*').order('orden'),
    supabase.from('gallinas_actuales').select('*, galpon:galpones(*)').order('nombre'),
    supabase.from('config_costos').select('consumo_coloradas_g_dia, consumo_blancas_g_dia').limit(1).single(),
    supabase.from('ventas_gallinas').select('*').order('fecha', { ascending: false }),
    supabase
      .from('produccion_diaria')
      .select('fecha, huevos, muertes, lote_id')
      .gte('fecha', treintaYCincoAtras)
      .is('deleted_at', null),
  ])

  return (
    <GalponesClient
      galpones={galpones ?? []}
      lotes={lotes ?? []}
      consumoColoradasGDia={configRaw?.consumo_coloradas_g_dia ?? 120}
      consumoBlancasGDia={configRaw?.consumo_blancas_g_dia ?? 113}
      ventasGallinas={ventasGallinas ?? []}
      produccionReciente={produccionReciente ?? []}
    />
  )
}
