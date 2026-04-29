import { createClient } from '@/lib/supabase/server'
import GalponesClient from './GalponesClient'

export default async function GalponesPage() {
  const supabase = await createClient()

  const [{ data: galpones }, { data: lotes }] = await Promise.all([
    supabase.from('galpones').select('*').order('orden'),
    supabase.from('gallinas_actuales').select('*, galpon:galpones(*)').order('nombre'),
  ])

  return <GalponesClient galpones={galpones ?? []} lotes={lotes ?? []} />
}
