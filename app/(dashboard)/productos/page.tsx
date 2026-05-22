import { createClient } from '@/lib/supabase/server'
import ProductosClient from './ProductosClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .order('codigo')

  return <ProductosClient productos={productos ?? []} />
}
