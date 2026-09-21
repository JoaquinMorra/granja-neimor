import { createClient } from '@/lib/supabase/server'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: saldosClientes } = await supabase
    .from('vista_saldos_clientes')
    .select('*')
    .order('cliente')

  return <ClientesClient saldosClientes={saldosClientes ?? []} />
}
