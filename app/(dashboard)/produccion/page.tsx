import { createClient } from '@/lib/supabase/server'
import ProduccionClient from './ProduccionClient'
import { format } from 'date-fns'

export default async function ProduccionPage() {
  const supabase = await createClient()

  const [{ data: galpones }, { data: lotes }, { data: produccionReciente }] = await Promise.all([
    supabase.from('galpones').select('*').order('orden'),
    supabase.from('gallinas_actuales').select('*, galpon:galpones(*)').order('nombre'),
    supabase
      .from('produccion_diaria')
      .select('*, lote:lotes(nombre, galpon:galpones(nombre, tipo))')
      .gte('fecha', format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  return (
    <ProduccionClient
      galpones={galpones ?? []}
      lotes={lotes ?? []}
      produccionReciente={produccionReciente ?? []}
    />
  )
}
